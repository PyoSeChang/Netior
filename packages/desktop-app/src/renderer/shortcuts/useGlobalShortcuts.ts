import { useEffect } from 'react';
import { useEditorStore, getActiveLeaf, collectLeaves } from '../stores/editor-store';
import { getSession } from '../lib/editor-session-registry';
import { useProjectStore } from '../stores/project-store';
import { useUIStore } from '../stores/ui-store';
import { jumpToNextUnacknowledgedAgent } from '../lib/terminal-agent-notifier';
import { isEditableTarget, isPrimaryModifier, logShortcut } from './shortcut-utils';

export function cycleTab(direction: 1 | -1): void {
  const result = getActiveLeaf();
  if (!result) return; // float/detached → no-op

  const { leaf } = result;
  const { activeTabId, setActiveTab } = useEditorStore.getState();
  if (!activeTabId) return;

  const idx = leaf.tabIds.indexOf(activeTabId);
  if (idx < 0) return;
  const next = (idx + direction + leaf.tabIds.length) % leaf.tabIds.length;
  setActiveTab(leaf.tabIds[next]);
}

export function activateTabByNumber(indexKey: string): void {
  const result = getActiveLeaf();
  if (!result) return; // float/detached → no-op

  const index = Number(indexKey);
  if (Number.isNaN(index) || index < 1 || index > 9) return;

  const { tabIds } = result.leaf;
  const target = index === 9 ? tabIds[tabIds.length - 1] : tabIds[index - 1];
  if (!target) return;

  useEditorStore.getState().setActiveTab(target);
}

export function cyclePane(direction: 1 | -1): void {
  const result = getActiveLeaf();
  if (!result) return;

  const layout = result.mode === 'side'
    ? useEditorStore.getState().sideLayout
    : useEditorStore.getState().fullLayout;
  if (!layout) return;

  const leaves = collectLeaves(layout);
  if (leaves.length <= 1) return;

  const { activeTabId } = useEditorStore.getState();
  const currentIdx = leaves.findIndex((l) => l.tabIds.includes(activeTabId!));
  if (currentIdx < 0) return;

  const nextIdx = (currentIdx + direction + leaves.length) % leaves.length;
  useEditorStore.getState().setActiveTab(leaves[nextIdx].activeTabId);
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
    const handleAppShortcut = (shortcut: string): void => {
      if (shortcut === 'nextTab') {
        logShortcut('shortcut.global.nextTab');
        cycleTab(1);
        return;
      }

      if (shortcut === 'previousTab') {
        logShortcut('shortcut.global.previousTab');
        cycleTab(-1);
        return;
      }

      if (shortcut.startsWith('openTabByIndex:')) {
        const indexKey = shortcut.split(':')[1];
        if (!indexKey) return;
        logShortcut('shortcut.global.openTabByIndex');
        activateTabByNumber(indexKey);
        return;
      }

      if (shortcut === 'nextPane') {
        logShortcut('shortcut.global.nextPane');
        cyclePane(1);
        return;
      }

      if (shortcut === 'previousPane') {
        logShortcut('shortcut.global.previousPane');
        cyclePane(-1);
        return;
      }

      if (shortcut === 'jumpToLastAgent') {
        logShortcut('shortcut.global.jumpToLastAgent');
        jumpToNextUnacknowledgedAgent();
        return;
      }
    };

    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!isPrimaryModifier(event)) return;

      const editable = isEditableTarget(event.target);
      const key = event.key.toLowerCase();
      const isSlashKey = key === '/' || key === '?' || event.code === 'Slash';

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

      if (isSlashKey) {
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

      if (!event.shiftKey && !event.altKey && key === '.') {
        event.preventDefault();
        logShortcut('shortcut.global.jumpToLastAgent');
        jumpToNextUnacknowledgedAgent();
        return;
      }

      if (event.altKey && !event.shiftKey && key === 'n') {
        event.preventDefault();
        logShortcut('shortcut.global.openNarre');
        openNarreTab();
        return;
      }

      if (editable) return;

      if (event.altKey && !event.shiftKey && key === 'arrowright') {
        event.preventDefault();
        logShortcut('shortcut.global.nextPane');
        cyclePane(1);
        return;
      }

      if (event.altKey && !event.shiftKey && key === 'arrowleft') {
        event.preventDefault();
        logShortcut('shortcut.global.previousPane');
        cyclePane(-1);
        return;
      }

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

    window.addEventListener('keydown', handler, true);
    const cleanupAppShortcut = window.electron.window.onAppShortcut(handleAppShortcut);
    return () => {
      window.removeEventListener('keydown', handler, true);
      cleanupAppShortcut();
    };
  }, []);
}
