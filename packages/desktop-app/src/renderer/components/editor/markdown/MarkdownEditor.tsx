import React, { useState, useMemo, useCallback, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM } from '@lezer/markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { livePreviewPlugin, livePreviewTheme } from './live-preview';
import { MarkdownToc, extractHeadings } from './MarkdownToc';
import { Toggle } from '../../ui/Toggle';
import { useI18n } from '../../../hooks/useI18n';
import { getCssColorAsHex } from '../editor-utils';

// Code-only highlight — intentionally skips markdown tags (heading, emphasis, link, etc.)
const codeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.string, color: '#98c379' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#61afef' },
  { tag: tags.variableName, color: '#e06c75' },
  { tag: tags.typeName, color: '#e5c07b' },
  { tag: tags.className, color: '#e5c07b' },
  { tag: tags.operator, color: '#56b6c2' },
  { tag: tags.bool, color: '#d19a66' },
  { tag: tags.null, color: '#d19a66' },
  { tag: tags.propertyName, color: '#e06c75' },
  { tag: tags.definition(tags.variableName), color: '#61afef' },
  { tag: tags.punctuation, color: '#abb2bf' },
  { tag: tags.meta, color: '#abb2bf' },
  { tag: tags.atom, color: '#d19a66' },
  { tag: tags.regexp, color: '#98c379' },
  { tag: tags.attributeName, color: '#d19a66' },
  { tag: tags.attributeValue, color: '#98c379' },
  { tag: tags.tagName, color: '#e06c75' },
]);

interface MarkdownEditorProps {
  content: string;
  filePath: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

export function MarkdownEditor({ content, filePath, onChange, onSave }: MarkdownEditorProps): JSX.Element {
  const { t } = useI18n();
  const [showToc, setShowToc] = useState(true);
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const headings = useMemo(() => extractHeadings(content), [content]);
  const isDark = document.documentElement.getAttribute('data-mode') !== 'light';

  const extensions = useMemo(() => [
    keymap.of([{
      key: 'Mod-s',
      run: () => { onSave(); return true; },
    }]),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown({ extensions: GFM, codeLanguages: languages }),
    ...livePreviewPlugin,
    livePreviewTheme,
    syntaxHighlighting(codeHighlightStyle),
    EditorView.lineWrapping,
  ], [onSave]);

  const theme = useMemo(() => {
    const bg = getCssColorAsHex('--surface-panel', isDark ? '#1e1e1e' : '#ffffff');
    const fg = getCssColorAsHex('--text-default', isDark ? '#d4d4d4' : '#1e1e1e');
    const cursor = getCssColorAsHex('--accent', isDark ? '#569cd6' : '#0078d4');

    return EditorView.theme({
      '&': { backgroundColor: bg, color: fg, height: '100%' },
      '.cm-scroller': {
        fontFamily: 'inherit',
        fontSize: '13px',
        lineHeight: '1.7',
        overflow: 'auto',
      },
      '.cm-content': {
        maxWidth: '600px',
        margin: '0 auto',
        padding: '1.5rem 1rem 10rem 1rem',
        caretColor: cursor,
      },
      '.cm-gutters': { display: 'none' },
      '.cm-cursor': {
        borderLeftColor: `${cursor} !important`,
        borderLeftWidth: '2px !important',
      },
      '.cm-activeLine': { backgroundColor: 'transparent' },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: isDark ? 'rgba(86, 156, 214, 0.3)' : 'rgba(0, 120, 212, 0.2)',
      },
    });
  }, [isDark]);

  const handleChange = useCallback((value: string) => {
    onChange(value);
  }, [onChange]);

  const handleNavigate = useCallback((lineNumber: number) => {
    const view = cmRef.current?.view;
    const scroller = scrollRef.current;
    if (!view || !scroller) return;

    // Find the target heading element in the DOM by searching CM6 lines
    const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines));
    const block = view.lineBlockAt(line.from);

    // block.top is relative to document start. The scroller scrolls the CM content.
    // Find the CM editor element's offset within the scroller
    const cmEl = view.dom;
    const cmTop = cmEl.offsetTop;
    const target = Math.max(0, cmTop + block.top - 50);

    const start = scroller.scrollTop;
    const distance = target - start;
    if (Math.abs(distance) < 5) return;
    const duration = Math.min(600, Math.max(200, Math.abs(distance) * 0.4));
    let startTime: number | null = null;

    function step(ts: number) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease = progress < 0.5
        ? 2 * progress * progress
        : 1 - (-2 * progress + 2) ** 2 / 2;
      scroller.scrollTop = start + distance * ease;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, []);

  return (
    <div ref={containerRef} className="relative flex h-full">
      {showToc && headings.length > 0 && (
        <MarkdownToc headings={headings} onNavigate={handleNavigate} containerRef={containerRef} />
      )}

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="absolute right-3 top-1.5 z-20">
          <Toggle checked={showToc} onChange={setShowToc} label={t('markdown.toc')} />
        </div>

        <CodeMirror
          ref={cmRef}
          value={content}
          extensions={extensions}
          theme={theme}
          onChange={handleChange}
          height="100%"
          basicSetup={false}
        />
      </div>
    </div>
  );
}
