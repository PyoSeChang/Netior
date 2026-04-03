import { create } from 'zustand';
import type { EditorViewMode, EditorTab, EditorTabType, SplitNode, SplitDirection, SplitLeaf, SplitBranch } from '@netior/shared/types';
import { editorPrefsService } from '../services';
import { hasUnsavedChanges, getSession } from '../lib/editor-session-registry';
import { clearDraftCache } from '../hooks/useEditorSession';
import { isTerminalAlive } from '../lib/terminal-tracker';
import { cleanupSession as cleanupTodoSession } from '../lib/terminal-todo-store';

interface OpenTabParams {
  type: EditorTabType;
  targetId: string;
  title: string;
  viewMode?: EditorViewMode;
  draftData?: EditorTab['draftData'];
  canvasId?: string;
  terminalCwd?: string;
}

interface EditorStore {
  tabs: EditorTab[];
  activeTabId: string | null;

  // Split layout trees for side/full panes (each leaf holds its own tab list)
  sideLayout: SplitNode | null;
  fullLayout: SplitNode | null;

  /** Generic open: works for concept, file, or any future type */
  openTab: (params: OpenTabParams) => Promise<void>;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;

  setViewMode: (tabId: string, mode: EditorViewMode) => void;
  toggleMinimize: (tabId: string) => void;
  minimizeSingleTab: (tabId: string) => void;

  updateFloatRect: (tabId: string, rect: Partial<EditorTab['floatRect']>) => void;
  updateSideSplitRatio: (tabId: string, ratio: number) => void;
  updateTitle: (tabId: string, title: string, isManualRename?: boolean) => void;

  setActiveFile: (tabId: string, filePath: string | null) => void;
  setDirty: (tabId: string, dirty: boolean) => void;
  setEditorType: (tabId: string, editorType: string) => void;

  // Close confirmation
  pendingCloseTabId: string | null;
  requestCloseTab: (tabId: string) => void;
  confirmCloseTab: () => void;
  cancelCloseTab: () => void;
  saveAndCloseTab: () => Promise<void>;

  // Split layout operations
  splitTab: (targetTabId: string, newTabId: string, direction: SplitDirection, position: 'before' | 'after') => void;
  moveTabToPane: (tabId: string, targetPaneTabId: string, mode: 'side' | 'full') => void;
  updateSplitRatio: (mode: 'side' | 'full', path: number[], ratio: number) => void;

  clear: () => void;
}

const FLOAT_STAGGER = 30;
const DEFAULT_FLOAT_RECT = { x: 120, y: 80, width: 600, height: 450 };

let floatSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debouncedSavePrefs(targetId: string, data: Record<string, unknown>) {
  if (floatSaveTimers[targetId]) {
    clearTimeout(floatSaveTimers[targetId]);
  }
  floatSaveTimers[targetId] = setTimeout(() => {
    editorPrefsService.upsert(targetId, data).catch((err) => {
      console.error('[EditorPrefs] Failed to save prefs:', targetId, err);
    });
    delete floatSaveTimers[targetId];
  }, 300);
}

function makeTabId(type: EditorTabType, targetId: string): string {
  return `${type}:${targetId}`;
}

// ── Split layout tree helpers ──

export function containsTab(node: SplitNode, tabId: string): boolean {
  if (node.type === 'leaf') return node.tabIds.includes(tabId);
  return containsTab(node.children[0], tabId) || containsTab(node.children[1], tabId);
}

function findLeafWithTab(node: SplitNode, tabId: string): SplitLeaf | null {
  if (node.type === 'leaf') return node.tabIds.includes(tabId) ? node : null;
  return findLeafWithTab(node.children[0], tabId) || findLeafWithTab(node.children[1], tabId);
}

function getFirstLeaf(node: SplitNode): SplitLeaf {
  if (node.type === 'leaf') return node;
  return getFirstLeaf(node.children[0]);
}

/** Returns the focused tab id in the layout (global active if present, else first leaf's active) */
export function getActiveTabFromLayout(layout: SplitNode, globalActiveTabId: string | null): string {
  if (globalActiveTabId && containsTab(layout, globalActiveTabId)) {
    return globalActiveTabId;
  }
  return getFirstLeaf(layout).activeTabId;
}

function setActiveInLeaf(node: SplitNode, tabId: string): SplitNode {
  if (node.type === 'leaf') {
    if (!node.tabIds.includes(tabId)) return node;
    return node.activeTabId === tabId ? node : { ...node, activeTabId: tabId };
  }
  const newChildren = [...node.children] as [SplitNode, SplitNode];
  newChildren[0] = setActiveInLeaf(node.children[0], tabId);
  newChildren[1] = setActiveInLeaf(node.children[1], tabId);
  if (newChildren[0] === node.children[0] && newChildren[1] === node.children[1]) return node;
  return { ...node, children: newChildren };
}

/** Remove a tab from the tree. If a leaf becomes empty, collapse it. */
function removeTabFromTree(node: SplitNode, tabId: string): SplitNode | null {
  if (node.type === 'leaf') {
    if (!node.tabIds.includes(tabId)) return node;
    const newTabIds = node.tabIds.filter((id) => id !== tabId);
    if (newTabIds.length === 0) return null;
    return {
      ...node,
      tabIds: newTabIds,
      activeTabId: node.activeTabId === tabId ? newTabIds[newTabIds.length - 1] : node.activeTabId,
    };
  }
  const [left, right] = node.children;
  const newLeft = removeTabFromTree(left, tabId);
  if (newLeft !== left) {
    if (!newLeft) return right;
    return { ...node, children: [newLeft, right] };
  }
  const newRight = removeTabFromTree(right, tabId);
  if (newRight !== right) {
    if (!newRight) return left;
    return { ...node, children: [left, newRight] };
  }
  return node;
}

/** Add a tab to the leaf identified by targetLeafTabId */
function addTabToLeaf(node: SplitNode, targetLeafTabId: string, newTabId: string): SplitNode {
  if (node.type === 'leaf') {
    if (!node.tabIds.includes(targetLeafTabId)) return node;
    if (node.tabIds.includes(newTabId)) return { ...node, activeTabId: newTabId };
    return { ...node, tabIds: [...node.tabIds, newTabId], activeTabId: newTabId };
  }
  const newLeft = addTabToLeaf(node.children[0], targetLeafTabId, newTabId);
  if (newLeft !== node.children[0]) return { ...node, children: [newLeft, node.children[1]] };
  const newRight = addTabToLeaf(node.children[1], targetLeafTabId, newTabId);
  if (newRight !== node.children[1]) return { ...node, children: [node.children[0], newRight] };
  return node;
}

/** Split the leaf containing targetTabId: original leaf keeps its tabs, new leaf gets newTabId */
function splitLeafContaining(
  node: SplitNode,
  targetTabId: string,
  newTabId: string,
  direction: SplitDirection,
  position: 'before' | 'after',
): SplitNode | null {
  if (node.type === 'leaf') {
    if (!node.tabIds.includes(targetTabId)) return null;
    const newLeaf: SplitLeaf = { type: 'leaf', tabIds: [newTabId], activeTabId: newTabId };
    const origLeaf: SplitLeaf = { ...node, activeTabId: targetTabId };
    const branch: SplitBranch = {
      type: 'branch',
      direction,
      ratio: 0.5,
      children: position === 'before' ? [newLeaf, origLeaf] : [origLeaf, newLeaf],
    };
    return branch;
  }
  for (let i = 0; i < 2; i++) {
    const result = splitLeafContaining(node.children[i], targetTabId, newTabId, direction, position);
    if (result) {
      const newChildren = [...node.children] as [SplitNode, SplitNode];
      newChildren[i] = result;
      return { ...node, children: newChildren };
    }
  }
  return null;
}

function updateRatioAtPath(node: SplitNode, path: number[], ratio: number): SplitNode {
  if (path.length === 0 && node.type === 'branch') {
    return { ...node, ratio: Math.max(0.15, Math.min(0.85, ratio)) };
  }
  if (node.type === 'branch' && path.length > 0) {
    const [head, ...rest] = path;
    const newChildren = [...node.children] as [SplitNode, SplitNode];
    newChildren[head] = updateRatioAtPath(newChildren[head], rest, ratio);
    return { ...node, children: newChildren };
  }
  return node;
}

function getLayoutForMode(state: EditorStore, mode: EditorViewMode): SplitNode | null {
  return mode === 'side' ? state.sideLayout : mode === 'full' ? state.fullLayout : null;
}

function setLayoutForMode(mode: EditorViewMode, layout: SplitNode | null): Partial<EditorStore> {
  return mode === 'side' ? { sideLayout: layout } : { fullLayout: layout };
}

/** Remove tabId from the layout of oldMode (if present) */
function removeFromLayout(state: EditorStore, oldMode: EditorViewMode, tabId: string): Partial<EditorStore> {
  const update: Partial<EditorStore> = {};
  if (oldMode === 'side' && state.sideLayout && containsTab(state.sideLayout, tabId)) {
    update.sideLayout = removeTabFromTree(state.sideLayout, tabId);
  }
  if (oldMode === 'full' && state.fullLayout && containsTab(state.fullLayout, tabId)) {
    update.fullLayout = removeTabFromTree(state.fullLayout, tabId);
  }
  return update;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  sideLayout: null,
  fullLayout: null,
  pendingCloseTabId: null,

  openTab: async ({ type, targetId, title, viewMode, draftData, canvasId, terminalCwd }) => {
    const { tabs } = get();
    const tabId = makeTabId(type, targetId);

    // Reuse existing tab
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      const layoutUpdate: Partial<EditorStore> = {};
      const { sideLayout, fullLayout } = get();
      if (sideLayout && containsTab(sideLayout, tabId)) {
        layoutUpdate.sideLayout = setActiveInLeaf(sideLayout, tabId);
      }
      if (fullLayout && containsTab(fullLayout, tabId)) {
        layoutUpdate.fullLayout = setActiveInLeaf(fullLayout, tabId);
      }
      set({
        ...layoutUpdate,
        activeTabId: tabId,
        tabs: tabs.map((t) => (t.id === tabId ? { ...t, isMinimized: false } : t)),
      });
      return;
    }

    // Load prefs (concept tabs only)
    let prefs;
    if (type === 'concept') {
      try {
        prefs = await editorPrefsService.get(targetId);
      } catch (err) {
        console.error('[EditorPrefs] Failed to load prefs:', targetId, err);
      }
    }

    const floatCount = tabs.filter((t) => t.viewMode === 'float' && !t.isMinimized).length;
    const stagger = floatCount * FLOAT_STAGGER;

    // Resolve view mode
    let resolvedMode: EditorViewMode;
    if (viewMode) {
      resolvedMode = viewMode;
    } else {
      const savedMode = prefs?.view_mode as EditorViewMode | undefined;
      if (savedMode === 'float') {
        resolvedMode = 'float';
      } else {
        const hasSide = tabs.some((t) => t.viewMode === 'side' && !t.isMinimized);
        const hasFull = tabs.some((t) => t.viewMode === 'full' && !t.isMinimized);
        resolvedMode = hasFull ? 'full' : hasSide ? 'side' : 'side';
      }
    }

    const tab: EditorTab = {
      id: tabId,
      type,
      targetId,
      title,
      viewMode: resolvedMode,
      floatRect: {
        x: prefs?.float_x ?? DEFAULT_FLOAT_RECT.x + stagger,
        y: prefs?.float_y ?? DEFAULT_FLOAT_RECT.y + stagger,
        width: prefs?.float_width ?? DEFAULT_FLOAT_RECT.width,
        height: prefs?.float_height ?? DEFAULT_FLOAT_RECT.height,
      },
      isMinimized: false,
      sideSplitRatio: prefs?.side_split_ratio ?? 0.5,
      isDirty: !!draftData,
      activeFilePath: null,
      draftData,
      canvasId,
      terminalCwd,
    };

    // For side/full: add to the focused leaf in the layout tree
    if (resolvedMode === 'side' || resolvedMode === 'full') {
      let layout = getLayoutForMode(get(), resolvedMode);
      if (!layout) {
        layout = { type: 'leaf', tabIds: [tabId], activeTabId: tabId };
      } else {
        const { activeTabId: currentActive } = get();
        const focusedLeaf = currentActive ? findLeafWithTab(layout, currentActive) : null;
        const targetLeafTabId = focusedLeaf ? focusedLeaf.activeTabId : getFirstLeaf(layout).activeTabId;
        layout = addTabToLeaf(layout, targetLeafTabId, tabId);
      }
      set((s) => ({
        ...setLayoutForMode(resolvedMode, layout),
        tabs: [...s.tabs, tab],
        activeTabId: tabId,
      }));
    } else {
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tabId }));
    }
  },

  closeTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab && tab.type === 'terminal') {
      window.electron.terminal.shutdown(tab.targetId).catch(() => {});
      cleanupTodoSession(tab.targetId);
    }
    if (tab && tab.type === 'concept' && !tab.targetId.startsWith('draft-')) {
      editorPrefsService.upsert(tab.targetId, {
        view_mode: tab.viewMode,
        float_x: tab.floatRect.x,
        float_y: tab.floatRect.y,
        float_width: tab.floatRect.width,
        float_height: tab.floatRect.height,
        side_split_ratio: tab.sideSplitRatio,
      }).catch((err) => {
        console.error('[EditorPrefs] Failed to save on close:', tab.targetId, err);
      });
    }

    clearDraftCache(tabId);

    // Remove from layout trees
    const layoutUpdate: Partial<EditorStore> = {};
    const { sideLayout, fullLayout } = get();
    if (sideLayout && containsTab(sideLayout, tabId)) {
      layoutUpdate.sideLayout = removeTabFromTree(sideLayout, tabId);
    }
    if (fullLayout && containsTab(fullLayout, tabId)) {
      layoutUpdate.fullLayout = removeTabFromTree(fullLayout, tabId);
    }

    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== tabId);
      const activeTabId =
        s.activeTabId === tabId
          ? tabs.length > 0 ? tabs[tabs.length - 1].id : null
          : s.activeTabId;
      return { ...layoutUpdate, tabs, activeTabId };
    });
  },

  closeOtherTabs: (tabId) => {
    const { tabs } = get();
    const toClose = tabs.filter((t) => t.id !== tabId);
    for (const t of toClose) get().closeTab(t.id);
  },

  closeTabsToRight: (tabId) => {
    const { tabs } = get();
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;
    const toClose = tabs.slice(idx + 1);
    for (const t of toClose) get().closeTab(t.id);
  },

  closeAllTabs: () => {
    const { tabs } = get();
    for (const t of [...tabs]) get().closeTab(t.id);
  },

  setActiveTab: (tabId) => {
    const layoutUpdate: Partial<EditorStore> = {};
    const { sideLayout, fullLayout } = get();
    if (sideLayout && containsTab(sideLayout, tabId)) {
      layoutUpdate.sideLayout = setActiveInLeaf(sideLayout, tabId);
    }
    if (fullLayout && containsTab(fullLayout, tabId)) {
      layoutUpdate.fullLayout = setActiveInLeaf(fullLayout, tabId);
    }
    set({ ...layoutUpdate, activeTabId: tabId });
  },

  setViewMode: (tabId, mode) => {
    const oldTab = get().tabs.find((t) => t.id === tabId);
    if (!oldTab) return;

    const oldMode = oldTab.viewMode;

    // Detached mode
    if (mode === 'detached') {
      window.electron.editor.detach(tabId, oldTab.title);
      const layoutUpdate = removeFromLayout(get(), oldMode, tabId);
      set((s) => ({
        ...layoutUpdate,
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: 'detached' } : t)),
      }));
      if (oldTab.type === 'concept') debouncedSavePrefs(oldTab.targetId, { view_mode: mode });
      return;
    }

    // Float mode
    if (mode === 'float') {
      const layoutUpdate = removeFromLayout(get(), oldMode, tabId);
      set((s) => ({
        ...layoutUpdate,
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: 'float' } : t)),
      }));
      if (oldTab.type === 'concept') debouncedSavePrefs(oldTab.targetId, { view_mode: mode });
      return;
    }

    // full ↔ side: group switch — all tabs in oldMode move together, layout tree transfers
    if ((oldMode === 'side' || oldMode === 'full') && (mode === 'side' || mode === 'full') && oldMode !== mode) {
      const tabsInOldMode = get().tabs.filter((t) => t.viewMode === oldMode);
      const tabIds = tabsInOldMode.map((t) => t.id);

      const { sideLayout, fullLayout } = get();
      const layoutUpdate: Partial<EditorStore> = {};
      if (oldMode === 'side') {
        layoutUpdate.fullLayout = sideLayout;
        layoutUpdate.sideLayout = null;
      } else {
        layoutUpdate.sideLayout = fullLayout;
        layoutUpdate.fullLayout = null;
      }

      set((s) => ({
        ...layoutUpdate,
        tabs: s.tabs.map((t) => (tabIds.includes(t.id) ? { ...t, viewMode: mode } : t)),
      }));

      tabsInOldMode.forEach((t) => {
        if (t.type === 'concept') debouncedSavePrefs(t.targetId, { view_mode: mode });
      });
      return;
    }

    // Default: single tab joining side or full from float/detached/other
    if (mode === 'side' || mode === 'full') {
      let layout = getLayoutForMode(get(), mode);
      if (!layout) {
        layout = { type: 'leaf', tabIds: [tabId], activeTabId: tabId };
      } else {
        const { activeTabId: currentActive } = get();
        const focusedLeaf = currentActive ? findLeafWithTab(layout, currentActive) : null;
        const targetLeafTabId = focusedLeaf ? focusedLeaf.activeTabId : getFirstLeaf(layout).activeTabId;
        layout = addTabToLeaf(layout, targetLeafTabId, tabId);
      }
      set((s) => ({
        ...setLayoutForMode(mode, layout),
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: mode, isMinimized: false } : t)),
      }));
    } else {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: mode } : t)),
      }));
    }

    if (oldTab.type === 'concept') debouncedSavePrefs(oldTab.targetId, { view_mode: mode });
  },

  toggleMinimize: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const mode = tab.viewMode;
    const newMinimized = !tab.isMinimized;

    if (mode === 'side' || mode === 'full') {
      if (!newMinimized) {
        // Restoring: re-insert tabs that are not in the layout tree
        const layout = getLayoutForMode(get(), mode);
        let layoutUpdate: Partial<EditorStore> = {};
        const tabsInMode = get().tabs.filter((t) => t.viewMode === mode && t.isMinimized);
        let currentLayout = layout;
        for (const t of tabsInMode) {
          if (currentLayout && !containsTab(currentLayout, t.id)) {
            const firstLeaf = getFirstLeaf(currentLayout);
            currentLayout = addTabToLeaf(currentLayout, firstLeaf.activeTabId, t.id);
          } else if (!currentLayout) {
            currentLayout = { type: 'leaf', tabIds: [t.id], activeTabId: t.id };
          }
        }
        if (currentLayout !== layout) {
          layoutUpdate = setLayoutForMode(mode, currentLayout);
        }
        set((s) => ({
          ...layoutUpdate,
          tabs: s.tabs.map((t) =>
            t.viewMode === mode ? { ...t, isMinimized: false } : t,
          ),
        }));
      } else {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.viewMode === mode ? { ...t, isMinimized: true } : t,
          ),
        }));
      }
    } else {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, isMinimized: newMinimized } : t,
        ),
      }));
    }
  },

  minimizeSingleTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || tab.isMinimized) return;

    const mode = tab.viewMode;
    let layoutUpdate: Partial<EditorStore> = {};

    if (mode === 'side' || mode === 'full') {
      const layout = getLayoutForMode(get(), mode);
      if (layout && containsTab(layout, tabId)) {
        const newLayout = removeTabFromTree(layout, tabId);
        layoutUpdate = setLayoutForMode(mode, newLayout);
      }
    }

    set((s) => ({
      ...layoutUpdate,
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, isMinimized: true } : t,
      ),
    }));
  },

  updateFloatRect: (tabId, rect) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, floatRect: { ...t.floatRect, ...rect } } : t,
      ),
    }));
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab?.type === 'concept') {
      const merged = { ...tab.floatRect, ...rect };
      debouncedSavePrefs(tab.targetId, {
        float_x: merged.x, float_y: merged.y,
        float_width: merged.width, float_height: merged.height,
      });
    }
  },

  updateSideSplitRatio: (tabId, ratio) => {
    const clamped = Math.max(0.2, Math.min(0.8, ratio));
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, sideSplitRatio: clamped } : t,
      ),
    }));
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab?.type === 'concept') {
      debouncedSavePrefs(tab.targetId, { side_split_ratio: clamped });
    }
  },

  updateTitle: (tabId, title, isManualRename = false) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        if (t.isManuallyRenamed && !isManualRename) return t;
        return { ...t, title, ...(isManualRename ? { isManuallyRenamed: true } : {}) };
      }),
    }));
  },

  setActiveFile: (tabId, filePath) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, activeFilePath: filePath } : t,
      ),
    }));
  },

  setDirty: (tabId, dirty) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isDirty: dirty } : t)),
    }));
  },

  setEditorType: (tabId, editorType) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, editorType } : t)),
    }));
  },

  // ── Close confirmation ──

  requestCloseTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab?.type === 'terminal' && isTerminalAlive(tab.targetId)) {
      set({ pendingCloseTabId: tabId });
    } else if (hasUnsavedChanges(tabId)) {
      set({ pendingCloseTabId: tabId });
    } else {
      get().closeTab(tabId);
    }
  },

  confirmCloseTab: () => {
    const { pendingCloseTabId } = get();
    if (pendingCloseTabId) {
      get().closeTab(pendingCloseTabId);
      set({ pendingCloseTabId: null });
    }
  },

  cancelCloseTab: () => {
    set({ pendingCloseTabId: null });
  },

  saveAndCloseTab: async () => {
    const { pendingCloseTabId } = get();
    if (!pendingCloseTabId) return;
    const session = getSession(pendingCloseTabId);
    if (session) await session.save();
    get().closeTab(pendingCloseTabId);
    set({ pendingCloseTabId: null });
  },

  // ── Split layout operations ──

  splitTab: (targetTabId, newTabId, direction, position) => {
    if (targetTabId === newTabId) return;

    const targetTab = get().tabs.find((t) => t.id === targetTabId);
    if (!targetTab) return;

    const mode = targetTab.viewMode;
    if (mode !== 'side' && mode !== 'full') return;

    let layout = getLayoutForMode(get(), mode);
    if (!layout) return;

    const newTab = get().tabs.find((t) => t.id === newTabId);
    if (!newTab) return;

    // Remove newTab from this layout if already present (it gets its own leaf)
    if (containsTab(layout, newTabId)) {
      const result = removeTabFromTree(layout, newTabId);
      if (!result) return;
      layout = result;
    }

    // Remove from old mode's layout if different
    const oldLayoutUpdate: Partial<EditorStore> = {};
    if (newTab.viewMode !== mode && (newTab.viewMode === 'side' || newTab.viewMode === 'full')) {
      Object.assign(oldLayoutUpdate, removeFromLayout(get(), newTab.viewMode, newTabId));
    }

    const newLayout = splitLeafContaining(layout, targetTabId, newTabId, direction, position);
    if (newLayout) {
      set((s) => ({
        ...oldLayoutUpdate,
        ...setLayoutForMode(mode, newLayout),
        tabs: s.tabs.map((t) => (t.id === newTabId ? { ...t, viewMode: mode, isMinimized: false } : t)),
        activeTabId: newTabId,
      }));
    }
  },

  moveTabToPane: (tabId, targetPaneTabId, mode) => {
    if (tabId === targetPaneTabId) return;

    let layout = getLayoutForMode(get(), mode);
    if (!layout) return;

    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Remove from old mode's layout if different
    const oldLayoutUpdate: Partial<EditorStore> = {};
    if (tab.viewMode !== mode && (tab.viewMode === 'side' || tab.viewMode === 'full')) {
      Object.assign(oldLayoutUpdate, removeFromLayout(get(), tab.viewMode, tabId));
    }

    // Remove from current position in same layout (if present, e.g. moving between panes)
    if (containsTab(layout, tabId)) {
      const result = removeTabFromTree(layout, tabId);
      if (!result) return;
      layout = result;
    }

    // Add to target leaf
    layout = addTabToLeaf(layout, targetPaneTabId, tabId);

    set((s) => ({
      ...oldLayoutUpdate,
      ...setLayoutForMode(mode, layout!),
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: mode, isMinimized: false } : t)),
      activeTabId: tabId,
    }));
  },

  updateSplitRatio: (mode, path, ratio) => {
    const layout = mode === 'side' ? get().sideLayout : get().fullLayout;
    if (!layout) return;
    const newLayout = updateRatioAtPath(layout, path, ratio);
    set(setLayoutForMode(mode, newLayout));
  },

  clear: () => {
    Object.values(floatSaveTimers).forEach(clearTimeout);
    floatSaveTimers = {};
    set({ tabs: [], activeTabId: null, sideLayout: null, fullLayout: null });
  },
}));
