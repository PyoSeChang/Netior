import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, EditorViewMode, SplitLeaf, EditorTab } from '@netior/shared/types';
import { ActivityBar } from '../sidebar/ActivityBar';
import { Sidebar } from '../sidebar/Sidebar';
import { ConceptWorkspace } from './ConceptWorkspace';
import { CanvasBreadcrumb } from './CanvasBreadcrumb';
import { FloatWindowLayer } from '../editor/modes/FloatWindowLayer';
import { FullModeEditor } from '../editor/modes/FullModeEditor';
import { EditorDockBar } from '../editor/EditorDockBar';
import { EditorViewModeSwitch } from '../editor/EditorViewModeSwitch';
import { EditorContent } from '../editor/EditorContent';
import { EditorTabStrip } from '../editor/EditorTabStrip';
import { SplitPaneRenderer } from '../editor/SplitPaneRenderer';
import { DropZoneOverlay } from '../editor/DropZoneOverlay';
import { CloseConfirmDialog } from '../editor/CloseConfirmDialog';
import { ResizeHandle } from '../ui/ResizeHandle';
import { useEditorStore, getActiveTabFromLayout, collectLeaves, MAIN_HOST_ID } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { isTabDrag, getTabDragData } from '../../hooks/useTabDrag';

interface WorkspaceShellProps {
  project: Project;
}

export function WorkspaceShell({ project }: WorkspaceShellProps): JSX.Element {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs.filter((t) => t.hostId === MAIN_HOST_ID));
  const sideLayout = useEditorStore((s) => s.sideLayout);
  const {
    setActiveTab, closeTab, requestCloseTab, setViewMode, toggleMinimize,
    updateSideSplitRatio, updateSplitRatio, splitTab, moveTabToPane, updateFloatRect,
  } = useEditorStore();
  const { sidebarOpen, setSidebarWidth } = useUIStore();

  // Listen for detached window close events (host-level).
  // Window close semantics: closing a detached window destroys its tabs,
  // similar to closing a browser window. This is intentional — the user
  // explicitly closes the OS window, and tabs are not silently reattached
  // to main. Use "Move to Main Window" to preserve tabs before closing.
  useEffect(() => {
    const cleanupClosed = window.electron.editor.onDetachedClosed((hostId: string) => {
      const store = useEditorStore.getState();
      const hostTabs = store.tabs.filter((t) => t.hostId === hostId);
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

  const isFullMode = activeTab && !activeTab.isMinimized && activeTab.viewMode === 'full';
  const hasSideEditor = !isFullMode && sideLayout !== null
    && tabs.some((t) => t.viewMode === 'side' && !t.isMinimized);

  // Derive the side active tab for canvas-editor split ratio
  const sideActiveTabId = sideLayout ? getActiveTabFromLayout(sideLayout, activeTabId) : null;
  const sideActiveTab = sideActiveTabId ? tabs.find((t) => t.id === sideActiveTabId) : null;

  // Track if a tab drag is happening
  const [showSideDropHint, setShowSideDropHint] = useState(false);
  const [isTabDragging, setIsTabDragging] = useState(false);

  useEffect(() => {
    const resetDragState = () => {
      setIsTabDragging(false);
      setShowSideDropHint(false);
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

      const isActivePane = leaf.tabIds.includes(activeTabId!);
      const isMultiPane = sideLayout ? collectLeaves(sideLayout).length > 1 : false;

      return (
        <div
          className={`flex h-full flex-col overflow-hidden ${isMultiPane && isActivePane ? 'ring-1 ring-accent/50' : ''}`}
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
            rightSlot={
              <EditorViewModeSwitch
                currentMode="side"
                onModeChange={(mode) => setViewMode(leaf.activeTabId, mode)}
                onMinimize={() => toggleMinimize(leaf.activeTabId)}
              />
            }
          />
          <div className="relative flex-1 overflow-hidden bg-surface-panel">
            {activeLeafTab && <EditorContent tab={activeLeafTab} />}
            <DropZoneOverlay
              onDrop={(result) => {
                setIsTabDragging(false);
                if (result.zone === 'center') {
                  moveTabToPane(result.tabId, leaf.activeTabId, 'side');
                } else {
                  const targetId = leaf.tabIds.find((id) => id !== result.tabId) ?? leaf.activeTabId;
                  if (targetId !== result.tabId || leaf.tabIds.length > 1) {
                    splitTab(targetId, result.tabId, result.direction, result.position);
                  }
                }
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
    if (isTabDrag(e)) setIsTabDragging(true);
  }, []);

  const handleShellDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsTabDragging(false);
    setShowSideDropHint(false);
  }, []);

  const handleShellDrop = useCallback(() => {
    setIsTabDragging(false);
    setShowSideDropHint(false);
  }, []);

  // Canvas area: drop → float mode
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (!isTabDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!hasSideEditor) setShowSideDropHint(true);
  }, [hasSideEditor]);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setShowSideDropHint(false);
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setShowSideDropHint(false);
    setIsTabDragging(false);
    const tabId = getTabDragData(e);
    if (!tabId) return;
    setViewMode(tabId, 'float');
    updateFloatRect(tabId, { x: e.clientX - 50, y: e.clientY - 20 });
  }, [setViewMode, updateFloatRect]);

  // Side drop hint: drop on right edge → side mode
  const handleSideHintDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSideDropHint(false);
    const tabId = getTabDragData(e);
    if (!tabId) return;
    setViewMode(tabId, 'side');
    setActiveTab(tabId);
  }, [setViewMode, setActiveTab]);

  return (
    <div className="relative flex h-full">
      <ActivityBar />

      {sidebarOpen && (
        <>
          <Sidebar project={project} />
          <ResizeHandle onMouseDown={handleSidebarResizeStart} />
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          ref={editorContainerRef}
          className="flex flex-1 overflow-hidden"
          onDragEnter={handleShellDragEnter}
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
                className="relative flex flex-col overflow-hidden"
                style={{ width: hasSideEditor ? `${splitRatio * 100}%` : '100%' }}
                onDragOver={handleCanvasDragOver}
                onDragLeave={handleCanvasDragLeave}
                onDrop={handleCanvasDrop}
              >
                <ConceptWorkspace projectId={project.id} />

                {showSideDropHint && !hasSideEditor && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-16 bg-accent/20 border-l-2 border-accent transition-all flex items-center justify-center"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={handleSideHintDrop}
                  >
                    <span className="text-xs text-accent font-medium -rotate-90 whitespace-nowrap">Side</span>
                  </div>
                )}
              </div>

              {/* Side editor */}
              {hasSideEditor && sideLayout && (
                <>
                  <ResizeHandle onMouseDown={handleEditorSplitDragStart} />
                  <div
                    data-pane="editor"
                    className="flex flex-col overflow-hidden bg-surface-panel"
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
        </div>
        <EditorDockBar />
      </div>

      <FloatWindowLayer />
      <CloseConfirmDialog />
    </div>
  );
}
