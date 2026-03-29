import React from 'react';
import { Layout, FolderTree, Shapes, Settings, Terminal } from 'lucide-react';
import { useUIStore } from '../../stores/ui-store';
import { useEditorStore } from '../../stores/editor-store';
import { Tooltip } from '../ui/Tooltip';


const ITEMS = [
  { key: 'canvases' as const, icon: Layout, label: 'Canvases' },
  { key: 'files' as const, icon: FolderTree, label: 'Files' },
  { key: 'archetypes' as const, icon: Shapes, label: 'Archetypes' },
] as const;

export function ActivityBar(): JSX.Element {
  const { sidebarView, setSidebarView, sidebarOpen, toggleSidebar } = useUIStore();

  const handleClick = (key: 'canvases' | 'files' | 'archetypes') => {
    if (sidebarOpen && sidebarView === key) {
      // Same tab clicked → close sidebar
      toggleSidebar();
    } else if (sidebarOpen) {
      // Different tab → switch
      setSidebarView(key);
    } else {
      // Sidebar closed → open with this tab
      setSidebarView(key);
      toggleSidebar();
    }
  };

  return (
    <nav className="flex h-full w-10 shrink-0 flex-col items-center border-r border-subtle bg-surface-panel py-2">
      <div className="flex flex-1 flex-col items-center gap-1">
        {ITEMS.map(({ key, icon: Icon, label }) => {
          const isActive = sidebarOpen && sidebarView === key;
          return (
            <Tooltip key={key} content={label} position="right">
              <button
                className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:bg-surface-hover hover:text-default'
                }`}
                onClick={() => handleClick(key)}
              >
                <Icon size={18} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Bottom: terminal + settings */}
      <Tooltip content="Terminal" position="right">
        <button
          className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:bg-surface-hover hover:text-default"
          onClick={() => {
            const sessionId = `term-${Date.now()}`;
            useEditorStore.getState().openTab({
              type: 'terminal',
              targetId: sessionId,
              title: 'Terminal',
            });
          }}
        >
          <Terminal size={18} />
        </button>
      </Tooltip>
      <Tooltip content="Settings" position="right">
        <button
          className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:bg-surface-hover hover:text-default"
          onClick={() => useUIStore.getState().setShowSettings(true)}
        >
          <Settings size={18} />
        </button>
      </Tooltip>
    </nav>
  );
}
