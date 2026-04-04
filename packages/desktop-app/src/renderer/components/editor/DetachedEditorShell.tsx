import React, { useEffect, useState } from 'react';
import { EditorContent } from './EditorContent';
import { EditorTabStrip } from './EditorTabStrip';
import { CloseConfirmDialog } from './CloseConfirmDialog';
import { WindowControls } from '../ui/WindowControls';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useDetachedShortcuts } from '../../shortcuts/useDetachedShortcuts';
import { initDetachedBridge } from '../../lib/editor-state-bridge';
import { useNetiorSync } from '../../hooks/useNetiorSync';
import { getTabDragDataAsync, isTabDrag } from '../../hooks/useTabDrag';

interface DetachedEditorShellProps {
  hostId: string;
}

export function DetachedEditorShell({ hostId }: DetachedEditorShellProps): JSX.Element {
  const [ready, setReady] = useState(false);

  // Bootstrap: fetch state from main window via IPC before rendering
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    console.log(`[DetachedShell] init hostId=${hostId}`);
    initDetachedBridge(hostId).then((c) => {
      cleanup = c;
      const s = useEditorStore.getState();
      console.log(`[DetachedShell] bridge ready — hosts=${JSON.stringify(Object.keys(s.hosts))}, tabs=${s.tabs.map(t => `${t.id}@${t.hostId}`).join(', ')}`);
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
    console.log(`[DetachedShell] host dragOver hostId=${hostId}, types=${JSON.stringify(Array.from(e.dataTransfer.types))}`);
  };

  const handleHostDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const tabId = await getTabDragDataAsync(e);
    console.log(`[DetachedShell] host drop hostId=${hostId}, tabId=${tabId}`);
    if (tabId) {
      moveTabToHost(tabId, hostId);
    }
  };

  // Set up detached-window shortcuts
  useDetachedShortcuts(hostId);

  // Notify main that focus is on this host when window receives focus
  useEffect(() => {
    const onFocus = () => useEditorStore.getState().setFocusedHost(hostId);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [hostId]);

  // If host is removed (all tabs closed via sync), close the window.
  // Delay briefly to let state sync settle — avoids premature close during hydration.
  useEffect(() => {
    console.log(`[DetachedShell] auto-close check: ready=${ready}, host=${!!host}, tabs=${tabs.length}`);
    if (!ready || host || tabs.length > 0) return;
    console.log(`[DetachedShell] auto-close TRIGGERED — scheduling 200ms recheck`);
    const timer = setTimeout(() => {
      const s = useEditorStore.getState();
      const hostKeys = Object.keys(s.hosts);
      const myTabs = s.tabs.filter((t) => t.hostId === hostId);
      console.log(`[DetachedShell] auto-close recheck: hosts=${JSON.stringify(hostKeys)}, myTabs=${myTabs.length}, allTabs=${s.tabs.map(t => `${t.id}@${t.hostId}`).join(', ')}`);
      const stillEmpty = !s.hosts[hostId] && myTabs.length === 0;
      if (stillEmpty) {
        console.log(`[DetachedShell] CLOSING — host not found and no tabs`);
        window.close();
      } else {
        console.log(`[DetachedShell] auto-close CANCELLED — state recovered`);
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
    <div className="flex h-screen w-screen flex-col bg-surface-panel">
      {/* Title bar */}
      <div
        className="flex h-8 shrink-0 items-center border-b border-subtle bg-surface-base px-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          className="min-w-0 flex-1 truncate text-xs text-secondary"
        >
          {hostLabel}
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <WindowControls />
        </div>
      </div>

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
    </div>
  );
}
