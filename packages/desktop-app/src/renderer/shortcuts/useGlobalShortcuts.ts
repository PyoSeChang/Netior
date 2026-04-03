import { useEffect } from 'react';
import { useEditorStore } from '../stores/editor-store';
import { getSession } from '../lib/editor-session-registry';
import { useProjectStore } from '../stores/project-store';
import { useUIStore } from '../stores/ui-store';
import { isEditableTarget, isPrimaryModifier, logShortcut } from './shortcut-utils';

function cycleTab(direction: 1 | -1): void {
  const { tabs, activeTabId, setActiveTab } = useEditorStore.getState();
  if (tabs.length === 0) return;

  const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (startIndex + direction + tabs.length) % tabs.length;
  setActiveTab(tabs[nextIndex].id);
}

function activateTabByNumber(indexKey: string): void {
  const { tabs, setActiveTab } = useEditorStore.getState();
  if (tabs.length === 0) return;

  const index = Number(indexKey);
  if (Number.isNaN(index) || index < 1 || index > 9) return;

  const targetTab =
    index === 9
      ? tabs[tabs.length - 1]
      : tabs[index - 1];
  if (!targetTab) return;

  setActiveTab(targetTab.id);
}

function openTerminalTab(): void {
  const sessionId = `term-${Date.now()}`;
  void useEditorStore.getState().openTab({
    type: 'terminal',
    targetId: sessionId,
    title: 'Terminal',
  });
}

function openNarreTab(): void {
  const projectId = useProjectStore.getState().currentProject?.id;
  if (!projectId) return;

  void useEditorStore.getState().openTab({
    type: 'narre',
    targetId: projectId,
    title: 'Narre',
  });
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!isPrimaryModifier(event)) return;

      const editable = isEditableTarget(event.target);
      const key = event.key.toLowerCase();

      if (key === 's') {
        event.preventDefault();
        const tabId = useEditorStore.getState().activeTabId;
        if (!tabId) return;
        logShortcut('shortcut.global.saveActiveTab');
        void getSession(tabId)?.save();
        return;
      }

      if (key === 'w') {
        event.preventDefault();
        const tabId = useEditorStore.getState().activeTabId;
        if (!tabId) return;
        logShortcut('shortcut.global.closeActiveTab');
        useEditorStore.getState().requestCloseTab(tabId);
        return;
      }

      if (key === ',') {
        event.preventDefault();
        logShortcut('shortcut.global.openSettings');
        useUIStore.getState().setShowSettings(true);
        return;
      }

      if (key === '/') {
        event.preventDefault();
        logShortcut('shortcut.global.openShortcutOverlay');
        useUIStore.getState().setShowShortcutOverlay(true);
        return;
      }

      if (key === 'b') {
        event.preventDefault();
        logShortcut('shortcut.global.toggleSidebar');
        useUIStore.getState().toggleSidebar();
        return;
      }

      if (event.shiftKey && !event.altKey && key === 'n') {
        event.preventDefault();
        logShortcut('shortcut.global.openTerminal');
        openTerminalTab();
        return;
      }

      if (event.altKey && !event.shiftKey && key === 'n') {
        event.preventDefault();
        logShortcut('shortcut.global.openNarre');
        openNarreTab();
        return;
      }

      if (editable) return;

      if (key === 'tab') {
        event.preventDefault();
        logShortcut(event.shiftKey ? 'shortcut.global.previousTab' : 'shortcut.global.nextTab');
        cycleTab(event.shiftKey ? -1 : 1);
        return;
      }

      if (!event.shiftKey && !event.altKey && /^[1-9]$/.test(key)) {
        event.preventDefault();
        logShortcut('shortcut.global.openTabByIndex');
        activateTabByNumber(key);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
