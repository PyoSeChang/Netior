import React, { useCallback, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { getCssColorAsHex } from './editor-utils';

type MonacoEditor = Parameters<OnMount>[0];

interface CodeEditorProps {
  content: string;
  language: string;
  onChange: (content: string) => void;
}

export function CodeEditor({ content, language, onChange }: CodeEditorProps): JSX.Element {
  const editorRef = useRef<MonacoEditor | null>(null);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback((value: string | undefined) => {
    onChange(value ?? '');
  }, [onChange]);

  const isDark = document.documentElement.getAttribute('data-mode') !== 'light';
  const bg = getCssColorAsHex('--surface-panel', isDark ? '#1e1e1e' : '#ffffff');

  const handleBeforeMount = useCallback((monaco: Parameters<NonNullable<Parameters<typeof Editor>[0]['beforeMount']>>[0]) => {
    monaco.editor.defineTheme('netior-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: { 'editor.background': bg },
    });
    monaco.editor.defineTheme('netior-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: { 'editor.background': bg },
    });
  }, [bg]);

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      theme={isDark ? 'netior-dark' : 'netior-light'}
      beforeMount={handleBeforeMount}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
