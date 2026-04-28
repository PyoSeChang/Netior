import { create } from 'zustand';
import type {
  EditorViewMode,
  EditorTab,
  EditorTabType,
  SplitNode,
  SplitDirection,
  SplitLeaf,
  SplitBranch,
  TerminalLaunchConfig,
} from '@netior/shared/types';
import { editorPrefsService } from '../services';
import { hasUnsavedChanges, getSession } from '../lib/editor-session-registry';
import { clearDraftCache } from '../hooks/useEditorSession';
import { clearViewState } from '../hooks/useViewState';
import { isTerminalAlive } from '../lib/terminal-tracker';
import { cleanupSession as cleanupTodoSession } from '../lib/terminal-todo-store';
import { coerceViewModeForTab } from '../lib/editor-view-mode-rules';

export const MAIN_HOST_ID = 'main';

interface DetachedHostState {
  id: string;
  label: string;
  activeTabId: string | null;
}

interface OpenTabParams {
  type: EditorTabType;
  targetId: string;
  title: string;
  viewMode?: EditorViewMode;
  isDirty?: boolean;
  draftData?: EditorTab['draftData'];
  projectId?: string;
  networkId?: string;
  nodeId?: string;
  terminalCwd?: string;
  terminalLaunchConfig?: Pick<TerminalLaunchConfig, 'shell' | 'args' | 'agent'>;
  sideSplitRatio?: number;
  /** Host to open the tab in (defaults to MAIN_HOST_ID) */
  hostId?: string;
}

interface EditorStore {
  tabs: EditorTab[];

  // Main host state (backward-compatible top-level fields)
  activeTabId: string | null;
  sideLayout: SplitNode | null;
  fullLayout: SplitNode | null;
  sideLastActiveTabId: string | null;
  fullLastActiveTabId: string | null;

  // Host management
  hosts: Record<string, DetachedHostState>;
  focusedHostId: string;

  // Tab operations
  openTab: (params: OpenTabParams) => Promise<void>;
  navigateTab: (
    tabId: string,
    params: Omit<OpenTabParams, 'hostId' | 'viewMode' | 'sideSplitRatio'>,
  ) => void;
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
  setStale: (tabId: string, stale: boolean) => void;
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
  moveTabWithinStrip: (tabId: string, targetTabId: string, position: 'before' | 'after') => void;
  updateSplitRatio: (mode: 'side' | 'full', path: number[], ratio: number) => void;

  // Host operations
  createHost: (label?: string) => string;
  removeHost: (hostId: string) => void;
  detachTab: (tabId: string) => string;
  reattachTab: (tabId: string) => void;
  moveTabToHost: (tabId: string, targetHostId: string, viewMode?: EditorViewMode) => void;
  setHostActiveTab: (hostId: string, tabId: string) => void;
  getHostTabs: (hostId: string) => EditorTab[];
  setFocusedHost: (hostId: string) => void;

  clear: () => void;
}

const FLOAT_STAGGER = 30;
const DEFAULT_FLOAT_RECT = { x: 120, y: 80, width: 600, height: 450 };
const MIN_FLOAT_WIDTH = 300;
const MIN_FLOAT_HEIGHT = 200;
const FLOAT_VIEWPORT_MARGIN = 16;

let floatSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

interface MinimizedRestoreHint {
  mode: 'side' | 'full';
  layoutBeforeMinimize: SplitNode;
  layoutAfterMinimizeSignature: string;
  leafPath: number[];
  activeTabId: string | null;
  siblingTabIds: string[];
}

const minimizedRestoreHints = new Map<string, MinimizedRestoreHint>();

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

function sanitizeFloatDimension(value: number | undefined, fallback: number, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, value);
}

function sanitizeFloatCoordinate(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

function normalizeFloatRect(rect: EditorTab['floatRect']): EditorTab['floatRect'] {
  const width = sanitizeFloatDimension(rect.width, DEFAULT_FLOAT_RECT.width, MIN_FLOAT_WIDTH);
  const height = sanitizeFloatDimension(rect.height, DEFAULT_FLOAT_RECT.height, MIN_FLOAT_HEIGHT);
  const fallbackX = sanitizeFloatCoordinate(rect.x, DEFAULT_FLOAT_RECT.x);
  const fallbackY = sanitizeFloatCoordinate(rect.y, DEFAULT_FLOAT_RECT.y);

  if (typeof window === 'undefined') {
    return { x: fallbackX, y: fallbackY, width, height };
  }

  const viewportWidth = Math.max(window.innerWidth, width + FLOAT_VIEWPORT_MARGIN * 2);
  const viewportHeight = Math.max(window.innerHeight, height + FLOAT_VIEWPORT_MARGIN * 2);
  const minX = FLOAT_VIEWPORT_MARGIN;
  const minY = FLOAT_VIEWPORT_MARGIN;
  const maxX = Math.max(minX, viewportWidth - width - FLOAT_VIEWPORT_MARGIN);
  const maxY = Math.max(minY, viewportHeight - height - FLOAT_VIEWPORT_MARGIN);

  return {
    x: Math.min(Math.max(fallbackX, minX), maxX),
    y: Math.min(Math.max(fallbackY, minY), maxY),
    width,
    height,
  };
}

function makeTabId(type: EditorTabType, targetId: string): string {
  return `${type}:${targetId}`;
}

let hostCounter = 0;

function makeHostId(): string {
  return `detached:${Date.now()}-${++hostCounter}`;
}

function closeDetachedHostSoon(hostId: string): void {
  console.log(`[EditorStore] schedule closeDetachedWindow hostId=${hostId}`);
  setTimeout(() => {
    console.log(`[EditorStore] closeDetachedWindow hostId=${hostId}`);
    window.electron.editor.closeDetachedWindow(hostId);
  }, 0);
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

function findLeafPathWithTab(node: SplitNode, tabId: string, path: number[] = []): number[] | null {
  if (node.type === 'leaf') return node.tabIds.includes(tabId) ? path : null;
  return findLeafPathWithTab(node.children[0], tabId, [...path, 0])
    ?? findLeafPathWithTab(node.children[1], tabId, [...path, 1]);
}

function getNodeAtPath(node: SplitNode, path: number[]): SplitNode | null {
  let current: SplitNode = node;
  for (const index of path) {
    if (current.type !== 'branch') return null;
    current = current.children[index];
  }
  return current;
}

function getLeafAtPath(node: SplitNode, path: number[]): SplitLeaf | null {
  const current = getNodeAtPath(node, path);
  return current?.type === 'leaf' ? current : null;
}

function getFirstLeaf(node: SplitNode): SplitLeaf {
  if (node.type === 'leaf') return node;
  return getFirstLeaf(node.children[0]);
}

function getLastLeaf(node: SplitNode): SplitLeaf {
  if (node.type === 'leaf') return node;
  return getLastLeaf(node.children[1]);
}

/** Collect all leaves in document order (left→right, top→bottom) */
export function collectLeaves(node: SplitNode): SplitLeaf[] {
  if (node.type === 'leaf') return [node];
  return [...collectLeaves(node.children[0]), ...collectLeaves(node.children[1])];
}

/** Get the leaf containing activeTabId from the active layout, or null (float/detached) */
export function getActiveLeaf(): { leaf: SplitLeaf; mode: 'side' | 'full' } | null {
  const { activeTabId, sideLayout, fullLayout } = useEditorStore.getState();
  if (!activeTabId) return null;

  if (sideLayout) {
    const leaf = findLeafWithTab(sideLayout, activeTabId);
    if (leaf) return { leaf, mode: 'side' };
  }
  if (fullLayout) {
    const leaf = findLeafWithTab(fullLayout, activeTabId);
    if (leaf) return { leaf, mode: 'full' };
  }
  return null;
}

/** Returns the focused tab id in the layout (global active if present, else first leaf's active) */
export function getActiveTabFromLayout(layout: SplitNode, globalActiveTabId: string | null): string {
  if (globalActiveTabId && containsTab(layout, globalActiveTabId)) {
    return globalActiveTabId;
  }
  return getFirstLeaf(layout).activeTabId;
}

export function getRememberedActiveTabFromLayout(layout: SplitNode, rememberedTabId: string | null): string {
  if (rememberedTabId && containsTab(layout, rememberedTabId)) {
    return rememberedTabId;
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

function replaceTabIdInTree(node: SplitNode, oldTabId: string, newTabId: string): SplitNode {
  if (node.type === 'leaf') {
    if (!node.tabIds.includes(oldTabId)) return node;
    const nextTabIds = node.tabIds
      .map((id) => (id === oldTabId ? newTabId : id))
      .filter((id, index, items) => items.indexOf(id) === index);
    const nextActiveTabId = node.activeTabId === oldTabId ? newTabId : node.activeTabId;
    return {
      ...node,
      tabIds: nextTabIds,
      activeTabId: nextActiveTabId,
    };
  }

  const newChildren = [...node.children] as [SplitNode, SplitNode];
  newChildren[0] = replaceTabIdInTree(node.children[0], oldTabId, newTabId);
  newChildren[1] = replaceTabIdInTree(node.children[1], oldTabId, newTabId);
  if (newChildren[0] === node.children[0] && newChildren[1] === node.children[1]) return node;
  return { ...node, children: newChildren };
}

interface RemoveResult {
  tree: SplitNode | null;
  fallbackTabId: string | null;
}

/** Remove a tab from the tree. If a leaf becomes empty, collapse it. Returns fallback tab for active selection. */
function removeTabFromTree(node: SplitNode, tabId: string): RemoveResult {
  if (node.type === 'leaf') {
    if (!node.tabIds.includes(tabId)) return { tree: node, fallbackTabId: null };
    const newTabIds = node.tabIds.filter((id) => id !== tabId);
    if (newTabIds.length === 0) return { tree: null, fallbackTabId: null };
    const newActiveTabId = node.activeTabId === tabId ? newTabIds[newTabIds.length - 1] : node.activeTabId;
    return {
      tree: { ...node, tabIds: newTabIds, activeTabId: newActiveTabId },
      fallbackTabId: newActiveTabId,
    };
  }
  const [left, right] = node.children;
  const leftResult = removeTabFromTree(left, tabId);
  if (leftResult.tree !== left) {
    if (!leftResult.tree) {
      return { tree: right, fallbackTabId: leftResult.fallbackTabId ?? getFirstLeaf(right).activeTabId };
    }
    return { tree: { ...node, children: [leftResult.tree, right] }, fallbackTabId: leftResult.fallbackTabId };
  }
  const rightResult = removeTabFromTree(right, tabId);
  if (rightResult.tree !== right) {
    if (!rightResult.tree) {
      return { tree: left, fallbackTabId: rightResult.fallbackTabId ?? getLastLeaf(left).activeTabId };
    }
    return { tree: { ...node, children: [left, rightResult.tree] }, fallbackTabId: rightResult.fallbackTabId };
  }
  return { tree: node, fallbackTabId: null };
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

function insertTabNearTab(
  node: SplitNode,
  targetTabId: string,
  tabId: string,
  position: 'before' | 'after',
  activateMovedTab: boolean,
): SplitNode {
  if (node.type === 'leaf') {
    if (!node.tabIds.includes(targetTabId)) return node;
    const tabIdsWithoutMoving = node.tabIds.filter((id) => id !== tabId);
    const targetIndex = tabIdsWithoutMoving.indexOf(targetTabId);
    if (targetIndex < 0) return node;
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    const nextTabIds = [
      ...tabIdsWithoutMoving.slice(0, insertIndex),
      tabId,
      ...tabIdsWithoutMoving.slice(insertIndex),
    ];
    const nextActiveTabId = activateMovedTab
      ? tabId
      : nextTabIds.includes(node.activeTabId)
        ? node.activeTabId
        : tabId;
    const orderUnchanged = nextTabIds.length === node.tabIds.length
      && nextTabIds.every((id, index) => id === node.tabIds[index]);
    if (orderUnchanged && nextActiveTabId === node.activeTabId) return node;
    return { ...node, tabIds: nextTabIds, activeTabId: nextActiveTabId };
  }

  const newLeft = insertTabNearTab(node.children[0], targetTabId, tabId, position, activateMovedTab);
  if (newLeft !== node.children[0]) return { ...node, children: [newLeft, node.children[1]] };
  const newRight = insertTabNearTab(node.children[1], targetTabId, tabId, position, activateMovedTab);
  if (newRight !== node.children[1]) return { ...node, children: [node.children[0], newRight] };
  return node;
}

function moveTabRecordNearTab(
  tabs: EditorTab[],
  tabId: string,
  targetTabId: string,
  position: 'before' | 'after',
): EditorTab[] {
  const movingTab = tabs.find((tab) => tab.id === tabId);
  if (!movingTab) return tabs;
  const tabsWithoutMoving = tabs.filter((tab) => tab.id !== tabId);
  const targetIndex = tabsWithoutMoving.findIndex((tab) => tab.id === targetTabId);
  if (targetIndex < 0) return tabs;
  const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
  const nextTabs = [
    ...tabsWithoutMoving.slice(0, insertIndex),
    movingTab,
    ...tabsWithoutMoving.slice(insertIndex),
  ];
  const orderUnchanged = nextTabs.length === tabs.length
    && nextTabs.every((tab, index) => tab.id === tabs[index].id);
  return orderUnchanged ? tabs : nextTabs;
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

function getLayoutSignature(node: SplitNode | null): string {
  if (!node) return 'empty';
  if (node.type === 'leaf') return `leaf:${node.tabIds.join(',')}`;
  return `branch:${node.direction}(${getLayoutSignature(node.children[0])})(${getLayoutSignature(node.children[1])})`;
}

function captureMinimizedRestoreHint(
  layoutBeforeMinimize: SplitNode,
  layoutAfterMinimize: SplitNode | null,
  tabId: string,
  mode: 'side' | 'full',
): void {
  const leafPath = findLeafPathWithTab(layoutBeforeMinimize, tabId);
  const leaf = leafPath ? getLeafAtPath(layoutBeforeMinimize, leafPath) : findLeafWithTab(layoutBeforeMinimize, tabId);
  if (!leaf) return;

  minimizedRestoreHints.set(tabId, {
    mode,
    layoutBeforeMinimize,
    layoutAfterMinimizeSignature: getLayoutSignature(layoutAfterMinimize),
    leafPath: leafPath ?? [],
    activeTabId: leaf.activeTabId === tabId ? null : leaf.activeTabId,
    siblingTabIds: leaf.tabIds.filter((id) => id !== tabId),
  });
}

function getMinimizedRestoreTarget(layout: SplitNode, tabId: string, focusedTabId: string | null): string {
  const hint = minimizedRestoreHints.get(tabId);

  if (hint) {
    const candidates = [
      hint.activeTabId,
      ...hint.siblingTabIds,
    ].filter((id): id is string => id != null);

    for (const candidate of candidates) {
      if (containsTab(layout, candidate)) return candidate;
    }

    const hintedLeaf = getLeafAtPath(layout, hint.leafPath);
    if (hintedLeaf) return hintedLeaf.activeTabId;
  }

  const focusedLeaf = focusedTabId ? findLeafWithTab(layout, focusedTabId) : null;
  return focusedLeaf?.activeTabId ?? getFirstLeaf(layout).activeTabId;
}

/** Remove tabId from the layout of oldMode (if present) and report the next pane-local active tab */
function removeFromLayout(
  state: EditorStore,
  oldMode: EditorViewMode,
  tabId: string,
): Partial<EditorStore> & { fallbackTabId?: string | null } {
  const update: Partial<EditorStore> & { fallbackTabId?: string | null } = {};
  if (oldMode === 'side' && state.sideLayout && containsTab(state.sideLayout, tabId)) {
    const result = removeTabFromTree(state.sideLayout, tabId);
    update.sideLayout = result.tree;
    update.fallbackTabId = result.fallbackTabId;
  }
  if (oldMode === 'full' && state.fullLayout && containsTab(state.fullLayout, tabId)) {
    const result = removeTabFromTree(state.fullLayout, tabId);
    update.fullLayout = result.tree;
    update.fallbackTabId = result.fallbackTabId;
  }
  return update;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  sideLayout: null,
  fullLayout: null,
  sideLastActiveTabId: null,
  fullLastActiveTabId: null,
  hosts: {},
  focusedHostId: MAIN_HOST_ID,
  pendingCloseTabId: null,

  openTab: async ({ type, targetId, title, viewMode, isDirty, draftData, projectId, networkId, nodeId, terminalCwd, terminalLaunchConfig, sideSplitRatio, hostId }) => {
    const { tabs } = get();
    const tabId = makeTabId(type, targetId);
    const resolvedHostId = hostId ?? MAIN_HOST_ID;

    // Reuse existing tab
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) {
      const contextPatch: Partial<EditorTab> = {};
      if (networkId !== undefined) contextPatch.networkId = networkId;
      if (nodeId !== undefined) contextPatch.nodeId = nodeId;
      if (draftData !== undefined) contextPatch.draftData = draftData;

      // If tab exists in a different host, move it
      if (existing.hostId !== resolvedHostId) {
        if (Object.keys(contextPatch).length > 0) {
          set((s) => ({
            tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, ...contextPatch } : t)),
          }));
        }
        get().moveTabToHost(tabId, resolvedHostId);
        return;
      }

      if (resolvedHostId === MAIN_HOST_ID) {
        const layoutUpdate: Partial<EditorStore> = {};
        const layoutFocusUpdate: Partial<EditorStore> = {};
        const { sideLayout, fullLayout } = get();
        if (sideLayout && containsTab(sideLayout, tabId)) {
          layoutUpdate.sideLayout = setActiveInLeaf(sideLayout, tabId);
          layoutFocusUpdate.sideLastActiveTabId = tabId;
        }
        if (fullLayout && containsTab(fullLayout, tabId)) {
          layoutUpdate.fullLayout = setActiveInLeaf(fullLayout, tabId);
          layoutFocusUpdate.fullLastActiveTabId = tabId;
        }
        set({
          ...layoutUpdate,
          ...layoutFocusUpdate,
          activeTabId: tabId,
          tabs: tabs.map((t) => {
            if (t.id !== tabId) return t;
            const nextFloatRect = t.viewMode === 'float' ? normalizeFloatRect(t.floatRect) : t.floatRect;
            return { ...t, ...contextPatch, floatRect: nextFloatRect, isMinimized: false };
          }),
        });
      } else {
        // Activate in detached host
        set((s) => ({
          hosts: {
            ...s.hosts,
            [resolvedHostId]: { ...s.hosts[resolvedHostId], activeTabId: tabId },
          },
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const nextFloatRect = t.viewMode === 'float' ? normalizeFloatRect(t.floatRect) : t.floatRect;
            return { ...t, ...contextPatch, floatRect: nextFloatRect, isMinimized: false };
          }),
        }));
      }
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
    if (resolvedHostId !== MAIN_HOST_ID) {
      // Detached hosts don't use side/full/float — tabs just live in the host
      resolvedMode = 'side';
    } else if (viewMode) {
      resolvedMode = coerceViewModeForTab({ type }, viewMode);
    } else {
      const savedMode = prefs?.view_mode as EditorViewMode | undefined;
      if (savedMode) {
        resolvedMode = coerceViewModeForTab({ type }, savedMode);
      } else {
        const mainTabs = tabs.filter((t) => t.hostId === MAIN_HOST_ID);
        const { activeTabId, sideLayout, fullLayout } = get();
        const activeMode = activeTabId && sideLayout && findLeafWithTab(sideLayout, activeTabId)
          ? 'side'
          : activeTabId && fullLayout && findLeafWithTab(fullLayout, activeTabId)
            ? 'full'
            : null;
        const hasSide = mainTabs.some((t) => t.viewMode === 'side' && !t.isMinimized);
        const hasFull = mainTabs.some((t) => t.viewMode === 'full' && !t.isMinimized);
        resolvedMode = coerceViewModeForTab({ type }, activeMode ?? (hasSide ? 'side' : hasFull ? 'full' : 'side'));
      }
    }

    const tab: EditorTab = {
      id: tabId,
      type,
      targetId,
      title,
      projectId,
      hostId: resolvedHostId,
      viewMode: resolvedMode,
      floatRect: normalizeFloatRect({
        x: prefs?.float_x ?? DEFAULT_FLOAT_RECT.x + stagger,
        y: prefs?.float_y ?? DEFAULT_FLOAT_RECT.y + stagger,
        width: prefs?.float_width ?? DEFAULT_FLOAT_RECT.width,
        height: prefs?.float_height ?? DEFAULT_FLOAT_RECT.height,
      }),
      isMinimized: false,
      sideSplitRatio: prefs?.side_split_ratio ?? sideSplitRatio ?? 0.5,
      isDirty: isDirty ?? !!draftData,
      isStale: false,
      activeFilePath: null,
      draftData,
      networkId,
      nodeId,
      terminalCwd,
      terminalLaunchConfig,
    };

    if (resolvedHostId !== MAIN_HOST_ID) {
      // Add to detached host
      set((s) => ({
        tabs: [...s.tabs, tab],
        hosts: {
          ...s.hosts,
          [resolvedHostId]: { ...s.hosts[resolvedHostId], activeTabId: tabId },
        },
      }));
      return;
    }

    // Main host: add to layout if side/full
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
        ...(resolvedMode === 'side' ? { sideLastActiveTabId: tabId } : {}),
        ...(resolvedMode === 'full' ? { fullLastActiveTabId: tabId } : {}),
      }));
    } else {
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tabId }));
    }
  },

  navigateTab: (tabId, params) => {
    const nextTabId = makeTabId(params.type, params.targetId);

    set((s) => {
      const sourceTab = s.tabs.find((tab) => tab.id === tabId);
      if (!sourceTab) return s;

      const duplicateTab = nextTabId === tabId
        ? null
        : s.tabs.find((tab) => tab.id === nextTabId) ?? null;

      let sideLayout = s.sideLayout;
      let fullLayout = s.fullLayout;

      if (duplicateTab?.hostId === MAIN_HOST_ID) {
        if (sideLayout && containsTab(sideLayout, duplicateTab.id)) {
          sideLayout = removeTabFromTree(sideLayout, duplicateTab.id).tree;
        }
        if (fullLayout && containsTab(fullLayout, duplicateTab.id)) {
          fullLayout = removeTabFromTree(fullLayout, duplicateTab.id).tree;
        }
      }

      if (sourceTab.hostId === MAIN_HOST_ID) {
        if (sideLayout && containsTab(sideLayout, tabId)) {
          sideLayout = replaceTabIdInTree(sideLayout, tabId, nextTabId);
          sideLayout = setActiveInLeaf(sideLayout, nextTabId);
        }
        if (fullLayout && containsTab(fullLayout, tabId)) {
          fullLayout = replaceTabIdInTree(fullLayout, tabId, nextTabId);
          fullLayout = setActiveInLeaf(fullLayout, nextTabId);
        }
      }

      const hosts = { ...s.hosts };
      if (duplicateTab?.hostId && duplicateTab.hostId !== MAIN_HOST_ID) {
        const duplicateHost = hosts[duplicateTab.hostId];
        if (duplicateHost?.activeTabId === duplicateTab.id) {
          hosts[duplicateTab.hostId] = { ...duplicateHost, activeTabId: null };
        }
      }
      if (sourceTab.hostId !== MAIN_HOST_ID) {
        const host = hosts[sourceTab.hostId];
        if (host) {
          hosts[sourceTab.hostId] = { ...host, activeTabId: nextTabId };
        }
      }

      const tabs = s.tabs
        .filter((tab) => tab.id === tabId || tab.id !== nextTabId)
        .map((tab) => {
          if (tab.id !== tabId) return tab;
          return {
            ...tab,
            id: nextTabId,
            type: params.type,
            targetId: params.targetId,
            title: params.title,
            projectId: params.projectId,
            isDirty: params.isDirty ?? false,
            isStale: false,
            activeFilePath: null,
            draftData: params.draftData,
            networkId: params.networkId,
            nodeId: params.nodeId,
            terminalCwd: params.terminalCwd,
            terminalLaunchConfig: params.terminalLaunchConfig,
            editorType: undefined,
            isMinimized: false,
          };
        });

      clearDraftCache(tabId);
      clearViewState(tabId);

      return {
        ...s,
        tabs,
        hosts,
        sideLayout,
        fullLayout,
        activeTabId: s.activeTabId === tabId || sourceTab.hostId === MAIN_HOST_ID
          ? nextTabId
          : s.activeTabId,
        sideLastActiveTabId: s.sideLastActiveTabId === tabId ? nextTabId : s.sideLastActiveTabId,
        fullLastActiveTabId: s.fullLastActiveTabId === tabId ? nextTabId : s.fullLastActiveTabId,
      };
    });
  },

  closeTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.type === 'terminal') {
      window.electron.terminal.shutdown(tab.targetId).catch(() => {});
      cleanupTodoSession(tab.targetId);
    }
    if (tab.type === 'concept' && !tab.targetId.startsWith('draft-')) {
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
    clearViewState(tabId);

    const hostId = tab.hostId;

    if (hostId === MAIN_HOST_ID) {
      minimizedRestoreHints.delete(tabId);

      // Remove from main host layout trees
      const layoutUpdate: Partial<EditorStore> = {};
      let paneFallbackTabId: string | null = null;
      const { sideLayout, fullLayout } = get();
      if (sideLayout && containsTab(sideLayout, tabId)) {
        const result = removeTabFromTree(sideLayout, tabId);
        layoutUpdate.sideLayout = result.tree;
        paneFallbackTabId = result.fallbackTabId;
      }
      if (fullLayout && containsTab(fullLayout, tabId)) {
        const result = removeTabFromTree(fullLayout, tabId);
        layoutUpdate.fullLayout = result.tree;
        paneFallbackTabId = result.fallbackTabId;
      }

      set((s) => {
        const tabs = s.tabs.filter((t) => t.id !== tabId);
        let activeTabId = s.activeTabId;
        if (activeTabId === tabId) {
          const mainTabs = tabs.filter((t) => t.hostId === MAIN_HOST_ID);
          activeTabId = paneFallbackTabId ?? (mainTabs.length > 0 ? mainTabs[mainTabs.length - 1].id : null);
        }
        return {
          ...layoutUpdate,
          tabs,
          activeTabId,
          sideLastActiveTabId: s.sideLastActiveTabId === tabId ? paneFallbackTabId : s.sideLastActiveTabId,
          fullLastActiveTabId: s.fullLastActiveTabId === tabId ? paneFallbackTabId : s.fullLastActiveTabId,
        };
      });
    } else {
      // Remove from detached host
      set((s) => {
        const tabs = s.tabs.filter((t) => t.id !== tabId);
        const host = s.hosts[hostId];
        if (!host) return { tabs };

        const hostTabs = tabs.filter((t) => t.hostId === hostId);
        if (hostTabs.length === 0) {
          // Last tab closed — remove host, close window
          const { [hostId]: _, ...remainingHosts } = s.hosts;
          closeDetachedHostSoon(hostId);
          return {
            tabs,
            hosts: remainingHosts,
            focusedHostId: s.focusedHostId === hostId ? MAIN_HOST_ID : s.focusedHostId,
          };
        }

        const newActiveTabId = host.activeTabId === tabId
          ? hostTabs[hostTabs.length - 1].id
          : host.activeTabId;

        return {
          tabs,
          hosts: { ...s.hosts, [hostId]: { ...host, activeTabId: newActiveTabId } },
        };
      });
    }
  },

  closeOtherTabs: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const toClose = get().tabs.filter((t) => t.id !== tabId && t.hostId === tab.hostId);
    for (const t of toClose) get().closeTab(t.id);
  },

  closeTabsToRight: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const hostTabs = get().tabs.filter((t) => t.hostId === tab.hostId);
    const idx = hostTabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;
    const toClose = hostTabs.slice(idx + 1);
    for (const t of toClose) get().closeTab(t.id);
  },

  closeAllTabs: () => {
    const { tabs } = get();
    for (const t of [...tabs]) get().closeTab(t.id);
  },

  setActiveTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.hostId === MAIN_HOST_ID) {
      const layoutUpdate: Partial<EditorStore> = {};
      const layoutFocusUpdate: Partial<EditorStore> = {};
      const { sideLayout, fullLayout } = get();
      if (sideLayout && containsTab(sideLayout, tabId)) {
        layoutUpdate.sideLayout = setActiveInLeaf(sideLayout, tabId);
        layoutFocusUpdate.sideLastActiveTabId = tabId;
      }
      if (fullLayout && containsTab(fullLayout, tabId)) {
        layoutUpdate.fullLayout = setActiveInLeaf(fullLayout, tabId);
        layoutFocusUpdate.fullLastActiveTabId = tabId;
      }
      set({ ...layoutUpdate, ...layoutFocusUpdate, activeTabId: tabId });
    } else {
      const host = get().hosts[tab.hostId];
      if (host) {
        set((s) => ({
          hosts: { ...s.hosts, [tab.hostId]: { ...host, activeTabId: tabId } },
        }));
      }
    }
  },

  setViewMode: (tabId, mode) => {
    const oldTab = get().tabs.find((t) => t.id === tabId);
    if (!oldTab) return;
    if (oldTab.hostId !== MAIN_HOST_ID) return; // view mode changes only apply to main host tabs

    const nextMode = coerceViewModeForTab(oldTab, mode);
    const oldMode = oldTab.viewMode;
    if (nextMode === oldMode) return;

    // Detached mode → use detachTab instead
    if (nextMode === 'detached') {
      get().detachTab(tabId);
      return;
    }

    // Float mode
    if (nextMode === 'float') {
      const layoutUpdate = removeFromLayout(get(), oldMode, tabId);
      set((s) => ({
        ...layoutUpdate,
        activeTabId: s.activeTabId === tabId ? (layoutUpdate.fallbackTabId ?? null) : s.activeTabId,
        tabs: s.tabs.map((t) => (
          t.id === tabId ? { ...t, viewMode: 'float', floatRect: normalizeFloatRect(t.floatRect) } : t
        )),
      }));
      if (oldTab.type === 'concept') debouncedSavePrefs(oldTab.targetId, { view_mode: nextMode });
      return;
    }

    // full ↔ side: group switch
    if ((oldMode === 'side' || oldMode === 'full') && (nextMode === 'side' || nextMode === 'full')) {
      const tabsInOldMode = get().tabs.filter((t) => t.viewMode === oldMode && t.hostId === MAIN_HOST_ID);
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
        tabs: s.tabs.map((t) => (tabIds.includes(t.id) ? { ...t, viewMode: nextMode } : t)),
      }));

      tabsInOldMode.forEach((t) => {
        if (t.type === 'concept') debouncedSavePrefs(t.targetId, { view_mode: nextMode });
      });
      return;
    }

    // Default: single tab joining side or full
    if (nextMode === 'side' || nextMode === 'full') {
      let layout = getLayoutForMode(get(), nextMode);
      if (!layout) {
        layout = { type: 'leaf', tabIds: [tabId], activeTabId: tabId };
      } else {
        const { activeTabId: currentActive } = get();
        const focusedLeaf = currentActive ? findLeafWithTab(layout, currentActive) : null;
        const targetLeafTabId = focusedLeaf ? focusedLeaf.activeTabId : getFirstLeaf(layout).activeTabId;
        layout = addTabToLeaf(layout, targetLeafTabId, tabId);
      }
      set((s) => ({
        ...setLayoutForMode(nextMode, layout),
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: nextMode, isMinimized: false } : t)),
      }));
    } else {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: nextMode } : t)),
      }));
    }

    if (oldTab.type === 'concept') debouncedSavePrefs(oldTab.targetId, { view_mode: nextMode });
  },

  toggleMinimize: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || tab.hostId !== MAIN_HOST_ID) return;

    const mode = tab.viewMode;
    const newMinimized = !tab.isMinimized;

    if (mode === 'side' || mode === 'full') {
      if (newMinimized) {
        const layout = getLayoutForMode(get(), mode);
        const result = layout && containsTab(layout, tabId)
          ? removeTabFromTree(layout, tabId)
          : { tree: layout, fallbackTabId: null };
        if (layout && containsTab(layout, tabId)) {
          captureMinimizedRestoreHint(layout, result.tree, tabId, mode);
        }

        const layoutUpdate = result.tree !== layout ? setLayoutForMode(mode, result.tree) : {};
        const fallbackTabId = result.fallbackTabId;

        set((s) => ({
          ...layoutUpdate,
          activeTabId: s.activeTabId === tabId ? (fallbackTabId ?? null) : s.activeTabId,
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, isMinimized: true } : t,
          ),
        }));
      } else {
        const layout = getLayoutForMode(get(), mode);
        let restoredLayout = layout;
        const hint = minimizedRestoreHints.get(tabId);

        if (
          hint?.mode === mode
          && getLayoutSignature(restoredLayout) === hint.layoutAfterMinimizeSignature
        ) {
          restoredLayout = setActiveInLeaf(hint.layoutBeforeMinimize, tabId);
        } else if (restoredLayout && !containsTab(restoredLayout, tabId)) {
          const targetLeafTabId = getMinimizedRestoreTarget(restoredLayout, tabId, get().activeTabId);
          restoredLayout = addTabToLeaf(restoredLayout, targetLeafTabId, tabId);
        } else if (!restoredLayout) {
          restoredLayout = { type: 'leaf', tabIds: [tabId], activeTabId: tabId };
        }

        const layoutUpdate = restoredLayout !== layout ? setLayoutForMode(mode, restoredLayout) : {};
        minimizedRestoreHints.delete(tabId);

        set((s) => ({
          ...layoutUpdate,
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, isMinimized: false } : t,
          ),
          activeTabId: tabId,
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
    if (!tab || tab.isMinimized || tab.hostId !== MAIN_HOST_ID) return;

    const mode = tab.viewMode;
    let layoutUpdate: Partial<EditorStore> = {};
    let fallbackTabId: string | null = null;

    if (mode === 'side' || mode === 'full') {
      const layout = getLayoutForMode(get(), mode);
      if (layout && containsTab(layout, tabId)) {
        const result = removeTabFromTree(layout, tabId);
        captureMinimizedRestoreHint(layout, result.tree, tabId, mode);
        layoutUpdate = setLayoutForMode(mode, result.tree);
        fallbackTabId = result.fallbackTabId;
      }
    }

    set((s) => ({
      ...layoutUpdate,
      activeTabId: s.activeTabId === tabId ? fallbackTabId : s.activeTabId,
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, isMinimized: true } : t,
      ),
    }));
  },

  updateFloatRect: (tabId, rect) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, floatRect: normalizeFloatRect({ ...t.floatRect, ...rect }) } : t,
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
    set((s) => {
      let changed = false;
      const tabs = s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const isAgentTerminalTab = t.type === 'terminal' && Boolean(t.terminalLaunchConfig?.agent);
        if (t.isManuallyRenamed && !isManualRename && !isAgentTerminalTab) return t;
        const nextIsManuallyRenamed = isAgentTerminalTab
          ? false
          : isManualRename
            ? true
            : t.isManuallyRenamed;
        if (t.title === title && t.isManuallyRenamed === nextIsManuallyRenamed) return t;
        changed = true;
        return { ...t, title, isManuallyRenamed: nextIsManuallyRenamed };
      });
      return changed ? { tabs } : { tabs: s.tabs };
    });
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

  setStale: (tabId, stale) => {
    set((s) => {
      let changed = false;
      const tabs = s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        if (Boolean(t.isStale) === stale) return t;
        changed = true;
        return { ...t, isStale: stale };
      });
      return changed ? { tabs } : s;
    });
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

  // ── Split layout operations (main host only) ──

  splitTab: (targetTabId, newTabId, direction, position) => {
    if (targetTabId === newTabId) return;

    const targetTab = get().tabs.find((t) => t.id === targetTabId);
    if (!targetTab || targetTab.hostId !== MAIN_HOST_ID) return;

    const mode = targetTab.viewMode;
    if (mode !== 'side' && mode !== 'full') return;

    let layout = getLayoutForMode(get(), mode);
    if (!layout) return;

    const newTab = get().tabs.find((t) => t.id === newTabId);
    if (!newTab) return;

    // Remove newTab from this layout if already present
    if (containsTab(layout, newTabId)) {
      const { tree } = removeTabFromTree(layout, newTabId);
      if (!tree) return;
      layout = tree;
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
        tabs: s.tabs.map((t) => (t.id === newTabId ? { ...t, viewMode: mode, isMinimized: false, hostId: MAIN_HOST_ID } : t)),
        activeTabId: newTabId,
        ...(mode === 'side' ? { sideLastActiveTabId: newTabId } : {}),
        ...(mode === 'full' ? { fullLastActiveTabId: newTabId } : {}),
      }));
    }
  },

  moveTabToPane: (tabId, targetPaneTabId, mode) => {
    console.log(`[EditorStore] moveTabToPane start tabId=${tabId}, targetPaneTabId=${targetPaneTabId}, mode=${mode}`);
    if (tabId === targetPaneTabId) return;

    let layout = getLayoutForMode(get(), mode);
    if (!layout) return;

    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const oldLayoutUpdate: Partial<EditorStore> = {};
    if (tab.viewMode !== mode && (tab.viewMode === 'side' || tab.viewMode === 'full')) {
      Object.assign(oldLayoutUpdate, removeFromLayout(get(), tab.viewMode, tabId));
    }

    if (containsTab(layout, tabId)) {
      const { tree } = removeTabFromTree(layout, tabId);
      if (!tree) return;
      layout = tree;
    }

    layout = addTabToLeaf(layout, targetPaneTabId, tabId);

    const sourceHostId = tab.hostId;

    set((s) => {
      let hostsUpdate = s.hosts;

      // Clean up source detached host if tab came from one
      if (sourceHostId !== MAIN_HOST_ID) {
        const remainingHostTabs = s.tabs.filter((t) => t.id !== tabId && t.hostId === sourceHostId);
        if (remainingHostTabs.length === 0) {
          const { [sourceHostId]: _, ...rest } = hostsUpdate;
          hostsUpdate = rest;
          closeDetachedHostSoon(sourceHostId);
        } else {
          const host = hostsUpdate[sourceHostId];
          if (host && host.activeTabId === tabId) {
            hostsUpdate = {
              ...hostsUpdate,
              [sourceHostId]: { ...host, activeTabId: remainingHostTabs[remainingHostTabs.length - 1].id },
            };
          }
        }
      }

      return {
        ...oldLayoutUpdate,
        ...setLayoutForMode(mode, layout!),
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, viewMode: mode, isMinimized: false, hostId: MAIN_HOST_ID } : t)),
        activeTabId: tabId,
        ...(mode === 'side' ? { sideLastActiveTabId: tabId } : {}),
        ...(mode === 'full' ? { fullLastActiveTabId: tabId } : {}),
        hosts: hostsUpdate,
      };
    });
  },

  moveTabWithinStrip: (tabId, targetTabId, position) => {
    console.log(`[EditorStore] moveTabWithinStrip start tabId=${tabId}, targetTabId=${targetTabId}, position=${position}`);
    if (tabId === targetTabId) return;

    const state = get();
    const tab = state.tabs.find((t) => t.id === tabId);
    const targetTab = state.tabs.find((t) => t.id === targetTabId);
    if (!tab || !targetTab) return;

    const sourceHostId = tab.hostId;
    const targetHostId = targetTab.hostId;

    if (targetHostId === MAIN_HOST_ID) {
      const mode = targetTab.viewMode;
      if (mode !== 'side' && mode !== 'full') return;

      let layout = getLayoutForMode(state, mode);
      if (!layout || !containsTab(layout, targetTabId)) return;

      const sourceLeaf = sourceHostId === MAIN_HOST_ID && tab.viewMode === mode
        ? findLeafWithTab(layout, tabId)
        : null;
      const isSameLeafReorder = Boolean(sourceLeaf?.tabIds.includes(targetTabId));

      const oldLayoutUpdate: Partial<EditorStore> = {};
      if (sourceHostId === MAIN_HOST_ID && (tab.viewMode === 'side' || tab.viewMode === 'full')) {
        if (tab.viewMode === mode) {
          if (containsTab(layout, tabId)) {
            const { tree } = removeTabFromTree(layout, tabId);
            if (!tree) return;
            layout = tree;
          }
        } else {
          Object.assign(oldLayoutUpdate, removeFromLayout(state, tab.viewMode, tabId));
        }
      }

      const keepMovedTabActive = isSameLeafReorder && sourceLeaf?.activeTabId === tabId;
      const activateMovedTab = !isSameLeafReorder || keepMovedTabActive;
      const nextLayout = insertTabNearTab(layout, targetTabId, tabId, position, activateMovedTab);
      if (nextLayout === layout && sourceHostId === targetHostId && tab.viewMode === mode) return;

      set((s) => {
        let hostsUpdate = s.hosts;
        let sourceHostRemoved = false;

        if (sourceHostId !== MAIN_HOST_ID) {
          const remainingHostTabs = s.tabs.filter((t) => t.id !== tabId && t.hostId === sourceHostId);
          if (remainingHostTabs.length === 0) {
            const { [sourceHostId]: _, ...rest } = hostsUpdate;
            hostsUpdate = rest;
            sourceHostRemoved = true;
            closeDetachedHostSoon(sourceHostId);
          } else {
            const host = hostsUpdate[sourceHostId];
            if (host && host.activeTabId === tabId) {
              hostsUpdate = {
                ...hostsUpdate,
                [sourceHostId]: { ...host, activeTabId: remainingHostTabs[remainingHostTabs.length - 1].id },
              };
            }
          }
        }

        const updatedTabs = s.tabs.map((t) => (
          t.id === tabId
            ? { ...t, hostId: MAIN_HOST_ID, viewMode: mode, isMinimized: false }
            : t
        ));

        return {
          ...oldLayoutUpdate,
          ...setLayoutForMode(mode, nextLayout),
          tabs: moveTabRecordNearTab(updatedTabs, tabId, targetTabId, position),
          activeTabId: activateMovedTab ? tabId : s.activeTabId,
          ...(activateMovedTab && mode === 'side' ? { sideLastActiveTabId: tabId } : {}),
          ...(activateMovedTab && mode === 'full' ? { fullLastActiveTabId: tabId } : {}),
          hosts: hostsUpdate,
          ...(sourceHostRemoved && s.focusedHostId === sourceHostId ? { focusedHostId: MAIN_HOST_ID } : {}),
        };
      });
      return;
    }

    const oldLayoutUpdate: Partial<EditorStore> & { fallbackTabId?: string | null } = {};
    if (sourceHostId === MAIN_HOST_ID && (tab.viewMode === 'side' || tab.viewMode === 'full')) {
      Object.assign(oldLayoutUpdate, removeFromLayout(state, tab.viewMode, tabId));
    }

    const activateMovedTab = sourceHostId !== targetHostId;

    set((s) => {
      let hostsUpdate = s.hosts;
      let sourceHostRemoved = false;

      if (sourceHostId !== MAIN_HOST_ID && sourceHostId !== targetHostId) {
        const remainingHostTabs = s.tabs.filter((t) => t.id !== tabId && t.hostId === sourceHostId);
        if (remainingHostTabs.length === 0) {
          const { [sourceHostId]: _, ...rest } = hostsUpdate;
          hostsUpdate = rest;
          sourceHostRemoved = true;
          closeDetachedHostSoon(sourceHostId);
        } else {
          const host = hostsUpdate[sourceHostId];
          if (host && host.activeTabId === tabId) {
            hostsUpdate = {
              ...hostsUpdate,
              [sourceHostId]: { ...host, activeTabId: remainingHostTabs[remainingHostTabs.length - 1].id },
            };
          }
        }
      }

      if (activateMovedTab && hostsUpdate[targetHostId]) {
        hostsUpdate = {
          ...hostsUpdate,
          [targetHostId]: { ...hostsUpdate[targetHostId], activeTabId: tabId },
        };
      }

      const updatedTabs = s.tabs.map((t) => (
        t.id === tabId
          ? { ...t, hostId: targetHostId, viewMode: 'side' as const, isMinimized: false }
          : t
      ));
      const nextActiveTabId = sourceHostId === MAIN_HOST_ID && s.activeTabId === tabId
        ? oldLayoutUpdate.fallbackTabId ?? null
        : s.activeTabId;

      return {
        ...oldLayoutUpdate,
        tabs: moveTabRecordNearTab(updatedTabs, tabId, targetTabId, position),
        activeTabId: nextActiveTabId,
        hosts: hostsUpdate,
        ...(sourceHostRemoved && s.focusedHostId === sourceHostId ? { focusedHostId: targetHostId } : {}),
      };
    });
  },

  updateSplitRatio: (mode, path, ratio) => {
    const layout = mode === 'side' ? get().sideLayout : get().fullLayout;
    if (!layout) return;
    const newLayout = updateRatioAtPath(layout, path, ratio);
    set(setLayoutForMode(mode, newLayout));
  },

  // ── Host operations ──

  createHost: (label) => {
    const hostId = makeHostId();
    set((s) => ({
      hosts: {
        ...s.hosts,
        [hostId]: { id: hostId, label: label ?? 'Editor', activeTabId: null },
      },
    }));
    return hostId;
  },

  removeHost: (hostId) => {
    if (hostId === MAIN_HOST_ID) return;
    const hostTabs = get().tabs.filter((t) => t.hostId === hostId);

    // Reattach all tabs to main
    for (const tab of hostTabs) {
      get().moveTabToHost(tab.id, MAIN_HOST_ID);
    }

    set((s) => {
      const { [hostId]: _, ...remainingHosts } = s.hosts;
      return {
        hosts: remainingHosts,
        focusedHostId: s.focusedHostId === hostId ? MAIN_HOST_ID : s.focusedHostId,
      };
    });
  },

  detachTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return MAIN_HOST_ID;
    console.log(`[EditorStore] detachTab tabId=${tabId}, title=${tab.title}, sourceHost=${tab.hostId}`);

    // Create new host
    const hostId = get().createHost(tab.title);

    // Remove from main layout if needed
    const layoutUpdate = removeFromLayout(get(), tab.viewMode, tabId);

    // Move tab to new host
    set((s) => ({
      ...layoutUpdate,
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, hostId, viewMode: 'side' } : t)),
      hosts: {
        ...s.hosts,
        [hostId]: { ...s.hosts[hostId], activeTabId: tabId },
      },
      // Update main activeTabId if this was the active tab
      activeTabId: s.activeTabId === tabId
        ? (() => {
          const mainTabs = s.tabs.filter((t) => t.id !== tabId && t.hostId === MAIN_HOST_ID);
          return mainTabs.length > 0 ? mainTabs[mainTabs.length - 1].id : null;
        })()
        : s.activeTabId,
    }));

    // Open detached window
    console.log(`[EditorStore] detachTab openDetachedWindow hostId=${hostId}, tabId=${tabId}`);
    window.electron.editor.detach(hostId, tab.title);

    return hostId;
  },

  reattachTab: (tabId) => {
    get().moveTabToHost(tabId, MAIN_HOST_ID);
  },

  moveTabToHost: (tabId, targetHostId, viewMode) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    console.log(`[EditorStore] moveTabToHost start tabId=${tabId}, targetHostId=${targetHostId}, requestedViewMode=${viewMode ?? 'none'}, tabHost=${tab?.hostId ?? 'missing'}`);
    if (!tab) {
      console.warn(`[EditorStore] moveTabToHost abort missing tabId=${tabId}`);
      return;
    }
    if (tab.hostId === targetHostId) {
      console.warn(`[EditorStore] moveTabToHost abort same-host tabId=${tabId}, hostId=${targetHostId}`);
      return;
    }

    const sourceHostId = tab.hostId;

    if (sourceHostId === MAIN_HOST_ID) {
      // Remove from main layout
      const layoutUpdate = removeFromLayout(get(), tab.viewMode, tabId);

      set((s) => {
        const mainTabs = s.tabs.filter((t) => t.id !== tabId && t.hostId === MAIN_HOST_ID);
        const newActiveTabId = s.activeTabId === tabId
          ? (mainTabs.length > 0 ? mainTabs[mainTabs.length - 1].id : null)
          : s.activeTabId;

        return {
          ...layoutUpdate,
          tabs: s.tabs.map((t) => (
            t.id === tabId
              ? { ...t, hostId: targetHostId, viewMode: coerceViewModeForTab(t, 'side') }
              : t
          )),
          activeTabId: newActiveTabId,
          hosts: targetHostId !== MAIN_HOST_ID
            ? { ...s.hosts, [targetHostId]: { ...s.hosts[targetHostId], activeTabId: tabId } }
            : s.hosts,
        };
      });
      console.log(`[EditorStore] moveTabToHost main->host tabId=${tabId}, targetHostId=${targetHostId}`);
    } else {
      // Moving from detached host
      set((s) => {
        const host = s.hosts[sourceHostId];
        const remainingHostTabs = s.tabs.filter((t) => t.id !== tabId && t.hostId === sourceHostId);

        let hostsUpdate = { ...s.hosts };

        // Update source host
        if (remainingHostTabs.length === 0) {
          // Last tab removed — clean up host
          const { [sourceHostId]: _, ...rest } = hostsUpdate;
          hostsUpdate = rest;
          closeDetachedHostSoon(sourceHostId);
        } else if (host) {
          hostsUpdate[sourceHostId] = {
            ...host,
            activeTabId: host.activeTabId === tabId
              ? remainingHostTabs[remainingHostTabs.length - 1].id
              : host.activeTabId,
          };
        }

        // Update target host
        if (targetHostId !== MAIN_HOST_ID && hostsUpdate[targetHostId]) {
          hostsUpdate[targetHostId] = { ...hostsUpdate[targetHostId], activeTabId: tabId };
        }

        const tabUpdate: Partial<EditorTab> = { hostId: targetHostId };
        if (targetHostId === MAIN_HOST_ID) {
          if (viewMode && viewMode !== 'detached') {
            tabUpdate.viewMode = coerceViewModeForTab(tab, viewMode);
          } else {
            // Determine view mode for main based on what's currently open
            const mainTabs = s.tabs.filter((t) => t.hostId === MAIN_HOST_ID);
            const hasFull = mainTabs.some((t) => t.viewMode === 'full' && !t.isMinimized);
            const hasSide = mainTabs.some((t) => t.viewMode === 'side' && !t.isMinimized);
            tabUpdate.viewMode = coerceViewModeForTab(tab, hasFull ? 'full' : hasSide ? 'side' : 'side');
          }
        }

        const updatedTabs = s.tabs.map((t) => (t.id === tabId ? { ...t, ...tabUpdate } : t));

        // Add to main layout if moving to main. Float tabs stay out of split layouts.
        let layoutUpdate: Partial<EditorStore> = {};
        if (targetHostId === MAIN_HOST_ID) {
          const mode = tabUpdate.viewMode;
          if (mode === 'side' || mode === 'full') {
            let layout = getLayoutForMode(s as EditorStore, mode);
            if (!layout) {
              layout = { type: 'leaf', tabIds: [tabId], activeTabId: tabId };
            } else {
              const focusedLeaf = s.activeTabId ? findLeafWithTab(layout, s.activeTabId) : null;
              const targetLeafTabId = focusedLeaf ? focusedLeaf.activeTabId : getFirstLeaf(layout).activeTabId;
              layout = addTabToLeaf(layout, targetLeafTabId, tabId);
            }
            layoutUpdate = setLayoutForMode(mode, layout);
          }
        }

        return {
          ...layoutUpdate,
          tabs: updatedTabs,
          hosts: hostsUpdate,
          activeTabId: targetHostId === MAIN_HOST_ID ? tabId : s.activeTabId,
          focusedHostId: s.focusedHostId === sourceHostId && remainingHostTabs.length === 0
            ? MAIN_HOST_ID
            : s.focusedHostId,
        };
      });
      console.log(`[EditorStore] moveTabToHost detached->host tabId=${tabId}, sourceHostId=${sourceHostId}, targetHostId=${targetHostId}`);
    }
  },

  setHostActiveTab: (hostId, tabId) => {
    if (hostId === MAIN_HOST_ID) {
      get().setActiveTab(tabId);
    } else {
      const host = get().hosts[hostId];
      if (host) {
        set((s) => ({
          hosts: { ...s.hosts, [hostId]: { ...host, activeTabId: tabId } },
        }));
      }
    }
  },

  getHostTabs: (hostId) => {
    return get().tabs.filter((t) => t.hostId === hostId);
  },

  setFocusedHost: (hostId) => {
    set({ focusedHostId: hostId });
  },

  clear: () => {
    Object.values(floatSaveTimers).forEach(clearTimeout);
    floatSaveTimers = {};
    minimizedRestoreHints.clear();
    set({
      tabs: [],
      activeTabId: null,
      sideLayout: null,
      fullLayout: null,
      sideLastActiveTabId: null,
      fullLastActiveTabId: null,
      hosts: {},
      focusedHostId: MAIN_HOST_ID,
    });
  },
}));
