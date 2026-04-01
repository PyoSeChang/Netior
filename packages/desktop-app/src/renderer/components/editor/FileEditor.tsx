import React from 'react';
import type { EditorTab } from '@netior/shared/types';
import { fsService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { useEditorSession } from '../../hooks/useEditorSession';
import { CodeEditor } from './CodeEditor';
import { ImageViewer } from './ImageViewer';
import { PdfViewer } from './PdfViewer';
import { UnsupportedFallback } from './UnsupportedFallback';
import { getEditorType, getMonacoLanguage, type EditorType } from './editor-utils';
import { MarkdownEditor } from './markdown/MarkdownEditor';

interface FileEditorProps {
  tab: EditorTab;
}

export function FileEditor({ tab }: FileEditorProps): JSX.Element {
  const { t } = useI18n();
  const filePath = tab.targetId;
  const editorType = (tab.editorType as EditorType) ?? getEditorType(filePath);

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

  return renderEditor(editorType, { content: session.state, filePath, onChange: session.setState });
}

export function renderEditor(
  type: EditorType,
  props: { content: string; filePath: string; onChange: (c: string) => void },
): JSX.Element {
  switch (type) {
    case 'markdown':
      return (
        <MarkdownEditor
          content={props.content}
          filePath={props.filePath}
          onChange={props.onChange}
        />
      );
    case 'code':
      return (
        <CodeEditor
          content={props.content}
          language={getMonacoLanguage(props.filePath)}
          onChange={props.onChange}
        />
      );
    case 'image':
      return <ImageViewer absolutePath={props.filePath} />;
    case 'pdf':
      return <PdfViewer absolutePath={props.filePath} />;
    default:
      return <UnsupportedFallback filePath={props.filePath} absolutePath={props.filePath} />;
  }
}
