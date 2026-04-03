import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { EditorTab } from '@netior/shared/types';
import type { ITerminalInstance } from '@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/terminal/browser/terminal';
import { useModuleStore } from '../../stores/module-store';
import { useEditorStore } from '../../stores/editor-store';
import { getOrCreateTerminalInstance, adjustTerminalFontSize, resetTerminalFontSize } from '../../lib/terminal/terminal-services';
import { TerminalSearchBar } from './TerminalSearchBar';
import { TerminalTodoPanel } from './TerminalTodoPanel';
import { extractFileLinks } from '../../lib/terminal/terminal-link-parser';
import { subscribeTodoStore, isTodoEnabled } from '../../lib/terminal-todo-store';
import { logShortcut } from '../../shortcuts/shortcut-utils';

interface TerminalEditorProps {
  tab: EditorTab;
}

export function TerminalEditor({ tab }: TerminalEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ITerminalInstance | null>(null);
  const sessionId = tab.targetId;
  const cwdRef = useRef(tab.terminalCwd ?? useModuleStore.getState().directories[0]?.dir_path);
  const updateTitle = useEditorStore((s) => s.updateTitle);
  const [searchVisible, setSearchVisible] = useState(false);
  const todoEnabled = useSyncExternalStore(
    subscribeTodoStore,
    () => isTodoEnabled(sessionId),
  );

  const handleSearchClose = useCallback(() => {
    setSearchVisible(false);
    void instanceRef.current?.focusWhenReady();
  }, []);

  useEffect(() => {
    const cwd = cwdRef.current;
    if (!containerRef.current || !sessionId || !cwd) return;

    let disposed = false;
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    let scrollbarObserver: MutationObserver | null = null;
    let titleListener: { dispose(): void } | null = null;

    const patchScrollbars = (): void => {
      const vertical = container.querySelector<HTMLElement>('.xterm-scrollbar.xterm-vertical');
      const horizontal = container.querySelector<HTMLElement>('.xterm-scrollbar.xterm-horizontal');
      const verticalSlider = vertical?.querySelector<HTMLElement>('.xterm-slider');
      const horizontalSlider = horizontal?.querySelector<HTMLElement>('.xterm-slider');

      if (vertical) {
        vertical.style.width = '8px';
        vertical.style.right = '2px';
        vertical.style.background = 'transparent';
      }

      if (horizontal) {
        horizontal.style.height = '8px';
        horizontal.style.bottom = '2px';
        horizontal.style.background = 'transparent';
      }

      if (verticalSlider) {
        verticalSlider.style.width = '8px';
        verticalSlider.style.borderRadius = '9999px';
      }

      if (horizontalSlider) {
        horizontalSlider.style.height = '8px';
        horizontalSlider.style.borderRadius = '9999px';
      }
    };

    const attach = async (): Promise<void> => {
      const instance = await getOrCreateTerminalInstance(sessionId, cwd, tab.title);
      instanceRef.current = instance;
      if (disposed) {
        instance.detachFromElement();
        return;
      }

      instance.attachToElement(container);
      instance.setVisible(true);
      instance.layout({
        width: container.clientWidth,
        height: container.clientHeight,
      });
      patchScrollbars();

      titleListener = instance.onTitleChanged(() => {
        updateTitle(tab.id, instance.title);
      });
      updateTitle(tab.id, instance.title);

      resizeObserver = new ResizeObserver(() => {
        if (disposed) return;
        instance.layout({
          width: container.clientWidth,
          height: container.clientHeight,
        });
        patchScrollbars();
      });
      resizeObserver.observe(container);

      scrollbarObserver = new MutationObserver(() => {
        patchScrollbars();
      });
      scrollbarObserver.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });

      void instance.focusWhenReady();
    };

    void attach();

    const handleKeyDown = (e: KeyboardEvent): void => {
      const instance = instanceRef.current;
      if (!instance) return;

      // Shift+PgUp/PgDown: page scroll
      if (e.shiftKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'PageUp') {
          e.preventDefault();
          e.stopPropagation();
          logShortcut('shortcut.terminal.pageScrollUp');
          instance.scrollUpPage();
          return;
        }
        if (e.key === 'PageDown') {
          e.preventDefault();
          e.stopPropagation();
          logShortcut('shortcut.terminal.pageScrollDown');
          instance.scrollDownPage();
          return;
        }
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      // Ctrl+C: copy selection (or SIGINT if no selection)
      if (e.key === 'c' && instance.hasSelection()) {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.copySelection');
        (instance as unknown as { xterm?: { copySelection(): void } }).xterm?.copySelection();
        return;
      }

      // Ctrl+V: paste from clipboard
      if (e.key === 'v') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.paste');
        void navigator.clipboard.readText().then((text) => {
          if (text) void instance.sendText(text, false, true);
        });
        return;
      }

      // Ctrl+F: open search
      if (e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.openSearch');
        setSearchVisible(true);
        return;
      }

      // Ctrl+=/+: increase font size
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.fontSizeUp');
        adjustTerminalFontSize(1);
        return;
      }

      // Ctrl+-: decrease font size
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.fontSizeDown');
        adjustTerminalFontSize(-1);
        return;
      }

      // Ctrl+0: reset font size
      if (e.key === '0') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.fontSizeReset');
        resetTerminalFontSize();
        return;
      }
    };

    const handleCtrlClick = (e: MouseEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      const instance = instanceRef.current;
      if (!instance) return;

      type BufferLine = { translateToString(trimRight?: boolean): string; isWrapped?: boolean };
      const xterm = instance as unknown as {
        xterm?: {
          buffer: {
            active: {
              baseY: number;
              length: number;
              getLine(y: number): BufferLine | undefined;
            };
          };
          _renderService?: { dimensions: { css: { cell: { width: number; height: number } } } };
        };
      };
      const xt = xterm.xterm;
      if (!xt) return;

      // Get cell height from render service (most accurate)
      const cellHeight = xt._renderService?.dimensions?.css?.cell?.height ?? 18;

      const xtermScreen = container.querySelector('.xterm-screen') as HTMLElement | null;
      if (!xtermScreen) return;
      const screenRect = xtermScreen.getBoundingClientRect();
      const viewportRow = Math.floor((e.clientY - screenRect.top) / cellHeight);
      const bufferRow = xt.buffer.active.baseY + viewportRow;

      // Collect the full logical line by joining wrapped lines
      // Walk backward to find the start of the logical line
      let startRow = bufferRow;
      while (startRow > 0) {
        const prev = xt.buffer.active.getLine(startRow);
        if (!prev || !prev.isWrapped) break;
        startRow--;
      }
      // Walk forward to collect all wrapped continuations
      let fullText = '';
      for (let r = startRow; r < xt.buffer.active.length; r++) {
        const bufLine = xt.buffer.active.getLine(r);
        if (!bufLine) break;
        if (r > startRow && !bufLine.isWrapped) break;
        fullText += bufLine.translateToString(r === startRow);
      }

      const links = extractFileLinks(fullText);
      if (links.length === 0) return;

      const bestLink = links[0];
      e.preventDefault();
      e.stopPropagation();

      // Resolve relative paths against terminal cwd
      let filePath = bestLink.path;
      if (!filePath.match(/^[A-Za-z]:[\\/]/) && !filePath.startsWith('/')) {
        filePath = cwd + '/' + filePath;
      }
      filePath = filePath.replace(/\\/g, '/');

      const fileName = filePath.split('/').pop() ?? filePath;
      void useEditorStore.getState().openTab({
        type: 'file',
        targetId: filePath,
        title: fileName,
      });
    };

    container.addEventListener('keydown', handleKeyDown, true);
    container.addEventListener('click', handleCtrlClick, true);

    return () => {
      disposed = true;
      container.removeEventListener('keydown', handleKeyDown, true);
      container.removeEventListener('click', handleCtrlClick, true);
      titleListener?.dispose();
      resizeObserver?.disconnect();
      scrollbarObserver?.disconnect();
      instanceRef.current?.detachFromElement();
      instanceRef.current?.setVisible(false);
      instanceRef.current = null;
    };
  }, [sessionId, tab.id, tab.title, updateTitle]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-surface-panel p-2">
      <div ref={containerRef} className="terminal-editor flex-1 min-h-0 overflow-hidden bg-surface-panel" />
      {searchVisible && (
        <TerminalSearchBar instanceRef={instanceRef} onClose={handleSearchClose} />
      )}
      {todoEnabled && <TerminalTodoPanel sessionId={sessionId} autoShowSeconds={10} />}
    </div>
  );
}
