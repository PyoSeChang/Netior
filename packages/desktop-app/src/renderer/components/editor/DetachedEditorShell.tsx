import React, { useEffect, useState } from 'react';
import { EditorContent } from './EditorContent';
import { EditorTabStrip } from './EditorTabStrip';
import { CloseConfirmDialog } from './CloseConfirmDialog';
import { WindowAlwaysOnTopButton } from '../ui/WindowAlwaysOnTopButton';
import { WindowControls } from '../ui/WindowControls';
import { WindowTitleBar } from '../ui/WindowTitleBar';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useDetachedShortcuts } from '../../shortcuts/useDetachedShortcuts';
import { initDetachedBridge } from '../../lib/editor-state-bridge';
import { refreshAgentSessionStore } from '../../lib/agent-session-store';
import { useNetiorSync } from '../../hooks/useNetiorSync';
import { getTabDragDataAsync, isTabDrag } from '../../hooks/useTabDrag';
import { ToastContainer } from '../ui/Toast';

interface DetachedEditorShellProps {
  hostId: string;
}

export function DetachedEditorShell({ hostId }: DetachedEditorShellProps): JSX.Element {
  const [ready, setReady] = useState(false);

  // Bootstrap: fetch state from main window via IPC before rendering
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    initDetachedBridge(hostId).then((c) => {
      cleanup = c;
      void refreshAgentSessionStore().catch(() => {});
      setReady(true);
    });
    return () => cleanup?.();
  }, []);

  const projectId = useProjectStore((s) => s.currentProject?.id ?? null);
  useNetiorSync(projectId);

  const tabs = useEditorStore((s) => s.tabs.filter((t) => t.hostId === hostId));
  const host = useEditorStore((s) => s.hosts[hostId]);
  const hostLabel = host?.label ?? 'Editor';
  const activeTabId = host?.activeTabId ?? null;
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? null;

  const { setHostActiveTab, requestCloseTab, moveTabToHost } = useEditorStore();

  const handleHostDragOver = (e: React.DragEvent) => {
    if (!isTabDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleHostDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const tabId = await getTabDragDataAsync(e);
    if (tabId) {
      moveTabToHost(tabId, hostId);
    }
  };

  // Set up detached-window shortcuts
  useDetachedShortcuts(hostId);

  // Notify main that focus is on this host when window receives focus
  useEffect(() => {
    const onFocus = () => {
      useEditorStore.getState().setFocusedHost(hostId);
      void refreshAgentSessionStore().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [hostId]);

  // If host is removed (all tabs closed via sync), close the window.
  // Delay briefly to let state sync settle — avoids premature close during hydration.
  useEffect(() => {
    if (!ready || host || tabs.length > 0) return;
    const timer = setTimeout(() => {
      const s = useEditorStore.getState();
      const myTabs = s.tabs.filter((t) => t.hostId === hostId);
      const stillEmpty = !s.hosts[hostId] && myTabs.length === 0;
      if (stillEmpty) {
        window.close();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [ready, host, tabs.length, hostId]);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-panel">
        <span className="text-xs text-muted">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-surface-base text-default">
      <WindowTitleBar
        left={<div className="min-w-0 truncate text-sm font-medium text-secondary">{hostLabel}</div>}
        right={(
          <div className="flex items-stretch">
            <WindowAlwaysOnTopButton />
            <WindowControls />
          </div>
        )}
      />

      <EditorTabStrip
        tabs={tabs}
        activeTabId={activeTabId}
        hostId={hostId}
        onActivate={(tabId) => setHostActiveTab(hostId, tabId)}
        onClose={requestCloseTab}
        onTabDrop={(tabId) => moveTabToHost(tabId, hostId)}
      />

      {/* Editor content */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <div className="h-full" onDragOver={handleHostDragOver} onDrop={handleHostDrop}>
            <EditorContent tab={activeTab} />
          </div>
        ) : (
          <div
            className="flex h-full items-center justify-center text-xs text-muted"
            onDragOver={handleHostDragOver}
            onDrop={handleHostDrop}
          >
            No open tabs
          </div>
        )}
      </div>

      <CloseConfirmDialog />
      <ToastContainer />
    </div>
  );
}
