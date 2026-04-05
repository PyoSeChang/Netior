import React, { useCallback, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { getCssColorAsHex } from './editor-utils';
import { useViewState } from '../../hooks/useViewState';
import { useSettingsStore } from '../../stores/settings-store';

type MonacoEditor = Parameters<OnMount>[0];
type MonacoNamespace = Parameters<NonNullable<Parameters<typeof Editor>[0]['beforeMount']>>[0];

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
  const monacoRef = useRef<MonacoNamespace | null>(null);
  const [viewState, setViewState] = useViewState<CodeViewState>(tabId, { cursorLine: 1, cursorColumn: 1, scrollTop: 0 });
  const viewStateRef = useRef(viewState);
  const resolvedThemeMode = useSettingsStore((s) => s.resolvedThemeMode);
  const themeRevision = useSettingsStore((s) => s.themeRevision);

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

  const isDark = resolvedThemeMode !== 'light';
  const bg = getCssColorAsHex('--surface-panel', isDark ? '#1e1e1e' : '#ffffff');

  const handleBeforeMount = useCallback((monaco: MonacoNamespace) => {
    monacoRef.current = monaco;
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

  React.useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
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
    monaco.editor.setTheme(isDark ? 'netior-dark' : 'netior-light');
  }, [bg, isDark, themeRevision]);

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
