import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SplitLeaf, SplitBranch, SplitNode } from '@netior/shared/types';

// Minimal window.electron mock for editor-store import
const mockElectron = {
  terminal: { shutdown: vi.fn().mockResolvedValue(undefined) },
  editor: { detach: vi.fn(), closeDetachedWindow: vi.fn() },
  config: { get: vi.fn().mockResolvedValue({ success: true, data: null }), set: vi.fn() },
  window: { onAppShortcut: vi.fn().mockReturnValue(() => {}) },
};
Object.defineProperty(globalThis, 'window', {
  value: {
    electron: mockElectron,
    location: { hash: '' },
  },
  writable: true,
});

// Import after mock
const { collectLeaves, getActiveLeaf, useEditorStore, containsTab } = await import('../stores/editor-store');
const { cycleTab, activateTabByNumber, cyclePane } = await import('../shortcuts/useGlobalShortcuts');

// ── Test fixtures ──

function makeLeaf(tabIds: string[], activeTabId?: string): SplitLeaf {
  return { type: 'leaf', tabIds, activeTabId: activeTabId ?? tabIds[0] };
}

function makeBranch(left: SplitNode, right: SplitNode, direction: 'horizontal' | 'vertical' = 'horizontal'): SplitBranch {
  return { type: 'branch', direction, ratio: 0.5, children: [left, right] };
}

function makeTab(id: string) {
  return {
    id, type: 'file', targetId: id, title: id, hostId: 'main', viewMode: 'side',
    floatRect: { x: 0, y: 0, width: 0, height: 0 }, isMinimized: false,
    sideSplitRatio: 0.5, isDirty: false, activeFilePath: null,
  } as any;
}

function makeTabs(...ids: string[]) {
  return ids.map(makeTab);
}

// ── collectLeaves ──

describe('collectLeaves', () => {
  it('returns single leaf as array', () => {
    const leaf = makeLeaf(['a', 'b']);
    expect(collectLeaves(leaf)).toEqual([leaf]);
  });

  it('returns two leaves from a branch in order', () => {
    const left = makeLeaf(['a']);
    const right = makeLeaf(['b']);
    const branch = makeBranch(left, right);
    expect(collectLeaves(branch)).toEqual([left, right]);
  });

  it('handles nested branches in document order', () => {
    const l1 = makeLeaf(['a']);
    const l2 = makeLeaf(['b']);
    const l3 = makeLeaf(['c']);
    const innerBranch = makeBranch(l1, l2);
    const outerBranch = makeBranch(innerBranch, l3);
    expect(collectLeaves(outerBranch)).toEqual([l1, l2, l3]);
  });
});

// ── getActiveLeaf ──

describe('getActiveLeaf', () => {
  beforeEach(() => {
    useEditorStore.setState({
      tabs: [], activeTabId: null, sideLayout: null, fullLayout: null, hosts: {}, focusedHostId: 'main',
    });
  });

  it('returns null when activeTabId is null', () => {
    expect(getActiveLeaf()).toBeNull();
  });

  it('returns null when activeTabId is in float (no layout)', () => {
    useEditorStore.setState({
      tabs: [{ id: 'float:1', viewMode: 'float' } as any],
      activeTabId: 'float:1',
    });
    expect(getActiveLeaf()).toBeNull();
  });

  it('returns side leaf when activeTabId is in sideLayout', () => {
    const leaf = makeLeaf(['tab1', 'tab2'], 'tab1');
    useEditorStore.setState({ activeTabId: 'tab1', sideLayout: leaf });
    const result = getActiveLeaf();
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('side');
    expect(result!.leaf.tabIds).toEqual(['tab1', 'tab2']);
  });

  it('returns full leaf when activeTabId is in fullLayout', () => {
    const leaf = makeLeaf(['tab3'], 'tab3');
    useEditorStore.setState({ activeTabId: 'tab3', fullLayout: leaf });
    const result = getActiveLeaf();
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('full');
  });
});

// ── closeTab fallback ──

describe('closeTab fallback', () => {
  beforeEach(() => {
    useEditorStore.setState({
      tabs: [], activeTabId: null, sideLayout: null, fullLayout: null, hosts: {}, focusedHostId: 'main', pendingCloseTabId: null,
    });
  });

  it('selects same-pane tab when other tabs remain in leaf', () => {
    useEditorStore.setState({
      tabs: makeTabs('t1', 't2', 't3'),
      activeTabId: 't2',
      sideLayout: makeLeaf(['t1', 't2', 't3'], 't2'),
    });

    useEditorStore.getState().closeTab('t2');
    const state = useEditorStore.getState();

    expect(['t1', 't3']).toContain(state.activeTabId);
    expect(containsTab(state.sideLayout!, state.activeTabId!)).toBe(true);
  });

  it('falls to sibling pane when leaf empties', () => {
    useEditorStore.setState({
      tabs: makeTabs('t1', 't2'),
      activeTabId: 't1',
      sideLayout: makeBranch(makeLeaf(['t1'], 't1'), makeLeaf(['t2'], 't2')),
    });

    useEditorStore.getState().closeTab('t1');
    expect(useEditorStore.getState().activeTabId).toBe('t2');
  });

  it('falls to nearest sibling in nested layout ((A | B) | C), close C → B', () => {
    // ((A | B) | C) — closing C should go to B (nearest), not A
    useEditorStore.setState({
      tabs: makeTabs('a', 'b', 'c'),
      activeTabId: 'c',
      sideLayout: makeBranch(
        makeBranch(makeLeaf(['a'], 'a'), makeLeaf(['b'], 'b')),
        makeLeaf(['c'], 'c'),
      ),
    });

    useEditorStore.getState().closeTab('c');
    expect(useEditorStore.getState().activeTabId).toBe('b');
  });

  it('falls to nearest sibling in nested layout (A | (B | C)), close A → B', () => {
    // (A | (B | C)) — closing A should go to B (nearest), not C
    useEditorStore.setState({
      tabs: makeTabs('a', 'b', 'c'),
      activeTabId: 'a',
      sideLayout: makeBranch(
        makeLeaf(['a'], 'a'),
        makeBranch(makeLeaf(['b'], 'b'), makeLeaf(['c'], 'c')),
      ),
    });

    useEditorStore.getState().closeTab('a');
    expect(useEditorStore.getState().activeTabId).toBe('b');
  });

  it('sets activeTabId null when last tab removed', () => {
    useEditorStore.setState({
      tabs: makeTabs('t1'),
      activeTabId: 't1',
      sideLayout: makeLeaf(['t1'], 't1'),
    });

    useEditorStore.getState().closeTab('t1');
    expect(useEditorStore.getState().activeTabId).toBeNull();
    expect(useEditorStore.getState().tabs).toHaveLength(0);
  });
});

describe('setViewMode float fallback', () => {
  beforeEach(() => {
    useEditorStore.setState({
      tabs: [], activeTabId: null, sideLayout: null, fullLayout: null, hosts: {}, focusedHostId: 'main', pendingCloseTabId: null,
    });
  });

  it('reselects same-pane tab when floating the active side tab', () => {
    useEditorStore.setState({
      tabs: makeTabs('t1', 't2'),
      activeTabId: 't2',
      sideLayout: makeLeaf(['t1', 't2'], 't2'),
    });

    useEditorStore.getState().setViewMode('t2', 'float');
    const state = useEditorStore.getState();

    expect(state.activeTabId).toBe('t1');
    expect(state.tabs.find((t) => t.id === 't2')?.viewMode).toBe('float');
    expect(state.sideLayout && containsTab(state.sideLayout, 't1')).toBe(true);
  });

  it('keeps full layout active when floating the active full tab', () => {
    useEditorStore.setState({
      tabs: makeTabs('f1', 'f2').map((tab) => ({ ...tab, viewMode: 'full' })),
      activeTabId: 'f2',
      fullLayout: makeLeaf(['f1', 'f2'], 'f2'),
    });

    useEditorStore.getState().setViewMode('f2', 'float');
    const state = useEditorStore.getState();

    expect(state.activeTabId).toBe('f1');
    expect(state.tabs.find((t) => t.id === 'f2')?.viewMode).toBe('float');
    expect(state.fullLayout && containsTab(state.fullLayout, 'f1')).toBe(true);
  });
});

// ── cycleTab (actual function) ──

describe('cycleTab', () => {
  it('cycles forward within current pane only', () => {
    useEditorStore.setState({
      tabs: makeTabs('a', 'b', 'c', 'd'),
      activeTabId: 'b',
      sideLayout: makeBranch(
        makeLeaf(['a', 'b', 'c'], 'b'),
        makeLeaf(['d'], 'd'),
      ),
    });

    cycleTab(1);
    expect(useEditorStore.getState().activeTabId).toBe('c');
  });

  it('cycles backward within current pane only', () => {
    useEditorStore.setState({
      tabs: makeTabs('a', 'b', 'c', 'd'),
      activeTabId: 'b',
      sideLayout: makeBranch(
        makeLeaf(['a', 'b', 'c'], 'b'),
        makeLeaf(['d'], 'd'),
      ),
    });

    cycleTab(-1);
    expect(useEditorStore.getState().activeTabId).toBe('a');
  });

  it('wraps around at pane boundary', () => {
    useEditorStore.setState({
      tabs: makeTabs('a', 'b', 'c'),
      activeTabId: 'c',
      sideLayout: makeLeaf(['a', 'b', 'c'], 'c'),
    });

    cycleTab(1);
    expect(useEditorStore.getState().activeTabId).toBe('a');
  });

  it('is no-op when activeTabId is in float', () => {
    useEditorStore.setState({
      tabs: [{ ...makeTab('f1'), viewMode: 'float' }],
      activeTabId: 'f1',
      sideLayout: null, fullLayout: null,
    });

    cycleTab(1);
    expect(useEditorStore.getState().activeTabId).toBe('f1'); // unchanged
  });
});

// ── activateTabByNumber (actual function) ──

describe('activateTabByNumber', () => {
  it('selects by pane-local index, not global index', () => {
    useEditorStore.setState({
      tabs: makeTabs('x', 'y', 'z', 'w'),
      activeTabId: 'x',
      sideLayout: makeBranch(
        makeLeaf(['x', 'y', 'z'], 'x'),
        makeLeaf(['w'], 'w'),
      ),
    });

    activateTabByNumber('2');
    expect(useEditorStore.getState().activeTabId).toBe('y');
  });

  it('Ctrl+9 selects last tab in pane', () => {
    useEditorStore.setState({
      tabs: makeTabs('a', 'b', 'c'),
      activeTabId: 'a',
      sideLayout: makeLeaf(['a', 'b', 'c'], 'a'),
    });

    activateTabByNumber('9');
    expect(useEditorStore.getState().activeTabId).toBe('c');
  });

  it('is no-op for out-of-range index', () => {
    useEditorStore.setState({
      tabs: makeTabs('a', 'b'),
      activeTabId: 'a',
      sideLayout: makeLeaf(['a', 'b'], 'a'),
    });

    activateTabByNumber('5'); // only 2 tabs
    expect(useEditorStore.getState().activeTabId).toBe('a'); // unchanged
  });

  it('is no-op when in float', () => {
    useEditorStore.setState({
      tabs: [{ ...makeTab('f'), viewMode: 'float' }],
      activeTabId: 'f',
      sideLayout: null, fullLayout: null,
    });

    activateTabByNumber('1');
    expect(useEditorStore.getState().activeTabId).toBe('f');
  });
});

// ── cyclePane (actual function) ──

describe('cyclePane', () => {
  it('switches to next pane', () => {
    useEditorStore.setState({
      tabs: makeTabs('a', 'b'),
      activeTabId: 'a',
      sideLayout: makeBranch(makeLeaf(['a'], 'a'), makeLeaf(['b'], 'b')),
    });

    cyclePane(1);
    expect(useEditorStore.getState().activeTabId).toBe('b');
  });

  it('switches to previous pane (wraps)', () => {
    useEditorStore.setState({
      tabs: makeTabs('a', 'b'),
      activeTabId: 'a',
      sideLayout: makeBranch(makeLeaf(['a'], 'a'), makeLeaf(['b'], 'b')),
    });

    cyclePane(-1);
    expect(useEditorStore.getState().activeTabId).toBe('b');
  });

  it('is no-op when single pane', () => {
    useEditorStore.setState({
      tabs: makeTabs('a', 'b'),
      activeTabId: 'a',
      sideLayout: makeLeaf(['a', 'b'], 'a'),
    });

    cyclePane(1);
    expect(useEditorStore.getState().activeTabId).toBe('a'); // unchanged
  });

  it('cycles through 3 panes in order', () => {
    const layout = makeBranch(
      makeBranch(makeLeaf(['a'], 'a'), makeLeaf(['b'], 'b')),
      makeLeaf(['c'], 'c'),
    );
    useEditorStore.setState({
      tabs: makeTabs('a', 'b', 'c'),
      activeTabId: 'a',
      sideLayout: layout,
    });

    cyclePane(1);
    expect(useEditorStore.getState().activeTabId).toBe('b');
    cyclePane(1);
    expect(useEditorStore.getState().activeTabId).toBe('c');
    cyclePane(1);
    expect(useEditorStore.getState().activeTabId).toBe('a'); // wrap
  });

  it('is no-op when in float', () => {
    useEditorStore.setState({
      tabs: [{ ...makeTab('f'), viewMode: 'float' }],
      activeTabId: 'f',
      sideLayout: null, fullLayout: null,
    });

    cyclePane(1);
    expect(useEditorStore.getState().activeTabId).toBe('f');
  });
});
