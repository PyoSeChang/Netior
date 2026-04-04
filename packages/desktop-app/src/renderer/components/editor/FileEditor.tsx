import React, { useState, useEffect } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { fsService, fileService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useProjectStore } from '../../stores/project-store';
import { CodeEditor } from './CodeEditor';
import { ImageViewer } from './ImageViewer';
import { PdfViewer } from './PdfViewer';
import { UnsupportedFallback } from './UnsupportedFallback';
import { getEditorType, getMonacoLanguage, type EditorType } from './editor-utils';
import { MarkdownEditor } from './markdown/MarkdownEditor';
import { toRelativePath } from '../../utils/path-utils';

interface FileEditorProps {
  tab: EditorTab;
}

export function FileEditor({ tab }: FileEditorProps): JSX.Element {
  const { t } = useI18n();
  const filePath = tab.targetId;
  const editorType = (tab.editorType as EditorType) ?? getEditorType(filePath);
  const currentProject = useProjectStore((s) => s.currentProject);
  const [fileId, setFileId] = useState<string | null>(null);

  useEffect(() => {
    if (editorType !== 'pdf' || !currentProject) {
      setFileId(null);
      return;
    }

    let cancelled = false;
    const normalizedFilePath = filePath.replace(/\\/g, '/');
    const relativePath = toRelativePath(currentProject.root_dir, filePath);

    fileService.getByPath(currentProject.id, relativePath).then(async (entity) => {
      if (cancelled) return;
      if (entity) { setFileId(entity.id); return; }

      // Exact match failed — try matching against all project files
      const allFiles = await fileService.getByProject(currentProject.id);
      const match = allFiles.find((f) => {
        const dbPath = f.path.replace(/\\/g, '/');
        return dbPath === normalizedFilePath || normalizedFilePath.endsWith('/' + dbPath);
      });
      if (!cancelled && match) setFileId(match.id);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [filePath, editorType, currentProject]);

  const session = useEditorSession<string>({
    tabId: tab.id,
    load: () => {
      if (editorType === 'code' || editorType === 'markdown') {
        return fsService.readFile(filePath).catch(() => '');
      }
      return '';
    },
    save: async (content) => { await fsService.writeFile(filePath, content); },
    isEqual: (a, b) => a === b,
    deps: [filePath, editorType],
  });

  if (session.isLoading) {
    return <div className="flex h-full items-center justify-center text-xs text-muted">{t('common.loading')}</div>;
  }

  return renderEditor(editorType, { tabId: tab.id, content: session.state, filePath, onChange: session.setState, fileId });
}

export function renderEditor(
  type: EditorType,
  props: { tabId: string; content: string; filePath: string; onChange: (c: string) => void; fileId?: string | null },
): JSX.Element {
  switch (type) {
    case 'markdown':
      return <MarkdownEditor tabId={props.tabId} content={props.content} filePath={props.filePath} onChange={props.onChange} />;
    case 'code':
      return <CodeEditor tabId={props.tabId} content={props.content} language={getMonacoLanguage(props.filePath)} onChange={props.onChange} />;
    case 'image':
      return <ImageViewer absolutePath={props.filePath} />;
    case 'pdf':
      return <PdfViewer tabId={props.tabId} absolutePath={props.filePath} fileId={props.fileId ?? undefined} />;
    default:
      return <UnsupportedFallback filePath={props.filePath} absolutePath={props.filePath} />;
  }
}
