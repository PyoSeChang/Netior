import React from 'react';
import { Waypoints, FolderTree, Boxes, Settings, Terminal, Sparkles, Bot, Activity } from 'lucide-react';
import { useUIStore, type SidebarView } from '../../stores/ui-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useI18n } from '../../hooks/useI18n';
import { openTerminalTab } from '../../lib/terminal/open-terminal-tab';
import { Tooltip } from '../ui/Tooltip';

export function ActivityBar(): JSX.Element {
  const { t } = useI18n();
  const tk = (key: string) => t(key as import('@netior/shared/i18n').TranslationKey);
  const { sidebarView, setSidebarView, sidebarOpen, toggleSidebar } = useUIStore();
  const currentProject = useProjectStore((state) => state.currentProject);
  const items = currentProject ? [
    { key: 'networks' as const, icon: Waypoints, label: tk('sidebar.networks') },
    { key: 'objects' as const, icon: Boxes, label: tk('sidebar.objects') },
    { key: 'files' as const, icon: FolderTree, label: t('sidebar.files') },
    { key: 'sessions' as const, icon: Activity, label: 'Agent Sessions' },
  ] as const : [
    { key: 'networks' as const, icon: Waypoints, label: tk('sidebar.networks') },
  ] as const;

  const handleClick = (key: SidebarView) => {
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
    <nav className="flex h-full w-10 shrink-0 flex-col items-center border-r border-subtle bg-[var(--surface-sidebar)] py-2">
      <div className="flex flex-1 flex-col items-center gap-1">
        {items.map(({ key, icon: Icon, label }) => {
          const isActive = sidebarOpen && sidebarView === key;
          return (
            <Tooltip key={key} content={label} position="right">
              <button
                className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                  isActive
                    ? 'bg-interactive-selected text-accent'
                    : 'text-secondary hover:bg-surface-hover hover:text-default'
                }`}
                onClick={() => handleClick(key)}
              >
                <Icon size={18} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Bottom: narre + agents + terminal + settings */}
      {currentProject && (
        <>
          <Tooltip content={t('narre.title')} position="right">
            <button
              className="flex h-8 w-8 items-center justify-center rounded text-secondary transition-colors hover:bg-surface-hover hover:text-default"
              onClick={() => {
                useEditorStore.getState().openTab({
                  type: 'narre',
                  targetId: currentProject.id,
                  title: 'Narre',
                });
              }}
            >
              <Sparkles size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Terminal" position="right">
            <button
              className="flex h-8 w-8 items-center justify-center rounded text-secondary transition-colors hover:bg-surface-hover hover:text-default"
              onClick={() => {
                openTerminalTab();
              }}
            >
              <Terminal size={18} />
            </button>
          </Tooltip>
        </>
      )}
      <Tooltip content="Agents" position="right">
        <button
          className="flex h-8 w-8 items-center justify-center rounded text-secondary transition-colors hover:bg-surface-hover hover:text-default"
          onClick={() => {
            useEditorStore.getState().openTab({
              type: 'agent',
              targetId: currentProject?.id ?? 'global',
              title: 'Agents',
            });
          }}
        >
          <Bot size={18} />
        </button>
      </Tooltip>
      <Tooltip content="Settings" position="right">
        <button
          className="flex h-8 w-8 items-center justify-center rounded text-secondary transition-colors hover:bg-surface-hover hover:text-default"
          onClick={() => useUIStore.getState().setShowSettings(true)}
        >
          <Settings size={18} />
        </button>
      </Tooltip>
    </nav>
  );
}
