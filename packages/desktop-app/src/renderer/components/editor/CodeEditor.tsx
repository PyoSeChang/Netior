import React, { useCallback, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as monacoEditor } from 'monaco-editor';

interface CodeEditorProps {
  content: string;
  language: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

export function CodeEditor({ content, language, onChange, onSave }: CodeEditorProps): JSX.Element {
  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Ctrl+S / Cmd+S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });
  }, [onSave]);

  const handleChange = useCallback((value: string | undefined) => {
    onChange(value ?? '');
  }, [onChange]);

  // TODO: detect theme from app data-mode attribute
  const isDark = document.documentElement.getAttribute('data-mode') !== 'light';

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      theme={isDark ? 'vs-dark' : 'vs'}
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
