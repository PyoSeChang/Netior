import React from 'react';
import { X } from 'lucide-react';
import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import { Tooltip } from '../ui/Tooltip';

export function MinimizedEditorTabs(): JSX.Element | null {
  const { t } = useI18n();
  const { tabs, activeTabId, toggleMinimize, requestCloseTab } = useEditorStore();

  const minimizedTabs = tabs.filter((tab) => tab.isMinimized && tab.hostId === MAIN_HOST_ID);

  if (minimizedTabs.length === 0) return null;

  return (
    <div
      className="flex min-w-0 max-w-[min(34vw,520px)] items-center gap-1 overflow-x-auto px-1"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      aria-label="Minimized editor tabs"
    >
      {minimizedTabs.map((tab) => (
        <Tooltip key={tab.id} content={t('common.restore', { title: tab.title })} position="bottom">
          <div
            className={`flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded border px-2 text-[11px] transition-colors ${
              tab.id === activeTabId
                ? 'border-accent bg-interactive-selected text-accent'
                : 'border-subtle bg-surface-card text-secondary hover:bg-surface-hover hover:text-default'
            }`}
            role="button"
            tabIndex={0}
            onClick={() => toggleMinimize(tab.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleMinimize(tab.id);
              }
            }}
          >
            <span className="max-w-[110px] truncate text-left">{tab.title}</span>
            {tab.isDirty && <span className="text-accent">&bull;</span>}
            <button
              className="ml-0.5 rounded p-0.5 text-muted hover:bg-border-subtle hover:text-default"
              onClick={(event) => {
                event.stopPropagation();
                requestCloseTab(tab.id);
              }}
              aria-label={t('editor.closeWithoutSaving')}
            >
              <X size={10} />
            </button>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
