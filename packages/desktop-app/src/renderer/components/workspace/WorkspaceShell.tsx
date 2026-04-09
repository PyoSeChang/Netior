import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Project, EditorViewMode, SplitLeaf, EditorTab } from '@netior/shared/types';
import { ActivityBar } from '../sidebar/ActivityBar';
import { Sidebar } from '../sidebar/Sidebar';
import { NetworkWorkspace } from './NetworkWorkspace';
import { FloatWindowLayer } from '../editor/modes/FloatWindowLayer';
import { FullModeEditor } from '../editor/modes/FullModeEditor';
import { EditorViewModeSwitch } from '../editor/EditorViewModeSwitch';
import { EditorContent } from '../editor/EditorContent';
import { EditorTabStrip } from '../editor/EditorTabStrip';
import { SplitPaneRenderer } from '../editor/SplitPaneRenderer';
import { DropZoneOverlay } from '../editor/DropZoneOverlay';
import { CloseConfirmDialog } from '../editor/CloseConfirmDialog';
import { ResizeHandle } from '../ui/ResizeHandle';
import { useEditorStore, getActiveTabFromLayout, collectLeaves, MAIN_HOST_ID } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { isTabDrag, getTabDragDataAsync } from '../../hooks/useTabDrag';
import { getFileOpenDragData, isFileOpenDrag } from '../../hooks/useFileOpenDrag';
import { openFileBesideTab, openFileInPane, openFileTab } from '../../lib/open-file-tab';
import type { DropResult } from '../editor/DropZoneOverlay';

interface WorkspaceShellProps {
  project: Project;
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

export function WorkspaceShell({ project }: WorkspaceShellProps): JSX.Element {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs.filter((t) => t.hostId === MAIN_HOST_ID));
  const sideLayout = useEditorStore((s) => s.sideLayout);
  const {
    setActiveTab, closeTab, requestCloseTab, setViewMode, toggleMinimize,
    updateSideSplitRatio, updateSplitRatio, splitTab, moveTabToPane, moveTabToHost, updateFloatRect,
  } = useEditorStore();
  const { sidebarOpen, setSidebarWidth } = useUIStore();

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
  const fullActiveTabId = useEditorStore((s) => {
    if (!s.fullLayout) return null;
    return getActiveTabFromLayout(s.fullLayout, s.activeTabId);
  });

  const isFullMode = fullActiveTabId !== null
    && tabs.some((t) => t.id === fullActiveTabId && !t.isMinimized && t.viewMode === 'full');
  const hasSideEditor = !isFullMode && sideLayout !== null
    && tabs.some((t) => t.viewMode === 'side' && !t.isMinimized);

  // Derive the side active tab for canvas-editor split ratio
  const sideActiveTabId = sideLayout ? getActiveTabFromLayout(sideLayout, activeTabId) : null;
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

  useEffect(() => {
    const resetDragState = () => {
      setIsTabDragging(false);
      setShowSideDropHint(false);
      setShowFloatDropHint(false);
    };
    document.addEventListener('dragend', resetDragState);
    return () => document.removeEventListener('dragend', resetDragState);
  }, []);

  // Side editor split drag (canvas ↔ side panel)
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorDraggingRef = useRef(false);

  const handleEditorSplitDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!sideActiveTab) return;
      e.preventDefault();
      editorDraggingRef.current = true;

      const container = editorContainerRef.current;
      if (!container) return;
      const canvasPane = container.querySelector('[data-pane="canvas"]') as HTMLElement | null;
      const editorPane = container.querySelector('[data-pane="editor"]') as HTMLElement | null;

      const handleMove = (ev: MouseEvent) => {
        if (!editorDraggingRef.current || !container) return;
        const rect = container.getBoundingClientRect();
        const ratio = Math.max(0.2, Math.min(0.8, (ev.clientX - rect.left) / rect.width));
        // Direct DOM update — no React re-render during drag
        if (canvasPane) canvasPane.style.width = `${ratio * 100}%`;
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
    [sideActiveTab, updateSideSplitRatio],
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
        setSidebarWidth(ev.clientX - activityBarWidth);
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

  // Render a leaf in the side split layout (each leaf gets its own tab strip + drop zone)
  const renderSideLeaf = useCallback(
    (leaf: SplitLeaf) => {
      const leafTabs = leaf.tabIds
        .map((id) => tabs.find((t) => t.id === id))
        .filter((t): t is EditorTab => t != null);
      const activeLeafTab = leafTabs.find((t) => t.id === leaf.activeTabId) ?? leafTabs[0];

      const isActivePane = sideActiveTabId ? leaf.tabIds.includes(sideActiveTabId) : false;
      const isMultiPane = sideLayout ? collectLeaves(sideLayout).length > 1 : false;

      return (
        <div
          className={`flex h-full min-h-0 flex-col overflow-hidden ${isMultiPane && isActivePane ? 'ring-1 ring-accent' : ''}`}
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
            onFileDrop={(filePaths) => { void openDroppedFilesInSideLeaf(filePaths, leaf); }}
            rightSlot={
              <EditorViewModeSwitch
                currentMode="side"
                onModeChange={(mode) => setViewMode(leaf.activeTabId, mode)}
                onMinimize={() => toggleMinimize(leaf.activeTabId)}
              />
            }
          />
          <div className="relative flex-1 min-h-0 overflow-hidden bg-surface-panel">
            {activeLeafTab && <EditorContent tab={activeLeafTab} />}
            <DropZoneOverlay
              onDrop={(result) => {
                flushSync(() => setIsTabDragging(false));
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
                void openDroppedFilesInSideLeaf(filePaths, leaf, result);
              }}
              active={isTabDragging}
            />
          </div>
        </div>
      );
    },
    [tabs, isTabDragging, activeTabId, sideLayout, setActiveTab, requestCloseTab, setViewMode, toggleMinimize, moveTabToPane, splitTab],
  );

  // Global drag tracking for drop zone activation
  const handleShellDragEnter = useCallback((e: React.DragEvent) => {
    if (isTabDrag(e) || isFileOpenDrag(e)) setIsTabDragging(true);
  }, []);

  const handleShellDragOver = useCallback((e: React.DragEvent) => {
    if (!isTabDrag(e) && !isFileOpenDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isFileOpenDrag(e) ? 'copy' : 'move';
    if (!hasSideEditor) {
      setShowSideDropHint(true);
      setShowFloatDropHint(true);
    }
  }, [hasSideEditor]);

  const handleShellDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsTabDragging(false);
    setShowSideDropHint(false);
    setShowFloatDropHint(false);
  }, []);

  const handleShellDrop = useCallback(() => {
    setIsTabDragging(false);
    setShowSideDropHint(false);
    setShowFloatDropHint(false);
  }, []);

  // Canvas area: drop → float mode
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (!isTabDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!hasSideEditor) {
      setShowSideDropHint(true);
      setShowFloatDropHint(true);
    }
  }, [hasSideEditor]);

  const handleCanvasDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setShowSideDropHint(false);
    setShowFloatDropHint(false);
    setIsTabDragging(false);
    const tabId = await getTabDragDataAsync(e);
    console.log(`[WorkspaceShell] float drop tabId=${tabId}, x=${e.clientX}, y=${e.clientY}`);
    if (!tabId) return;
    applyDropModeToMain(tabId, 'float');
    updateFloatRect(tabId, { x: e.clientX - 50, y: e.clientY - 20 });
  }, [applyDropModeToMain, updateFloatRect]);

  // Side drop hint: drop on right edge → side mode
  const handleSideHintDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSideDropHint(false);
    setShowFloatDropHint(false);
    setIsTabDragging(false);
    if (isFileOpenDrag(e)) {
      const filePaths = getFileOpenDragData(e);
      console.log(`[WorkspaceShell] side file drop count=${filePaths.length}`);
      for (const filePath of filePaths) {
        await openFileTab({ filePath, placement: 'smart' });
      }
      return;
    }

    const tabId = await getTabDragDataAsync(e);
    console.log(`[WorkspaceShell] side drop tabId=${tabId}`);
    if (tabId) applyDropModeToMain(tabId, 'side');
  }, [applyDropModeToMain]);

  return (
    <div className="relative flex h-full">
      <ActivityBar />

      {sidebarOpen && (
        <>
          <Sidebar project={project} />
          <ResizeHandle onMouseDown={handleSidebarResizeStart} />
        </>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={editorContainerRef}
          className="relative flex min-h-0 flex-1 overflow-hidden"
          onDragEnter={handleShellDragEnter}
          onDragOver={handleShellDragOver}
          onDragLeave={handleShellDragLeave}
          onDrop={handleShellDrop}
        >
          {isFullMode ? (
            <FullModeEditor />
          ) : (
            <>
              {/* Canvas area */}
              <div
                data-pane="canvas"
                className="relative flex min-h-0 min-w-0 flex-col overflow-hidden"
                style={{ width: hasSideEditor ? `${splitRatio * 100}%` : '100%' }}
                onDragOver={handleCanvasDragOver}
                onDrop={handleCanvasDrop}
              >
                <NetworkWorkspace projectId={project.id} />
              </div>

              {/* Side editor */}
              {hasSideEditor && sideLayout && (
                <>
                  <ResizeHandle onMouseDown={handleEditorSplitDragStart} />
                  <div
                    data-pane="editor"
                    className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface-panel"
                    style={{ width: `${(1 - splitRatio) * 100}%` }}
                  >
                    <SplitPaneRenderer
                      node={sideLayout}
                      mode="side"
                      renderLeaf={renderSideLeaf}
                      onRatioChange={updateSplitRatio}
                    />
                  </div>
                </>
              )}
            </>
          )}
          {isTabDragging && !hasSideEditor && (
            <>
              {showFloatDropHint && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <div
                    className="pointer-events-auto rounded-lg border-2 border-dashed border-accent bg-interactive-muted px-6 py-3 text-sm font-medium text-accent"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={handleCanvasDrop}
                  >
                    Float
                  </div>
                </div>
              )}
              {showSideDropHint && (
                <div
                  className="absolute right-0 top-0 bottom-0 z-20 w-20 bg-interactive-selected border-l-2 border-accent flex items-center justify-center"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={handleSideHintDrop}
                >
                  <span className="text-xs text-accent font-medium -rotate-90 whitespace-nowrap">Side</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <FloatWindowLayer />
      <CloseConfirmDialog />
    </div>
  );
}
