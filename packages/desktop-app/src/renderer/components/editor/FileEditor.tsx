import React, { useEffect, useState, useCallback } from 'react';
import type { EditorTab } from '@moc/shared/types';
import { useEditorStore } from '../../stores/editor-store';
import { fsService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { CodeEditor } from './CodeEditor';
import { ImageViewer } from './ImageViewer';
import { PdfViewer } from './PdfViewer';
import { UnsupportedFallback } from './UnsupportedFallback';
import { getEditorType, getMonacoLanguage, type EditorType } from './editor-utils';

interface FileEditorProps {
  tab: EditorTab;
}

export function FileEditor({ tab }: FileEditorProps): JSX.Element {
  const { t } = useI18n();
  const { setDirty } = useEditorStore();
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);

  const filePath = tab.targetId;
  const editorType = getEditorType(filePath);

  useEffect(() => {
    setLoaded(false);
    if (editorType === 'code') {
      fsService.readFile(filePath).then((c) => {
        setContent(c);
        setLoaded(true);
      }).catch(() => {
        setContent('');
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
  }, [filePath, editorType]);

  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    setDirty(tab.id, true);
  }, [tab.id, setDirty]);

  const handleSave = useCallback(async () => {
    await fsService.writeFile(filePath, content);
    setDirty(tab.id, false);
  }, [filePath, content, tab.id, setDirty]);

  if (!loaded) {
    return <div className="flex h-full items-center justify-center text-xs text-muted">{t('common.loading')}</div>;
  }

  return renderEditor(editorType, { content, filePath, onChange: handleChange, onSave: handleSave });
}

export function renderEditor(
  type: EditorType,
  props: { content: string; filePath: string; onChange: (c: string) => void; onSave: () => void },
): JSX.Element {
  switch (type) {
    case 'code':
      return (
        <CodeEditor
          content={props.content}
          language={getMonacoLanguage(props.filePath)}
          onChange={props.onChange}
          onSave={props.onSave}
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
