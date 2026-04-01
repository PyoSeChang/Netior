import React, { useEffect, useRef } from 'react';
import type { EditorTab } from '@moc/shared/types';
import type { ITerminalInstance } from '@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/terminal/browser/terminal';
import { useModuleStore } from '../../stores/module-store';
import { useEditorStore } from '../../stores/editor-store';
import { getOrCreateTerminalInstance } from '../../lib/terminal/terminal-services';

interface TerminalEditorProps {
  tab: EditorTab;
}

export function TerminalEditor({ tab }: TerminalEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionId = tab.targetId;
  const cwd = useModuleStore((s) => s.directories[0]?.dir_path);
  const updateTitle = useEditorStore((s) => s.updateTitle);

  useEffect(() => {
    if (!containerRef.current || !sessionId || !cwd) return;

    let disposed = false;
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    let scrollbarObserver: MutationObserver | null = null;
    let titleListener: { dispose(): void } | null = null;
    let attachedInstance: ITerminalInstance | null = null;

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
      attachedInstance = instance;
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

    return () => {
      disposed = true;
      titleListener?.dispose();
      resizeObserver?.disconnect();
      scrollbarObserver?.disconnect();
      attachedInstance?.detachFromElement();
      attachedInstance?.setVisible(false);
    };
  }, [cwd, sessionId, tab.id, tab.title, updateTitle]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-surface-panel p-2">
      <div ref={containerRef} className="terminal-editor flex-1 min-h-0 overflow-hidden bg-surface-panel" />
    </div>
  );
}
