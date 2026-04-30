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
import { useProjectStore } from '../stores/project-store';
import { useConceptStore } from '../stores/concept-store';
import { useSchemaStore } from '../stores/schema-store';
import { useModelStore } from '../stores/model-store';
import { useTypeGroupStore } from '../stores/type-group-store';
import { useNetworkStore } from '../stores/network-store';
import { useModuleStore } from '../stores/module-store';
import type { EditorTab, Project, SplitNode } from '@netior/shared/types';

interface SyncState {
  tabs: EditorTab[];
  activeTabId: string | null;
  sideLayout: SplitNode | null;
  fullLayout: SplitNode | null;
  hosts: Record<string, { id: string; label: string; activeTabId: string | null }>;
  focusedHostId: string;
  currentProject: Project | null;
}

let _isSyncing = false;
let _syncScheduled = false;
let _unsubscribe: (() => void) | null = null;
let _projectUnsubscribe: (() => void) | null = null;
let _cleanupListener: (() => void) | null = null;

function getSyncState(): SyncState {
  const s = useEditorStore.getState();
  return {
    tabs: s.tabs,
    activeTabId: s.activeTabId,
    sideLayout: s.sideLayout,
    fullLayout: s.fullLayout,
    hosts: s.hosts,
    focusedHostId: s.focusedHostId,
    currentProject: useProjectStore.getState().currentProject,
  };
}

function applySyncState(state: SyncState): void {
  _isSyncing = true;
  console.log(`[Bridge] applySyncState — hosts=${JSON.stringify(Object.keys(state.hosts))}, tabs=${state.tabs.length}, focusedHost=${state.focusedHostId}`);
  useEditorStore.setState({
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    sideLayout: state.sideLayout,
    fullLayout: state.fullLayout,
    hosts: state.hosts,
    focusedHostId: state.focusedHostId,
  });

  // Sync project context for workspace stores
  const currentProject = useProjectStore.getState().currentProject;
  if (state.currentProject && currentProject?.id !== state.currentProject.id) {
    bootstrapWorkspaceStores(state.currentProject);
  } else if (!state.currentProject && currentProject) {
    // Project closed in main window
    useProjectStore.setState({ currentProject: null });
  }

  _isSyncing = false;
}

/** Hydrate workspace stores from DB so editors in detached windows have full context. */
function bootstrapWorkspaceStores(project: Project): void {
  // Set project directly (skip openProject's filesystem checks / state cache logic)
  useProjectStore.setState({ currentProject: project });

  const pid = project.id;
  useConceptStore.getState().loadByProject(pid);
  useSchemaStore.getState().loadByProject(pid);
  useModelStore.getState().loadByProject(pid);
  useTypeGroupStore.getState().loadByProject(pid);
  useNetworkStore.getState().loadNetworks(pid);
  useModuleStore.getState().loadModules(pid);
}

function schedulePush(): void {
  if (_syncScheduled || _isSyncing) return;
  _syncScheduled = true;
  queueMicrotask(() => {
    _syncScheduled = false;
    if (!_isSyncing) {
      const state = getSyncState();
      console.log(`[Bridge] pushState — hosts=${JSON.stringify(Object.keys(state.hosts))}, tabs=${state.tabs.length}`);
      window.electron.editor.pushState(state);
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
      state.hosts !== prev.hosts ||
      state.focusedHostId !== prev.focusedHostId
    ) {
      schedulePush();
    }
  });

  // Also track project changes (main window may switch/close project)
  _projectUnsubscribe = useProjectStore.subscribe((state, prev) => {
    if (_isSyncing) return;
    if (state.currentProject !== prev.currentProject) {
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

function cleanup(): void {
  _unsubscribe?.();
  _projectUnsubscribe?.();
  _cleanupListener?.();
  _unsubscribe = null;
  _projectUnsubscribe = null;
  _cleanupListener = null;
}

/** Initialize bridge for the main window. Pushes initial state and starts sync. */
export function initMainBridge(): () => void {
  // Push initial state so main process has a cache for detached windows that boot later
  window.electron.editor.pushState(getSyncState());

  startListener();
  startSubscription();

  return cleanup;
}

/** Initialize bridge for a detached window. Fetches state, then starts sync.
 *  If the cached state doesn't contain this window's hostId, waits for a sync
 *  message that does (up to a timeout). This prevents hydrating with stale state. */
export async function initDetachedBridge(expectedHostId?: string): Promise<() => void> {
  const cached = await window.electron.editor.getState();
  console.log(`[Bridge] initDetachedBridge — cached=${cached ? 'yes' : 'null'}, hosts=${cached ? JSON.stringify(Object.keys((cached as SyncState).hosts)) : 'N/A'}, expecting=${expectedHostId}`);

  const cachedState = cached as SyncState | null;
  const hostFound = !expectedHostId || (cachedState && expectedHostId in cachedState.hosts);

  if (cachedState && hostFound) {
    applySyncState(cachedState);
    startListener();
    startSubscription();
    return cleanup;
  }

  // Host not in cache yet — start listener and wait for a sync that includes it
  if (cachedState) {
    applySyncState(cachedState);
  }

  return new Promise<() => void>((resolve) => {
    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.log(`[Bridge] initDetachedBridge — timeout waiting for host ${expectedHostId}, proceeding with current state`);
      startSubscription();
      resolve(cleanup);
    }, 2000);

    _cleanupListener = window.electron.editor.onStateSync((rawState) => {
      if (_isSyncing) return;
      const state = rawState as SyncState;
      applySyncState(state);

      if (!resolved && expectedHostId && expectedHostId in state.hosts) {
        resolved = true;
        clearTimeout(timeoutId);
        console.log(`[Bridge] initDetachedBridge — host ${expectedHostId} found via sync`);
        startSubscription();
        resolve(cleanup);
      }
    });
  });
}
