import React, { useCallback, useRef } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { Project } from '@moc/shared/types';
import { Sidebar } from '../sidebar/Sidebar';
import { ConceptWorkspace } from './ConceptWorkspace';
import { CanvasBreadcrumb } from './CanvasBreadcrumb';
import { FloatWindowLayer } from '../editor/modes/FloatWindowLayer';
import { FullModeEditor } from '../editor/modes/FullModeEditor';
import { EditorDockBar } from '../editor/EditorDockBar';
import { EditorViewModeSwitch } from '../editor/EditorViewModeSwitch';
import { EditorContent } from '../editor/EditorContent';
import { EditorTabStrip } from '../editor/EditorTabStrip';
import { useEditorStore } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';

interface WorkspaceShellProps {
  project: Project;
}

export function WorkspaceShell({ project }: WorkspaceShellProps): JSX.Element {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const { setActiveTab, closeTab, setViewMode, toggleMinimize, updateSideSplitRatio } = useEditorStore();
  const { sidebarOpen, toggleSidebar, setSidebarWidth } = useUIStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const isFullMode = activeTab && !activeTab.isMinimized && activeTab.viewMode === 'full';
  const sideTabs = tabs.filter((t) => t.viewMode === 'side' && !t.isMinimized);
  const hasSideEditor = !isFullMode && sideTabs.length > 0;

  const activeSideTab = hasSideEditor
    ? (sideTabs.find((t) => t.id === activeTabId) ?? sideTabs[0])
    : null;

  // Side editor split drag
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

  const handleSidebarResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      sidebarDraggingRef.current = true;

      const handleMove = (ev: MouseEvent) => {
        if (!sidebarDraggingRef.current) return;
        setSidebarWidth(ev.clientX);
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

  return (
    <div className="relative flex h-full">
      {/* Sidebar + resize handle */}
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

      {/* Sidebar toggle */}
      <button
        className="absolute left-1 top-1 z-20 rounded p-1 text-muted hover:bg-surface-hover hover:text-default"
        style={sidebarOpen ? { left: useUIStore.getState().sidebarWidth + 4 } : undefined}
        onClick={toggleSidebar}
      >
        {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </button>

      {/* Main content */}
      <div ref={editorContainerRef} className="flex flex-1 overflow-hidden">
        {isFullMode ? (
          <FullModeEditor tab={activeTab} />
        ) : (
          <>
            <div
              className="flex flex-col overflow-hidden"
              style={{ width: hasSideEditor ? `${splitRatio * 100}%` : '100%' }}
            >
              <CanvasBreadcrumb />
              <ConceptWorkspace projectId={project.id} />
            </div>

            {hasSideEditor && activeSideTab && (
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
                  <EditorTabStrip
                    tabs={sideTabs}
                    activeTabId={activeSideTab.id}
                    onActivate={setActiveTab}
                    onClose={closeTab}
                    rightSlot={
                      <EditorViewModeSwitch
                        currentMode={activeSideTab.viewMode}
                        onModeChange={(mode) => setViewMode(activeSideTab.id, mode)}
                        onMinimize={() => toggleMinimize(activeSideTab.id)}
                      />
                    }
                  />
                  <div className="flex-1 overflow-hidden">
                    <EditorContent tab={activeSideTab} />
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
