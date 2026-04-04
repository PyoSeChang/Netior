import React, { useCallback, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { getCssColorAsHex } from './editor-utils';
import { useViewState } from '../../hooks/useViewState';

type MonacoEditor = Parameters<OnMount>[0];

interface CodeViewState {
  cursorLine: number;
  cursorColumn: number;
  scrollTop: number;
}

interface CodeEditorProps {
  tabId: string;
  content: string;
  language: string;
  onChange: (content: string) => void;
}

export function CodeEditor({ tabId, content, language, onChange }: CodeEditorProps): JSX.Element {
  const editorRef = useRef<MonacoEditor | null>(null);
  const [viewState, setViewState] = useViewState<CodeViewState>(tabId, { cursorLine: 1, cursorColumn: 1, scrollTop: 0 });
  const viewStateRef = useRef(viewState);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;

    // Restore cursor and scroll from cached view state
    const vs = viewStateRef.current;
    if (vs.cursorLine > 1 || vs.cursorColumn > 1) {
      editor.setPosition({ lineNumber: vs.cursorLine, column: vs.cursorColumn });
      editor.revealPositionInCenter({ lineNumber: vs.cursorLine, column: vs.cursorColumn });
    }
    if (vs.scrollTop > 0) {
      editor.setScrollTop(vs.scrollTop);
    }

    // Save cursor on change
    editor.onDidChangeCursorPosition((e) => {
      setViewState((prev) => ({
        ...prev,
        cursorLine: e.position.lineNumber,
        cursorColumn: e.position.column,
      }));
    });

    // Save scroll on change
    editor.onDidScrollChange((e) => {
      setViewState((prev) => ({ ...prev, scrollTop: e.scrollTop }));
    });
  }, [setViewState]);

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
