import { create } from 'zustand';
import type { EditorViewMode, EditorTab, EditorTabType, SplitNode, SplitDirection, SplitLeaf, SplitBranch } from '@moc/shared/types';
import { editorPrefsService } from '../services';

interface OpenTabParams {
  type: EditorTabType;
  targetId: string;
  title: string;
  viewMode?: EditorViewMode;
}

interface EditorStore {
  tabs: EditorTab[];
  activeTabId: string | null;

  // Split layout trees for side/full panes
  sideLayout: SplitNode | null;
  fullLayout: SplitNode | null;

  /** Generic open: works for concept, file, or any future type */
  openTab: (params: OpenTabParams) => Promise<void>;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  setViewMode: (tabId: string, mode: EditorViewMode) => void;
  toggleMinimize: (tabId: string) => void;

  updateFloatRect: (tabId: string, rect: Partial<EditorTab['floatRect']>) => void;
  updateSideSplitRatio: (tabId: string, ratio: number) => void;
  updateTitle: (tabId: string, title: string) => void;

  setActiveFile: (tabId: string, filePath: string | null) => void;
  setDirty: (tabId: string, dirty: boolean) => void;

  // Split layout operations
  splitTab: (targetTabId: string, newTabId: string, direction: SplitDirection, position: 'before' | 'after') => void;
  unsplitTab: (tabId: string) => void;
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

function findAndReplace(node: SplitNode, targetTabId: string, replacement: SplitNode): SplitNode | null {
  if (node.type === 'leaf') {
    return node.tabId === targetTabId ? replacement : null;
  }
  for (let i = 0; i < 2; i++) {
    const result = findAndReplace(node.children[i], targetTabId, replacement);
    if (result) {
      const newChildren = [...node.children] as [SplitNode, SplitNode];
      newChildren[i] = result;
      return { ...node, children: newChildren };
    }
  }
  return null;
}

function removeLeaf(node: SplitNode, tabId: string): SplitNode | null {
  if (node.type === 'leaf') {
    return node.tabId === tabId ? null : node;
  }
  const [left, right] = node.children;
  if (left.type === 'leaf' && left.tabId === tabId) return right;
  if (right.type === 'leaf' && right.tabId === tabId) return left;

  const newLeft = removeLeaf(left, tabId);
  if (newLeft !== left) {
    return newLeft ? { ...node, children: [newLeft, right] } : right;
  }
  const newRight = removeLeaf(right, tabId);
  if (newRight !== right) {
    return newRight ? { ...node, children: [left, newRight] } : left;
  }
  return node;
}

function containsTab(node: SplitNode, tabId: string): boolean {
  if (node.type === 'leaf') return node.tabId === tabId;
  return containsTab(node.children[0], tabId) || containsTab(node.children[1], tabId);
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

function addTabToLayout(layout: SplitNode | null, tabId: string): SplitNode {
  if (!layout) return { type: 'leaf', tabId };
  // If already in layout, no change
  if (containsTab(layout, tabId)) return layout;
  // Default: horizontal split appending to the right
  return {
    type: 'branch',
    direction: 'horizontal',
    ratio: 0.5,
    children: [layout, { type: 'leaf', tabId }],
  };
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  sideLayout: null,
  fullLayout: null,

  openTab: async ({ type, targetId, title, viewMode }) => {
    const { tabs } = get();
    const tabId = makeTabId(type, targetId);

    // Reuse existing tab
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      set({
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

    // Resolve view mode:
    // - Explicit viewMode param takes priority
    // - Prefs float/detached → use as-is (independent windows)
    // - Otherwise → follow current panel mode (side if any side tabs exist, else full if any full tabs, else side as default)
    let resolvedMode: EditorViewMode;
    if (viewMode) {
      resolvedMode = viewMode;
    } else {
      const savedMode = prefs?.view_mode as EditorViewMode | undefined;
      if (savedMode === 'float') {
        resolvedMode = 'float';
      } else {
        // Follow current panel mode
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
      isDirty: false,
      activeFilePath: null,
    };

    // Add to layout if side/full
    const layoutUpdate: Partial<EditorStore> = {};
    if (resolvedMode === 'side') {
      layoutUpdate.sideLayout = addTabToLayout(get().sideLayout, tabId);
    } else if (resolvedMode === 'full') {
      layoutUpdate.fullLayout = addTabToLayout(get().fullLayout, tabId);
    }

    set((s) => ({ ...layoutUpdate, tabs: [...s.tabs, tab], activeTabId: tabId }));
  },

  closeTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    // Save prefs before closing (concept tabs)
    if (tab && tab.type === 'concept') {
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

    // Remove from layout trees
    const layoutUpdate: Partial<EditorStore> = {};
    const { sideLayout, fullLayout } = get();
    if (sideLayout && containsTab(sideLayout, tabId)) {
      layoutUpdate.sideLayout = removeLeaf(sideLayout, tabId);
    }
    if (fullLayout && containsTab(fullLayout, tabId)) {
      layoutUpdate.fullLayout = removeLeaf(fullLayout, tabId);
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

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setViewMode: (tabId, mode) => {
    const oldTab = get().tabs.find((t) => t.id === tabId);
    if (!oldTab) return;

    const oldMode = oldTab.viewMode;

    // Detached mode: extract single tab to a separate Electron window
    if (mode === 'detached') {
      window.electron.editor.detach(tabId, oldTab.title);
      const layoutUpdate: Partial<EditorStore> = {};
      const { sideLayout, fullLayout } = get();
      if (oldMode === 'side' && sideLayout && containsTab(sideLayout, tabId)) {
        layoutUpdate.sideLayout = removeLeaf(sideLayout, tabId);
      }
      if (oldMode === 'full' && fullLayout && containsTab(fullLayout, tabId)) {
        layoutUpdate.fullLayout = removeLeaf(fullLayout, tabId);
      }
      set((s) => ({
        ...layoutUpdate,
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: 'detached' } : t)),
      }));
      if (oldTab.type === 'concept') {
        debouncedSavePrefs(oldTab.targetId, { view_mode: mode });
      }
      return;
    }

    // Float mode: extract single tab only
    if (mode === 'float') {
      const layoutUpdate: Partial<EditorStore> = {};
      const { sideLayout, fullLayout } = get();
      if (oldMode === 'side' && sideLayout && containsTab(sideLayout, tabId)) {
        layoutUpdate.sideLayout = removeLeaf(sideLayout, tabId);
      }
      if (oldMode === 'full' && fullLayout && containsTab(fullLayout, tabId)) {
        layoutUpdate.fullLayout = removeLeaf(fullLayout, tabId);
      }
      set((s) => ({
        ...layoutUpdate,
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: 'float' } : t)),
      }));
      if (oldTab.type === 'concept') {
        debouncedSavePrefs(oldTab.targetId, { view_mode: mode });
      }
      return;
    }

    // full ↔ side: group switch — all tabs in oldMode move together
    if ((oldMode === 'side' || oldMode === 'full') && (mode === 'side' || mode === 'full') && oldMode !== mode) {
      const tabsInOldMode = get().tabs.filter((t) => t.viewMode === oldMode && !t.isMinimized);
      const tabIds = tabsInOldMode.map((t) => t.id);

      // Transfer the entire layout tree from old mode to new mode
      const { sideLayout, fullLayout } = get();
      const layoutUpdate: Partial<EditorStore> = {};
      if (oldMode === 'side') {
        layoutUpdate.fullLayout = sideLayout; // move layout tree to full
        layoutUpdate.sideLayout = null;
      } else {
        layoutUpdate.sideLayout = fullLayout; // move layout tree to side
        layoutUpdate.fullLayout = null;
      }

      set((s) => ({
        ...layoutUpdate,
        tabs: s.tabs.map((t) => (tabIds.includes(t.id) ? { ...t, viewMode: mode } : t)),
      }));

      // Save prefs for concept tabs
      tabsInOldMode.forEach((t) => {
        if (t.type === 'concept') {
          debouncedSavePrefs(t.targetId, { view_mode: mode });
        }
      });
      return;
    }

    // Default: single tab joining side or full from float/detached/other
    const layoutUpdate: Partial<EditorStore> = {};
    if (mode === 'side') {
      layoutUpdate.sideLayout = addTabToLayout(get().sideLayout, tabId);
    } else if (mode === 'full') {
      layoutUpdate.fullLayout = addTabToLayout(get().fullLayout, tabId);
    }

    set((s) => ({
      ...layoutUpdate,
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: mode } : t)),
    }));

    if (oldTab.type === 'concept') {
      debouncedSavePrefs(oldTab.targetId, { view_mode: mode });
    }
  },

  toggleMinimize: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const mode = tab.viewMode;
    const newMinimized = !tab.isMinimized;

    // side/full: minimize/restore ALL tabs in the same mode together
    if (mode === 'side' || mode === 'full') {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.viewMode === mode ? { ...t, isMinimized: newMinimized } : t,
        ),
      }));
    } else {
      // float/detached: individual toggle
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, isMinimized: newMinimized } : t,
        ),
      }));
    }
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

  updateTitle: (tabId, title) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
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

  // ── Split layout operations ──

  splitTab: (targetTabId, newTabId, direction, position) => {
    const targetTab = get().tabs.find((t) => t.id === targetTabId);
    if (!targetTab) return;

    const mode = targetTab.viewMode;
    if (mode !== 'side' && mode !== 'full') return;

    const layout = getLayoutForMode(get(), mode);
    if (!layout) return;

    // Also set the new tab's viewMode to match
    const newTab = get().tabs.find((t) => t.id === newTabId);
    const tabUpdate = newTab && newTab.viewMode !== mode
      ? { tabs: get().tabs.map((t) => (t.id === newTabId ? { ...t, viewMode: mode } : t)) }
      : {};

    const newLeaf: SplitLeaf = { type: 'leaf', tabId: newTabId };
    const newBranch: SplitBranch = {
      type: 'branch',
      direction,
      ratio: 0.5,
      children: position === 'before'
        ? [newLeaf, { type: 'leaf', tabId: targetTabId }]
        : [{ type: 'leaf', tabId: targetTabId }, newLeaf],
    };

    const newLayout = findAndReplace(layout, targetTabId, newBranch);
    if (newLayout) {
      set({ ...setLayoutForMode(mode, newLayout), ...tabUpdate });
    }
  },

  unsplitTab: (tabId) => {
    const { sideLayout, fullLayout } = get();
    const layoutUpdate: Partial<EditorStore> = {};

    if (sideLayout && containsTab(sideLayout, tabId)) {
      layoutUpdate.sideLayout = removeLeaf(sideLayout, tabId);
    }
    if (fullLayout && containsTab(fullLayout, tabId)) {
      layoutUpdate.fullLayout = removeLeaf(fullLayout, tabId);
    }

    set(layoutUpdate);
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
