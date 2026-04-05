import React from 'react';
import { X } from 'lucide-react';
import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import { Tooltip } from '../ui/Tooltip';

export function EditorDockBar(): JSX.Element | null {
  const { t } = useI18n();
  const { tabs, activeTabId, toggleMinimize, requestCloseTab } = useEditorStore();

  const minimizedTabs = tabs.filter((t) => t.isMinimized && t.hostId === MAIN_HOST_ID);

  if (minimizedTabs.length === 0) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-1 bg-surface-card/90 backdrop-blur border-t border-subtle px-2 py-1.5"
    >
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {minimizedTabs.map((tab, idx) => (
          <React.Fragment key={tab.id}>
          {idx > 0 && <div className="h-3 w-px shrink-0" style={{ background: 'var(--border-subtle)' }} />}
          <Tooltip content={t('common.restore', { title: tab.title })} position="top">
          <button
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs whitespace-nowrap transition-colors ${
              tab.id === activeTabId
                ? 'bg-interactive-selected text-accent'
                : 'text-secondary hover:text-default hover:bg-surface-base'
            }`}
            onClick={() => toggleMinimize(tab.id)}
          >
            <span className="max-w-[80px] truncate">{tab.title}</span>
            {tab.isDirty && <span className="text-accent">&bull;</span>}
            <span
              className="ml-0.5 rounded p-0.5 hover:bg-border-subtle"
              onClick={(e) => {
                e.stopPropagation();
                requestCloseTab(tab.id);
              }}
            >
              <X size={10} />
            </span>
          </button>
          </Tooltip>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
