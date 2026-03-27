import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, EditorViewMode, SplitLeaf, EditorTab } from '@moc/shared/types';
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
import { useEditorStore, getActiveTabFromLayout } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { isTabDrag, getTabDragData } from '../../hooks/useTabDrag';

interface WorkspaceShellProps {
  project: Project;
}

export function WorkspaceShell({ project }: WorkspaceShellProps): JSX.Element {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const sideLayout = useEditorStore((s) => s.sideLayout);
  const {
    setActiveTab, closeTab, setViewMode, toggleMinimize,
    updateSideSplitRatio, updateSplitRatio, splitTab, moveTabToPane, updateFloatRect,
  } = useEditorStore();
  const { sidebarOpen, setSidebarWidth } = useUIStore();

  // Listen for detached window events
  useEffect(() => {
    const cleanupClosed = window.electron.editor.onDetachedClosed((tabId: string) => {
      const tab = useEditorStore.getState().tabs.find((t) => t.id === tabId);
      if (tab?.viewMode === 'detached') {
        closeTab(tabId);
      }
    });

    const cleanupReattach = window.electron.editor.onReattachToMode((tabId: string, mode: string) => {
      setViewMode(tabId, mode as EditorViewMode);
    });

    return () => { cleanupClosed(); cleanupReattach(); };
  }, [closeTab, setViewMode]);

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

      const handleMove = (ev: MouseEvent) => {
        if (!editorDraggingRef.current || !editorContainerRef.current) return;
        const rect = editorContainerRef.current.getBoundingClientRect();
        const ratio = (ev.clientX - rect.left) / rect.width;
        updateSideSplitRatio(sideActiveTab.id, ratio);
      };

      const handleUp = () => {
        editorDraggingRef.current = false;
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

      return (
        <div className="flex h-full flex-col overflow-hidden">
          <EditorTabStrip
            tabs={leafTabs}
            activeTabId={leaf.activeTabId}
            onActivate={setActiveTab}
            onClose={closeTab}
            onTabDrop={(droppedId) => moveTabToPane(droppedId, leaf.activeTabId, 'side')}
            rightSlot={
              <EditorViewModeSwitch
                currentMode="side"
                onModeChange={(mode) => setViewMode(leaf.activeTabId, mode)}
                onMinimize={() => toggleMinimize(leaf.activeTabId)}
              />
            }
          />
          <div className="relative flex-1 overflow-hidden">
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
    [tabs, isTabDragging, setActiveTab, closeTab, setViewMode, toggleMinimize, moveTabToPane, splitTab],
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
          <div
            className="shrink-0 cursor-col-resize bg-transparent hover:bg-accent/50"
            style={{ width: 3 }}
            onMouseDown={handleSidebarResizeStart}
          />
        </>
      )}

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
              className="relative flex flex-col overflow-hidden"
              style={{ width: hasSideEditor ? `${splitRatio * 100}%` : '100%' }}
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
              onDrop={handleCanvasDrop}
            >
              <CanvasBreadcrumb />
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
                <div
                  className="shrink-0 cursor-col-resize bg-border-subtle hover:bg-accent"
                  style={{ width: 4 }}
                  onMouseDown={handleEditorSplitDragStart}
                />
                <div
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

      <FloatWindowLayer />
      <EditorDockBar />
    </div>
  );
}
