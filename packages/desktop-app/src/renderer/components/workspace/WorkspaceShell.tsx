import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, EditorViewMode } from '@moc/shared/types';
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
import type { DropResult } from '../editor/DropZoneOverlay';
import { useEditorStore } from '../../stores/editor-store';
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
    updateSideSplitRatio, updateSplitRatio, splitTab, updateFloatRect,
  } = useEditorStore();
  const { sidebarOpen, setSidebarWidth } = useUIStore();

  // Listen for detached window events
  useEffect(() => {
    const cleanupClosed = window.electron.editor.onDetachedClosed((tabId: string) => {
      const tab = useEditorStore.getState().tabs.find((t) => t.id === tabId);
      // Only close if still in detached mode (not already reattached)
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
  const sideTabs = tabs.filter((t) => t.viewMode === 'side' && !t.isMinimized);
  const hasSideEditor = !isFullMode && sideTabs.length > 0;

  const activeSideTab = hasSideEditor
    ? (sideTabs.find((t) => t.id === activeTabId) ?? sideTabs[0])
    : null;

  // Track if a tab drag is happening (for showing side drop hint when no side editor)
  const [showSideDropHint, setShowSideDropHint] = useState(false);

  // Side editor split drag (canvas ↔ side panel)
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorDraggingRef = useRef(false);

  const handleEditorSplitDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!activeSideTab) return;
      e.preventDefault();
      editorDraggingRef.current = true;

      const handleMove = (ev: MouseEvent) => {
        if (!editorDraggingRef.current || !editorContainerRef.current) return;
        const rect = editorContainerRef.current.getBoundingClientRect();
        const ratio = (ev.clientX - rect.left) / rect.width;
        updateSideSplitRatio(activeSideTab.id, ratio);
      };

      const handleUp = () => {
        editorDraggingRef.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [activeSideTab, updateSideSplitRatio],
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

  const splitRatio = activeSideTab?.sideSplitRatio ?? 0.5;

  // Render a leaf in the side split layout
  const renderSideLeaf = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return null;
      return <EditorContent tab={tab} />;
    },
    [tabs],
  );

  const hasSideSplit = sideLayout && sideLayout.type === 'branch';

  // Canvas area: drop → float mode
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    if (!isTabDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Show side drop hint if no side editor
    if (!hasSideEditor) setShowSideDropHint(true);
  }, [hasSideEditor]);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    // Don't hide hint when moving to child elements (e.g. the hint div itself)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setShowSideDropHint(false);
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setShowSideDropHint(false);
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

  // Side panel drop zone: split within side
  const handleSideDrop = useCallback((result: DropResult) => {
    if (result.zone === 'center') {
      // Just switch to side mode (join tab strip, no split)
      setViewMode(result.tabId, 'side');
      setActiveTab(result.tabId);
    } else if (activeSideTab) {
      // First ensure the tab is in side mode
      setViewMode(result.tabId, 'side');
      // Then split relative to the active side tab
      splitTab(activeSideTab.id, result.tabId, result.direction, result.position);
    }
  }, [activeSideTab, setViewMode, setActiveTab, splitTab]);

  // Side tab strip: dropping a tab joins the side panel
  const handleSideTabDrop = useCallback((tabId: string) => {
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

      <div ref={editorContainerRef} className="flex flex-1 overflow-hidden">
        {isFullMode ? (
          <FullModeEditor tab={activeTab} />
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

              {/* Side drop hint (right edge) when no side editor exists */}
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
            {hasSideEditor && activeSideTab && (
              <>
                <div
                  className="shrink-0 cursor-col-resize bg-border-subtle hover:bg-accent"
                  style={{ width: 4 }}
                  onMouseDown={handleEditorSplitDragStart}
                />
                <div
                  className="relative flex flex-col overflow-hidden bg-surface-panel"
                  style={{ width: `${(1 - splitRatio) * 100}%` }}
                >
                  <EditorTabStrip
                    tabs={sideTabs}
                    activeTabId={activeSideTab.id}
                    onActivate={setActiveTab}
                    onClose={closeTab}
                    onTabDrop={handleSideTabDrop}
                    rightSlot={
                      <EditorViewModeSwitch
                        currentMode={activeSideTab.viewMode}
                        onModeChange={(mode) => setViewMode(activeSideTab.id, mode)}
                        onMinimize={() => toggleMinimize(activeSideTab.id)}
                      />
                    }
                  />
                  <div className="relative flex-1 overflow-hidden">
                    {hasSideSplit && sideLayout ? (
                      <SplitPaneRenderer
                        node={sideLayout}
                        mode="side"
                        renderLeaf={renderSideLeaf}
                        onRatioChange={updateSplitRatio}
                      />
                    ) : (
                      <EditorContent tab={activeSideTab} />
                    )}
                    {/* Drop zone overlay for splitting within side panel */}
                    <DropZoneOverlay onDrop={handleSideDrop} />
                  </div>
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
