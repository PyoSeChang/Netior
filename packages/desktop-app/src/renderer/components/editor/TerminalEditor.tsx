import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { EditorTab } from '@moc/shared/types';
import { useModuleStore } from '../../stores/module-store';
import { getCssColorAsHex } from './editor-utils';

interface TerminalEditorProps {
  tab: EditorTab;
}

export function TerminalEditor({ tab }: TerminalEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionId = tab.targetId;
  const cwd = useModuleStore((s) => s.directories[0]?.dir_path);

  useEffect(() => {
    if (!containerRef.current || !sessionId || !cwd) return;

    const isDark = document.documentElement.getAttribute('data-mode') !== 'light';
    const bg = getCssColorAsHex('--surface-panel', isDark ? '#1e1e1e' : '#ffffff');

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      theme: {
        background: bg,
        foreground: isDark ? '#cccccc' : '#1e1e1e',
        cursor: isDark ? '#cccccc' : '#1e1e1e',
        cursorAccent: isDark ? '#1e1e1e' : '#ffffff',
        selectionBackground: '#ffffff40',
      },
      scrollback: 5000,
      windowsPty: {
        backend: 'conpty',
        buildNumber: window.electron.platform.osBuildNumber,
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(containerRef.current);

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      fitAddon.fit();
    }

    termRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Spawn PTY
    window.electron.terminal.spawn(sessionId, cwd);

    // User input → PTY
    const onDataDispose = terminal.onData((data) => {
      window.electron.terminal.input(sessionId, data);
    });

    // PTY output → terminal
    const removeOutput = window.electron.terminal.onOutput((sid, data) => {
      if (sid === sessionId) {
        terminal.write(data);
      }
    });

    // PTY exit
    const removeExit = window.electron.terminal.onExit((sid, exitCode) => {
      if (sid === sessionId) {
        terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
      }
    });

    // Resize initial
    if (rect.width > 0 && rect.height > 0) {
      window.electron.terminal.resize(sessionId, terminal.cols, terminal.rows);
    }

    // Copy/Paste handler
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== 'keydown') return true;
      if (event.ctrlKey && !event.shiftKey && !event.altKey) {
        if (event.key === 'c' && terminal.hasSelection()) {
          navigator.clipboard.writeText(terminal.getSelection());
          terminal.clearSelection();
          return false;
        }
        if (event.key === 'v') return false;
      }
      return true;
    });

    const pasteHandler = (e: ClipboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData('text');
      if (text) terminal.paste(text);
    };
    containerRef.current.addEventListener('paste', pasteHandler, true);

    // ResizeObserver
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        fitAddon.fit();
        window.electron.terminal.resize(sessionId, terminal.cols, terminal.rows);
      }, 50);
    });
    observer.observe(containerRef.current);

    const containerEl = containerRef.current;

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      containerEl.removeEventListener('paste', pasteHandler, true);
      removeOutput();
      removeExit();
      onDataDispose.dispose();
      observer.disconnect();
      terminal.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      // PTY kill is handled by editor-store.closeTab, not here
    };
  }, [sessionId, cwd]);

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={containerRef} className="flex-1 min-h-0 p-2" />
    </div>
  );
}
