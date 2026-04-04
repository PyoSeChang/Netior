import { useEffect } from 'react';
import { useEditorStore, MAIN_HOST_ID } from '../stores/editor-store';
import { getSession } from '../lib/editor-session-registry';
import { jumpToNextUnacknowledgedAgent } from '../lib/terminal-agent-notifier';
import { openTerminalTab } from '../lib/terminal/open-terminal-tab';
import { isEditableTarget, isPrimaryModifier, logShortcut } from './shortcut-utils';

function getHostActiveTabId(hostId: string): string | null {
  const { hosts } = useEditorStore.getState();
  return hosts[hostId]?.activeTabId ?? null;
}

function getHostTabs(hostId: string) {
  return useEditorStore.getState().tabs.filter((t) => t.hostId === hostId);
}

function cycleHostTab(hostId: string, direction: 1 | -1): void {
  const tabs = getHostTabs(hostId);
  const activeTabId = getHostActiveTabId(hostId);
  if (!activeTabId || tabs.length <= 1) return;

  const idx = tabs.findIndex((t) => t.id === activeTabId);
  if (idx < 0) return;
  const next = (idx + direction + tabs.length) % tabs.length;
  useEditorStore.getState().setHostActiveTab(hostId, tabs[next].id);
}

function activateHostTabByNumber(hostId: string, indexKey: string): void {
  const tabs = getHostTabs(hostId);
  const index = Number(indexKey);
  if (Number.isNaN(index) || index < 1 || index > 9) return;

  const target = index === 9 ? tabs[tabs.length - 1] : tabs[index - 1];
  if (!target) return;

  useEditorStore.getState().setHostActiveTab(hostId, target.id);
}

export function useDetachedShortcuts(hostId: string): void {
  useEffect(() => {
    const handleAppShortcut = (shortcut: string): void => {
      if (shortcut === 'nextTab') {
        logShortcut('shortcut.detached.nextTab');
        cycleHostTab(hostId, 1);
        return;
      }

      if (shortcut === 'previousTab') {
        logShortcut('shortcut.detached.previousTab');
        cycleHostTab(hostId, -1);
        return;
      }

      if (shortcut.startsWith('openTabByIndex:')) {
        const indexKey = shortcut.split(':')[1];
        if (!indexKey) return;
        logShortcut('shortcut.detached.openTabByIndex');
        activateHostTabByNumber(hostId, indexKey);
        return;
      }

      if (shortcut === 'jumpToLastAgent') {
        logShortcut('shortcut.detached.jumpToLastAgent');
        jumpToNextUnacknowledgedAgent();
        return;
      }
    };

    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!isPrimaryModifier(event)) return;

      const key = event.key.toLowerCase();

      // Save active tab
      if (key === 's') {
        event.preventDefault();
        const tabId = getHostActiveTabId(hostId);
        if (!tabId) return;
        logShortcut('shortcut.detached.saveActiveTab');
        void getSession(tabId)?.save();
        return;
      }

      // Close active tab
      if (key === 'w') {
        event.preventDefault();
        const tabId = getHostActiveTabId(hostId);
        if (!tabId) return;
        logShortcut('shortcut.detached.closeActiveTab');
        useEditorStore.getState().requestCloseTab(tabId);
        return;
      }

      // Reattach active tab to main
      if (event.shiftKey && !event.altKey && key === 'm') {
        event.preventDefault();
        const tabId = getHostActiveTabId(hostId);
        if (!tabId) return;
        logShortcut('shortcut.detached.reattachToMain');
        useEditorStore.getState().moveTabToHost(tabId, MAIN_HOST_ID);
        return;
      }

      // Open new terminal in this host
      if (event.shiftKey && !event.altKey && key === 'n') {
        event.preventDefault();
        logShortcut('shortcut.detached.openTerminal');
        openTerminalTab(hostId);
        return;
      }

      // Jump to last agent
      if (!event.shiftKey && !event.altKey && key === '.') {
        event.preventDefault();
        logShortcut('shortcut.detached.jumpToLastAgent');
        jumpToNextUnacknowledgedAgent();
        return;
      }

      if (isEditableTarget(event.target)) return;

      // Tab cycling
      if (key === 'tab') {
        event.preventDefault();
        logShortcut(event.shiftKey ? 'shortcut.detached.previousTab' : 'shortcut.detached.nextTab');
        cycleHostTab(hostId, event.shiftKey ? -1 : 1);
        return;
      }

      // Tab by index
      if (!event.shiftKey && !event.altKey && /^[1-9]$/.test(key)) {
        event.preventDefault();
        logShortcut('shortcut.detached.openTabByIndex');
        activateHostTabByNumber(hostId, key);
      }
    };

    window.addEventListener('keydown', handler, true);
    const cleanupAppShortcut = window.electron.window.onAppShortcut(handleAppShortcut);
    return () => {
      window.removeEventListener('keydown', handler, true);
      cleanupAppShortcut();
    };
  }, [hostId]);
}
