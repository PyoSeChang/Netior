import React, { useEffect, useMemo } from 'react';
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { Network } from '@netior/shared/types';
import { useI18n } from '../../hooks/useI18n';
import {
  ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS,
  ACTIVITY_BAR_TOP_ITEM_DEFINITIONS,
} from '../../lib/activity-bar-items';
import { getProjectNetworkBookmarkIds } from '../../lib/activity-bar-layout';
import { useNetworkStore } from '../../stores/network-store';
import { useProjectStore } from '../../stores/project-store';
import { useActivityBarStore } from '../../stores/activity-bar-store';
import { Button } from '../ui/Button';

function getSectionId(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-');
}

function getNetworkIcon(network: Network): LucideIcon {
  return network.kind === 'ontology' ? Boxes : Waypoints;
}

function MoveButtons({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveUpLabel,
  moveDownLabel,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpLabel: string;
  moveDownLabel: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-state-hover hover:text-default disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        title={moveUpLabel}
        aria-label={moveUpLabel}
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-state-hover hover:text-default disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        title={moveDownLabel}
        aria-label={moveDownLabel}
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}

function ReorderableRow({
  icon: Icon,
  label,
  subtitle,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveUpLabel,
  moveDownLabel,
  action,
}: {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpLabel: string;
  moveDownLabel: string;
  action?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-editor text-secondary">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-default">{label}</div>
        {subtitle ? <div className="truncate text-xs text-muted">{subtitle}</div> : null}
      </div>
      {action}
      <MoveButtons
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        moveUpLabel={moveUpLabel}
        moveDownLabel={moveDownLabel}
      />
    </div>
  );
}

export function SidebarSettingsPanel(): JSX.Element {
  const { t } = useI18n();
  const currentProject = useProjectStore((state) => state.currentProject);
  const networks = useNetworkStore((state) => state.networks);
  const loadNetworks = useNetworkStore((state) => state.loadNetworks);
  const config = useActivityBarStore((state) => state.config);
  const ensureLoaded = useActivityBarStore((state) => state.ensureLoaded);
  const moveTopItem = useActivityBarStore((state) => state.moveTopItem);
  const moveBottomItem = useActivityBarStore((state) => state.moveBottomItem);
  const addBookmark = useActivityBarStore((state) => state.addBookmark);
  const removeBookmark = useActivityBarStore((state) => state.removeBookmark);
  const moveBookmark = useActivityBarStore((state) => state.moveBookmark);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    if (!currentProject) {
      return;
    }

    void loadNetworks(currentProject.id);
  }, [currentProject?.id, currentProject, loadNetworks]);

  const moveUpLabel = t('settings.sidebarMoveUp' as never);
  const moveDownLabel = t('settings.sidebarMoveDown' as never);
  const topItemsTitle = t('settings.sidebarTopItems' as never);
  const bookmarkedNetworksTitle = t('settings.sidebarBookmarkedNetworks' as never);
  const bottomItemsTitle = t('settings.sidebarBottomItems' as never);

  const projectNetworks = useMemo(
    () => currentProject
      ? networks.filter((network) => network.project_id === currentProject.id)
        .filter((network) => network.kind === 'network')
      : [],
    [currentProject, networks],
  );

  const bookmarkIds = currentProject
    ? getProjectNetworkBookmarkIds(config, currentProject.id)
    : [];

  const bookmarkNetworks = useMemo(
    () => bookmarkIds
      .map((bookmarkId) => projectNetworks.find((network) => network.id === bookmarkId))
      .filter((network): network is Network => Boolean(network)),
    [bookmarkIds, projectNetworks],
  );

  const availableNetworks = useMemo(() => {
    const bookmarkIdSet = new Set(bookmarkIds);
    return projectNetworks.filter((network) => !bookmarkIdSet.has(network.id));
  }, [bookmarkIds, projectNetworks]);

  return (
    <div data-section="sidebar">
      <section data-section={getSectionId(topItemsTitle)} className="mb-8">
        <h3 className="text-base font-semibold text-default">{topItemsTitle}</h3>
        <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.sidebarTopItemsDesc' as never)}</p>
        <div className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
          {config.topItemOrder.map((itemKey, index) => {
            const definition = ACTIVITY_BAR_TOP_ITEM_DEFINITIONS[itemKey];
            return (
              <ReorderableRow
                key={itemKey}
                icon={definition.icon}
                label={t(definition.labelKey)}
                canMoveUp={index > 0}
                canMoveDown={index < config.topItemOrder.length - 1}
                onMoveUp={() => { void moveTopItem(index, -1); }}
                onMoveDown={() => { void moveTopItem(index, 1); }}
                moveUpLabel={moveUpLabel}
                moveDownLabel={moveDownLabel}
              />
            );
          })}
        </div>
      </section>

      <section data-section={getSectionId(bookmarkedNetworksTitle)} className="mb-8">
        <h3 className="text-base font-semibold text-default">{bookmarkedNetworksTitle}</h3>
        <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.sidebarBookmarkedNetworksDesc' as never)}</p>

        {!currentProject ? (
          <div className="rounded-lg border border-subtle bg-surface-card px-3 py-3 text-sm text-muted">
            {t('settings.sidebarNoProject' as never)}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                {t('settings.sidebarBookmarkedNetworks' as never)}
              </div>
              {bookmarkNetworks.length > 0 ? (
                <div className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
                  {bookmarkNetworks.map((network, index) => {
                    const NetworkIcon = getNetworkIcon(network);
                    return (
                      <ReorderableRow
                        key={network.id}
                        icon={NetworkIcon}
                        label={network.name}
                        canMoveUp={index > 0}
                        canMoveDown={index < bookmarkNetworks.length - 1}
                        onMoveUp={() => { void moveBookmark(currentProject.id, index, -1); }}
                        onMoveDown={() => { void moveBookmark(currentProject.id, index, 1); }}
                        moveUpLabel={moveUpLabel}
                        moveDownLabel={moveDownLabel}
                        action={(
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => { void removeBookmark(currentProject.id, network.id); }}
                          >
                            <PinOff size={14} />
                            {t('common.remove')}
                          </Button>
                        )}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-subtle px-3 py-3 text-sm text-muted">
                  {t('settings.sidebarNoBookmarks' as never)}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {t('settings.sidebarAvailableNetworks' as never)}
              </div>
              <p className="mb-2 text-xs text-muted">{t('settings.sidebarAvailableNetworksDesc' as never)}</p>
              {availableNetworks.length > 0 ? (
                <div className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
                  {availableNetworks.map((network) => {
                    const NetworkIcon = getNetworkIcon(network);
                    return (
                      <div key={network.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-editor text-secondary">
                          <NetworkIcon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-default">{network.name}</div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => { void addBookmark(currentProject.id, network.id); }}
                        >
                          <Pin size={14} />
                          {t('common.add')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-subtle px-3 py-3 text-sm text-muted">
                  {t('settings.sidebarNoAvailableNetworks' as never)}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section data-section={getSectionId(bottomItemsTitle)} className="mb-8">
        <h3 className="text-base font-semibold text-default">{bottomItemsTitle}</h3>
        <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.sidebarBottomItemsDesc' as never)}</p>
        <div className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
          {config.bottomItemOrder.map((itemKey, index) => {
            const definition = ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS[itemKey];
            return (
              <ReorderableRow
                key={itemKey}
                icon={definition.icon}
                label={t(definition.labelKey)}
                canMoveUp={index > 0}
                canMoveDown={index < config.bottomItemOrder.length - 1}
                onMoveUp={() => { void moveBottomItem(index, -1); }}
                onMoveDown={() => { void moveBottomItem(index, 1); }}
                moveUpLabel={moveUpLabel}
                moveDownLabel={moveDownLabel}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
