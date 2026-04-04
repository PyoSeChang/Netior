/**
 * Cross-window editor state sync bridge.
 *
 * Problem: each BrowserWindow has its own renderer process with its own Zustand store.
 * The detached window's store starts empty — it has no tabs or hosts.
 *
 * Solution: main process caches the serializable portion of editor state and relays
 * changes between windows. Each window pushes state on mutation and applies incoming
 * state from the relay. A `_isSyncing` guard prevents echo loops.
 *
 * Flow:
 *   Window mutates store → subscribe fires → pushState to main process
 *   Main process caches + broadcasts to all OTHER windows
 *   Other windows receive → apply to local store (guarded)
 *
 * Detached window boot:
 *   getState from main process → hydrate local store → start listening
 */

import { useEditorStore } from '../stores/editor-store';
import type { EditorTab, SplitNode } from '@netior/shared/types';

interface SyncState {
  tabs: EditorTab[];
  activeTabId: string | null;
  sideLayout: SplitNode | null;
  fullLayout: SplitNode | null;
  hosts: Record<string, { id: string; label: string; activeTabId: string | null }>;
}

let _isSyncing = false;
let _syncScheduled = false;
let _unsubscribe: (() => void) | null = null;
let _cleanupListener: (() => void) | null = null;

function getSyncState(): SyncState {
  const s = useEditorStore.getState();
  return {
    tabs: s.tabs,
    activeTabId: s.activeTabId,
    sideLayout: s.sideLayout,
    fullLayout: s.fullLayout,
    hosts: s.hosts,
  };
}

function applySyncState(state: SyncState): void {
  _isSyncing = true;
  useEditorStore.setState({
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    sideLayout: state.sideLayout,
    fullLayout: state.fullLayout,
    hosts: state.hosts,
  });
  _isSyncing = false;
}

function schedulePush(): void {
  if (_syncScheduled || _isSyncing) return;
  _syncScheduled = true;
  queueMicrotask(() => {
    _syncScheduled = false;
    if (!_isSyncing) {
      window.electron.editor.pushState(getSyncState());
    }
  });
}

function startSubscription(): void {
  _unsubscribe = useEditorStore.subscribe((state, prev) => {
    if (_isSyncing) return;
    if (
      state.tabs !== prev.tabs ||
      state.activeTabId !== prev.activeTabId ||
      state.sideLayout !== prev.sideLayout ||
      state.fullLayout !== prev.fullLayout ||
      state.hosts !== prev.hosts
    ) {
      schedulePush();
    }
  });
}

function startListener(): void {
  _cleanupListener = window.electron.editor.onStateSync((rawState) => {
    if (_isSyncing) return;
    applySyncState(rawState as SyncState);
  });
}

/** Initialize bridge for the main window. Pushes initial state and starts sync. */
export function initMainBridge(): () => void {
  // Push initial state so main process has a cache for detached windows that boot later
  window.electron.editor.pushState(getSyncState());

  startListener();
  startSubscription();

  return () => {
    _unsubscribe?.();
    _cleanupListener?.();
    _unsubscribe = null;
    _cleanupListener = null;
  };
}

/** Initialize bridge for a detached window. Fetches state, then starts sync. */
export async function initDetachedBridge(): Promise<() => void> {
  // Fetch state cached by main process (from main window's last push)
  const cached = await window.electron.editor.getState();
  if (cached) {
    applySyncState(cached as SyncState);
  }

  startListener();
  startSubscription();

  return () => {
    _unsubscribe?.();
    _cleanupListener?.();
    _unsubscribe = null;
    _cleanupListener = null;
  };
}
