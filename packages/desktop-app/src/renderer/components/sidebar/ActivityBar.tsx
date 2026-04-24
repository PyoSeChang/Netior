import React, { useEffect, useMemo } from 'react';
import { Boxes, Waypoints } from 'lucide-react';
import { useUIStore, type SidebarView } from '../../stores/ui-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useNetworkStore } from '../../stores/network-store';
import { useActivityBarStore } from '../../stores/activity-bar-store';
import { useI18n } from '../../hooks/useI18n';
import { openTerminalTab } from '../../lib/terminal/open-terminal-tab';
import {
  ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS,
  ACTIVITY_BAR_TOP_ITEM_DEFINITIONS,
} from '../../lib/activity-bar-items';
import {
  getProjectNetworkBookmarkIds,
  getVisibleOrderedItems,
  type ActivityBarBottomItemKey,
  type ActivityBarTopItemKey,
} from '../../lib/activity-bar-layout';
import { Tooltip } from '../ui/Tooltip';

export function ActivityBar(): JSX.Element {
  const { t } = useI18n();
  const { sidebarView, setSidebarView, sidebarOpen, toggleSidebar } = useUIStore();
  const currentProject = useProjectStore((state) => state.currentProject);
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const networks = useNetworkStore((state) => state.networks);
  const openNetwork = useNetworkStore((state) => state.openNetwork);
  const config = useActivityBarStore((state) => state.config);
  const ensureLoaded = useActivityBarStore((state) => state.ensureLoaded);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const handleSidebarViewClick = (key: SidebarView) => {
    if (sidebarOpen && sidebarView === key) {
      toggleSidebar();
    } else if (sidebarOpen) {
      setSidebarView(key);
    } else {
      setSidebarView(key);
      toggleSidebar();
    }
  };

  const topItemKeys = useMemo(() => {
    const available = currentProject
      ? (['networks', 'objects', 'files', 'sessions'] as const satisfies readonly ActivityBarTopItemKey[])
      : (['networks'] as const satisfies readonly ActivityBarTopItemKey[]);
    return getVisibleOrderedItems(config.topItemOrder, available);
  }, [config.topItemOrder, currentProject]);

  const bottomItemKeys = useMemo(() => {
    const available = currentProject
      ? (['narre', 'terminal', 'agents', 'settings'] as const satisfies readonly ActivityBarBottomItemKey[])
      : (['agents', 'settings'] as const satisfies readonly ActivityBarBottomItemKey[]);
    return getVisibleOrderedItems(config.bottomItemOrder, available);
  }, [config.bottomItemOrder, currentProject]);

  const bookmarkNetworks = useMemo(() => {
    if (!currentProject) {
      return [];
    }

    const bookmarkIds = getProjectNetworkBookmarkIds(config, currentProject.id);
    return bookmarkIds
      .map((bookmarkId) => networks.find((network) => network.id === bookmarkId))
      .filter((network): network is NonNullable<typeof network> => Boolean(network));
  }, [config, currentProject, networks]);

  const handleBottomAction = (key: ActivityBarBottomItemKey) => {
    switch (key) {
      case 'narre':
        if (!currentProject) return;
        useEditorStore.getState().openTab({
          type: 'narre',
          targetId: currentProject.id,
          title: t('narre.title'),
        });
        return;
      case 'terminal':
        openTerminalTab();
        return;
      case 'agents':
        useEditorStore.getState().openTab({
          type: 'agent',
          targetId: currentProject?.id ?? 'global',
          title: t('agentEditor.title' as never),
        });
        return;
      case 'settings':
        useUIStore.getState().setShowSettings(true);
        return;
      default:
        return;
    }
  };

  return (
    <nav className="flex h-full w-10 shrink-0 flex-col items-center border-r border-subtle bg-[var(--surface-sidebar)] py-2">
      <div className="flex flex-col items-center gap-1">
        {topItemKeys.map((key) => {
          const { icon: Icon, labelKey } = ACTIVITY_BAR_TOP_ITEM_DEFINITIONS[key];
          const isActive = sidebarOpen && sidebarView === key;

          return (
            <Tooltip key={key} content={t(labelKey)} position="right">
              <button
                className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                  isActive
                    ? 'bg-interactive-selected text-accent'
                    : 'text-secondary hover:bg-surface-hover hover:text-default'
                }`}
                onClick={() => handleSidebarViewClick(key)}
              >
                <Icon size={18} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      {bookmarkNetworks.length > 0 && (
        <>
          <div className="my-2 h-px w-5 bg-border-subtle" />
          <div className="flex flex-col items-center gap-1">
            {bookmarkNetworks.map((network) => {
              const Icon = network.kind === 'ontology' ? Boxes : Waypoints;
              const isActive = currentNetwork?.id === network.id;

              return (
                <Tooltip key={network.id} content={network.name} position="right">
                  <button
                    className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                      isActive
                        ? 'bg-interactive-selected text-accent'
                        : 'text-secondary hover:bg-surface-hover hover:text-default'
                    }`}
                    onClick={() => {
                      setSidebarView('networks');
                      void openNetwork(network.id);
                    }}
                  >
                    <Icon size={18} />
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </>
      )}

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-1">
        {bottomItemKeys.map((key) => {
          const { icon: Icon, labelKey } = ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS[key];

          return (
            <Tooltip key={key} content={t(labelKey)} position="right">
              <button
                className="flex h-8 w-8 items-center justify-center rounded text-secondary transition-colors hover:bg-surface-hover hover:text-default"
                onClick={() => handleBottomAction(key)}
              >
                <Icon size={18} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
}
