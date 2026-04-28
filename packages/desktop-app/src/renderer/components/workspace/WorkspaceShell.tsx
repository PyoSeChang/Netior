import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Project, EditorViewMode, SplitLeaf, EditorTab } from '@netior/shared/types';
import { ActivityBar } from '../sidebar/ActivityBar';
import { Sidebar } from '../sidebar/Sidebar';
import { NetworkWorkspace } from './NetworkWorkspace';
import { FloatWindowLayer } from '../editor/modes/FloatWindowLayer';
import { FullModeEditor } from '../editor/modes/FullModeEditor';
import { EditorViewModeMenu } from '../editor/EditorViewModeSwitch';
import { EditorContent } from '../editor/EditorContent';
import { EditorTabStrip } from '../editor/EditorTabStrip';
import { MinimizedEditorTabs } from '../editor/MinimizedEditorTabs';
import { SplitPaneRenderer, type PaneAdjacency } from '../editor/SplitPaneRenderer';
import { DropZoneOverlay } from '../editor/DropZoneOverlay';
import { CloseConfirmDialog } from '../editor/CloseConfirmDialog';
import { ResizeHandle } from '../ui/ResizeHandle';
import { AppChromeMark } from '../ui/NetiorTitleMark';
import { NetworkBreadcrumb } from './NetworkBreadcrumb';
import { NetworkControls } from './NetworkControls';
import type { LayoutControlsRendererProps } from './layout-plugins/types';
import {
  useEditorStore,
  containsTab,
  getRememberedActiveTabFromLayout,
  MAIN_HOST_ID,
} from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { useSettingsStore } from '../../stores/settings-store';
import { isTabDrag, getTabDragDataAsync, flushTabDragData } from '../../hooks/useTabDrag';
import { getFileOpenDragData, isFileOpenDrag } from '../../hooks/useFileOpenDrag';
import { openFileBesideTab, openFileInPane, openFileTab } from '../../lib/open-file-tab';
import { getAllowedViewModes } from '../../lib/editor-view-mode-rules';
import type { DropResult } from '../editor/DropZoneOverlay';
import { useFileTabStaleWatcher } from '../../hooks/useFileTabStaleWatcher';

interface WorkspaceShellProps {
  project: Project | null;
  rightChrome?: React.ReactNode;
}

function NetworkTabStrip({ controls }: { controls: LayoutControlsRendererProps | null }): JSX.Element {
  return (
    <div
      className="tab-strip network-tab-strip workspace-title-strip grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2"
      style={{ height: 35, WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex min-w-0 items-center justify-start"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <AppChromeMark />
      </div>
      <div
        className="min-w-0 max-w-[520px] overflow-hidden px-3"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <NetworkBreadcrumb />
      </div>
      <div
        className="relative z-10 flex min-w-0 items-center justify-end"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {controls && (
          <NetworkControls {...controls} presentation="header-fixed" />
        )}
      </div>
    </div>
  );
}

function PaneSplitHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }): JSX.Element {
  return (
    <div
      className="pane-split-resize-zone"
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
    />
  );
}

function areNetworkControlsEqual(
  a: LayoutControlsRendererProps | null,
  b: LayoutControlsRendererProps | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  const extraItemsEqual =
    a.extraItems === b.extraItems
    || (
      (a.extraItems?.length ?? 0) === (b.extraItems?.length ?? 0)
      && (a.extraItems ?? []).every((item, index) => {
        const other = b.extraItems?.[index];
        return !!other
          && item.key === other.key
          && item.label === other.label
          && item.active === other.active;
      })
    );
  const hiddenControlsEqual =
    a.hiddenControls === b.hiddenControls
    || (
      (a.hiddenControls?.length ?? 0) === (b.hiddenControls?.length ?? 0)
      && (a.hiddenControls ?? []).every((item, index) => item === b.hiddenControls?.[index])
    );

  return (
    a.mode === b.mode
    && a.zoom === b.zoom
    && a.panX === b.panX
    && a.panY === b.panY
    && a.canGoBack === b.canGoBack
    && a.canGoForward === b.canGoForward
    && a.config === b.config
    && hiddenControlsEqual
    && extraItemsEqual
    && a.setZoom === b.setZoom
    && a.setPanX === b.setPanX
    && a.setPanY === b.setPanY
    && a.updateConfig === b.updateConfig
    && a.onToggleMode === b.onToggleMode
    && a.onZoomIn === b.onZoomIn
    && a.onZoomOut === b.onZoomOut
    && a.onFitToScreen === b.onFitToScreen
    && a.onNavigateBack === b.onNavigateBack
    && a.onNavigateForward === b.onNavigateForward
  );
}

async function openDroppedFilesInSideLeaf(
  filePaths: string[],
  leaf: SplitLeaf,
  drop?: Omit<DropResult, 'tabId'>,
): Promise<void> {
  if (filePaths.length === 0) return;
  if (!drop || drop.zone === 'center') {
    for (const filePath of filePaths) {
      await openFileInPane(filePath, leaf.activeTabId, 'side');
    }
    return;
  }

  let targetTabId = await openFileBesideTab(filePaths[0], leaf.activeTabId, 'side', drop.direction, drop.position);
  for (const filePath of filePaths.slice(1)) {
    await openFileInPane(filePath, targetTabId, 'side');
    targetTabId = `file:${filePath}`;
  }
}

export function WorkspaceShell({ project, rightChrome = null }: WorkspaceShellProps): JSX.Element {
  useFileTabStaleWatcher();

  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs.filter((t) => t.hostId === MAIN_HOST_ID));
  const sideLayout = useEditorStore((s) => s.sideLayout);
  const {
    setActiveTab, closeTab, requestCloseTab, setViewMode, toggleMinimize,
    updateSideSplitRatio, updateSplitRatio, splitTab, moveTabToPane, moveTabWithinStrip, moveTabToHost, updateFloatRect,
  } = useEditorStore();
  const { sidebarOpen, sidebarWidth, setSidebarWidth } = useUIStore();
  const networkViewerPlacement = useSettingsStore((s) => s.networkViewerPlacement);
  const isNetworkPaneLeft = networkViewerPlacement === 'network-left';

  // Listen for detached window close events (host-level).
  // Window close semantics: closing a detached window destroys its tabs,
  // similar to closing a browser window. This is intentional — the user
  // explicitly closes the OS window, and tabs are not silently reattached
  // to main. Use "Move to Main Window" to preserve tabs before closing.
  useEffect(() => {
    const cleanupClosed = window.electron.editor.onDetachedClosed((hostId: string) => {
      console.log(`[MainWindow] onDetachedClosed — hostId=${hostId}`);
      const store = useEditorStore.getState();
      const hostTabs = store.tabs.filter((t) => t.hostId === hostId);
      console.log(`[MainWindow] cleaning up ${hostTabs.length} tabs for closed host`);
      for (const tab of hostTabs) {
        store.closeTab(tab.id);
      }
      if (store.hosts[hostId]) {
        store.removeHost(hostId);
      }
    });

    const cleanupReattach = window.electron.editor.onReattachToMode((tabId: string, _mode: string) => {
      useEditorStore.getState().moveTabToHost(tabId, MAIN_HOST_ID);
    });

    return () => { cleanupClosed(); cleanupReattach(); };
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const fullFocusedTabId = useEditorStore((s) => (
    s.activeTabId && s.fullLayout && containsTab(s.fullLayout, s.activeTabId) ? s.activeTabId : null
  ));

  const isFullMode = tabs.some((t) => t.viewMode === 'full' && !t.isMinimized);
  const hasSideEditor = !isFullMode && sideLayout !== null
    && tabs.some((t) => t.viewMode === 'side' && !t.isMinimized);

  const sideFocusedTabId = useEditorStore((s) => (
    s.activeTabId && s.sideLayout && containsTab(s.sideLayout, s.activeTabId) ? s.activeTabId : null
  ));
  const sideActiveTabId = useEditorStore((s) => (
    s.sideLayout ? getRememberedActiveTabFromLayout(s.sideLayout, s.sideLastActiveTabId) : null
  ));
  const sideActiveTab = sideActiveTabId ? tabs.find((t) => t.id === sideActiveTabId) : null;

  const applyDropModeToMain = useCallback((tabId: string, mode: 'side' | 'float') => {
    const tab = useEditorStore.getState().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.hostId === MAIN_HOST_ID) {
      setViewMode(tabId, mode);
      if (mode === 'side') {
        setActiveTab(tabId);
      }
      return;
    }

    console.log(`[WorkspaceShell] reattach via drop tabId=${tabId}, fromHost=${tab.hostId}, toMode=${mode}`);
    moveTabToHost(tabId, MAIN_HOST_ID, mode);
  }, [moveTabToHost, setActiveTab, setViewMode]);

  // Track if a tab drag is happening
  const [showSideDropHint, setShowSideDropHint] = useState(false);
  const [showFloatDropHint, setShowFloatDropHint] = useState(false);
  const [isTabDragging, setIsTabDragging] = useState(false);
  const [networkControls, setNetworkControls] = useState<LayoutControlsRendererProps | null>(null);
  const networkControlsRef = useRef<LayoutControlsRendererProps | null>(null);

  const handleNetworkControlsChange = useCallback((controls: LayoutControlsRendererProps | null) => {
    if (areNetworkControlsEqual(networkControlsRef.current, controls)) return;
    networkControlsRef.current = controls;
    setNetworkControls(controls);
  }, []);

  useEffect(() => {
    const resetDragState = () => {
      setIsTabDragging(false);
      setShowSideDropHint(false);
      setShowFloatDropHint(false);
    };
    document.addEventListener('dragend', resetDragState);
    return () => document.removeEventListener('dragend', resetDragState);
  }, []);

  useEffect(() => {
    if (!hasSideEditor && !isFullMode) return;
    setShowSideDropHint(false);
    setShowFloatDropHint(false);
  }, [hasSideEditor, isFullMode]);

  const clearShellDropState = useCallback(() => {
    setIsTabDragging(false);
    setShowSideDropHint(false);
    setShowFloatDropHint(false);
  }, []);

  // Side editor split drag (workspace <-> side panel)
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorDraggingRef = useRef(false);

  const handleEditorSplitDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!sideActiveTab) return;
      e.preventDefault();
      editorDraggingRef.current = true;

      const container = editorContainerRef.current;
      if (!container) return;
      const workspacePane = container.querySelector('[data-pane="workspace"]') as HTMLElement | null;
      const editorPane = container.querySelector('[data-pane="editor"]') as HTMLElement | null;

      const handleMove = (ev: MouseEvent) => {
        if (!editorDraggingRef.current || !container) return;
        const rect = container.getBoundingClientRect();
        const rawRatio = isNetworkPaneLeft
          ? (ev.clientX - rect.left) / rect.width
          : (rect.right - ev.clientX) / rect.width;
        const ratio = Math.max(0.2, Math.min(0.8, rawRatio));
        // Direct DOM update — no React re-render during drag
        if (workspacePane) workspacePane.style.width = `${ratio * 100}%`;
        if (editorPane) editorPane.style.width = `${(1 - ratio) * 100}%`;
        (container as any).__pendingRatio = ratio;
      };

      const handleUp = () => {
        editorDraggingRef.current = false;
        const finalRatio = (container as any).__pendingRatio;
        if (finalRatio != null) {
          updateSideSplitRatio(sideActiveTab.id, finalRatio);
          delete (container as any).__pendingRatio;
        }
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [isNetworkPaneLeft, sideActiveTab, updateSideSplitRatio],
  );

  // Sidebar resize drag
  const sidebarDraggingRef = useRef(false);
  const activityBarWidth = 40;

  const handleSidebarResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      sidebarDraggingRef.current = true;

      const handleMove = (ev: MouseEvent) => {
        if (!sidebarDraggingRef.current) return;
        setSidebarWidth(window.innerWidth - ev.clientX - activityBarWidth);
      };

      const handleUp = () => {
        sidebarDraggingRef.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [setSidebarWidth],
  );

  const splitRatio = sideActiveTab?.sideSplitRatio ?? 0.5;
  const rightRailWidth = sidebarOpen ? sidebarWidth + activityBarWidth : activityBarWidth;
  const rightChromeWidth = Math.max(rightRailWidth, 180);
  const workspacePaneWidth = hasSideEditor
    ? `${splitRatio * 100}%`
    : '100%';
  const editorPaneWidth = `${(1 - splitRatio) * 100}%`;

  // Render a leaf in the side split layout (each leaf gets its own tab strip + drop zone)
  const renderSideLeaf = useCallback(
    (leaf: SplitLeaf, adjacency?: PaneAdjacency) => {
      const leafTabs = leaf.tabIds
        .map((id) => tabs.find((t) => t.id === id))
        .filter((t): t is EditorTab => t != null);
      const activeLeafTab = leafTabs.find((t) => t.id === leaf.activeTabId) ?? leafTabs[0];

      const isActivePane = sideFocusedTabId ? leaf.tabIds.includes(sideFocusedTabId) : false;

      return (
        <div
          className="flex h-full min-h-0 flex-col overflow-visible"
          onMouseDown={() => {
            if (!leaf.tabIds.includes(activeTabId!)) {
              setActiveTab(leaf.activeTabId);
            }
          }}
        >
          <EditorTabStrip
            tabs={leafTabs}
            activeTabId={leaf.activeTabId}
            isFocusedPane={isActivePane}
            onActivate={setActiveTab}
            onClose={requestCloseTab}
            onTabDrop={(droppedId) => moveTabToPane(droppedId, leaf.activeTabId, 'side')}
            onTabReorder={moveTabWithinStrip}
            onFileDrop={(filePaths) => { void openDroppedFilesInSideLeaf(filePaths, leaf); }}
            leftSlot={
              <EditorViewModeMenu
                currentMode="side"
                availableModes={getAllowedViewModes(activeLeafTab)}
                onModeChange={(mode) => setViewMode(leaf.activeTabId, mode)}
                onMinimize={() => toggleMinimize(leaf.activeTabId)}
              />
            }
          />
          <div
            className={[
              'pane-surface pane-surface--editor relative flex-1 min-h-0 overflow-hidden',
              adjacency?.bottom ? 'pane-surface--adjacent-bottom' : '',
            ].filter(Boolean).join(' ')}
          >
            {activeLeafTab && <EditorContent tab={activeLeafTab} />}
            <DropZoneOverlay
              onDrop={(result) => {
                flushSync(() => clearShellDropState());
                if (result.zone === 'center') {
                  moveTabToPane(result.tabId, leaf.activeTabId, 'side');
                } else {
                  const targetId = leaf.tabIds.find((id) => id !== result.tabId) ?? leaf.activeTabId;
                  if (targetId !== result.tabId || leaf.tabIds.length > 1) {
                    splitTab(targetId, result.tabId, result.direction, result.position);
                  }
                }
              }}
              onFileDrop={(filePaths, result) => {
                flushSync(() => clearShellDropState());
                void openDroppedFilesInSideLeaf(filePaths, leaf, result);
              }}
              active={isTabDragging}
            />
          </div>
        </div>
      );
    },
    [tabs, isTabDragging, activeTabId, sideFocusedTabId, sideLayout, setActiveTab, requestCloseTab, setViewMode, toggleMinimize, moveTabToPane, moveTabWithinStrip, splitTab, clearShellDropState],
  );

  // Global drag tracking for drop zone activation
  const handleShellDragEnter = useCallback((e: React.DragEvent) => {
    if (isTabDrag(e) || isFileOpenDrag(e)) setIsTabDragging(true);
  }, []);

  const handleShellDragOver = useCallback((e: React.DragEvent) => {
    if (!isTabDrag(e) && !isFileOpenDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isFileOpenDrag(e) ? 'copy' : 'move';
    if (!hasSideEditor && !isFullMode) {
      setShowSideDropHint(true);
      setShowFloatDropHint(true);
    }
  }, [hasSideEditor, isFullMode]);

  const handleShellDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsTabDragging(false);
    setShowSideDropHint(false);
    setShowFloatDropHint(false);
  }, []);

  const handleShellDrop = useCallback(() => {
    clearShellDropState();
  }, [clearShellDropState]);

  // Workspace area: drop -> float mode
  const handleWorkspaceDragOver = useCallback((e: React.DragEvent) => {
    if (!isTabDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!hasSideEditor && !isFullMode) {
      setShowSideDropHint(true);
      setShowFloatDropHint(true);
    }
  }, [hasSideEditor, isFullMode]);

  const handleWorkspaceDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const tabId = await getTabDragDataAsync(e);
    clearShellDropState();
    flushTabDragData();
    console.log(`[WorkspaceShell] float drop tabId=${tabId}, x=${e.clientX}, y=${e.clientY}`);
    if (!tabId) return;
    applyDropModeToMain(tabId, 'float');
    updateFloatRect(tabId, { x: e.clientX - 50, y: e.clientY - 20 });
  }, [applyDropModeToMain, clearShellDropState, updateFloatRect]);

  // Side drop hint: drop on right edge → side mode
  const handleSideHintDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFileOpenDrag(e)) {
      clearShellDropState();
      const filePaths = getFileOpenDragData(e);
      console.log(`[WorkspaceShell] side file drop count=${filePaths.length}`);
      for (const filePath of filePaths) {
        await openFileTab({ filePath, placement: 'smart' });
      }
      return;
    }

    const tabId = await getTabDragDataAsync(e);
    clearShellDropState();
    flushTabDragData();
    console.log(`[WorkspaceShell] side drop tabId=${tabId}`);
    if (tabId) applyDropModeToMain(tabId, 'side');
  }, [applyDropModeToMain, clearShellDropState]);

  const workspacePane = (
    <div
      data-pane="workspace"
      className="pane-shell pane-shell--network"
      style={{ width: workspacePaneWidth }}
      onDragOver={handleWorkspaceDragOver}
      onDrop={handleWorkspaceDrop}
    >
      <NetworkTabStrip controls={networkControls} />
      <div className="pane-surface pane-surface--network relative min-h-0 flex-1 overflow-hidden">
        <NetworkWorkspace
          projectId={project?.id ?? null}
          onControlsChange={handleNetworkControlsChange}
        />
      </div>
    </div>
  );

  const editorPane = hasSideEditor && sideLayout ? (
    <div
      data-pane="editor"
      className="pane-shell pane-shell--editor"
      style={{ width: editorPaneWidth }}
    >
      <SplitPaneRenderer
        node={sideLayout}
        mode="side"
        renderLeaf={renderSideLeaf}
        onRatioChange={updateSplitRatio}
      />
    </div>
  ) : null;

  return (
    <div className="relative flex h-full bg-surface-chrome">
      <div className="flex min-w-0 flex-1 flex-col px-2 pb-2">
        <div
          ref={editorContainerRef}
          className="workspace-frame relative flex min-h-0 min-w-0 flex-1 overflow-visible"
          onDragEnter={handleShellDragEnter}
          onDragOver={handleShellDragOver}
          onDragLeave={handleShellDragLeave}
          onDrop={handleShellDrop}
        >
          {isFullMode ? (
            <FullModeEditor />
          ) : (
            <>
              {hasSideEditor && editorPane ? (
                isNetworkPaneLeft ? (
                  <>
                    {workspacePane}
                    <PaneSplitHandle onMouseDown={handleEditorSplitDragStart} />
                    {editorPane}
                  </>
                ) : (
                  <>
                    {editorPane}
                    <PaneSplitHandle onMouseDown={handleEditorSplitDragStart} />
                    {workspacePane}
                  </>
                )
              ) : workspacePane}
            </>
          )}
          {isTabDragging && !hasSideEditor && !isFullMode && (
            <>
              {showFloatDropHint && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div
                    className="pointer-events-auto rounded-lg border-2 border-dashed border-accent bg-state-muted px-6 py-3 text-sm font-medium text-accent"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={handleWorkspaceDrop}
                  >
                    Float
                  </div>
                </div>
              )}
              {showSideDropHint && (
                <div
                  className={`absolute top-0 bottom-0 z-20 flex w-20 items-center justify-center bg-state-selected border-accent ${
                    isNetworkPaneLeft ? 'right-0 border-l-2' : 'left-0 border-r-2'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={handleSideHintDrop}
                >
                  <span className={`whitespace-nowrap text-xs font-medium text-accent ${isNetworkPaneLeft ? '-rotate-90' : 'rotate-90'}`}>Side</span>
                </div>
              )}
            </>
          )}
        </div>
        <MinimizedEditorTabs />
      </div>

      <div
        className="relative flex h-full min-w-0 shrink-0 flex-col bg-surface-chrome"
        style={{ width: rightRailWidth, flexBasis: rightRailWidth }}
      >
        {rightChrome && (
          <div
            className="absolute right-0 top-0 z-[1000]"
            style={{ width: rightChromeWidth }}
          >
            {rightChrome}
          </div>
        )}
        {rightChrome && <div className="h-[35px] shrink-0" aria-hidden="true" />}
        <div className="flex min-h-0 flex-1 justify-end pb-2">
          {sidebarOpen && <ResizeHandle onMouseDown={handleSidebarResizeStart} />}
          {sidebarOpen && <Sidebar project={project} />}
          <ActivityBar />
        </div>
      </div>

      <FloatWindowLayer />
      <CloseConfirmDialog />
    </div>
  );
}
