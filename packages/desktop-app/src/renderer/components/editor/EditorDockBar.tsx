import React from 'react';
import { X } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import { Tooltip } from '../ui/Tooltip';

export function EditorDockBar(): JSX.Element | null {
  const { t } = useI18n();
  const { tabs, activeTabId, toggleMinimize, closeTab } = useEditorStore();

  const minimizedTabs = tabs.filter((t) => t.isMinimized);

  if (minimizedTabs.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1 bg-surface-card/90 backdrop-blur border-t border-subtle px-2 py-1.5"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 190,
      }}
    >
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {minimizedTabs.map((tab) => (
          <Tooltip key={tab.id} content={t('common.restore', { title: tab.title })} position="top">
          <button
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs whitespace-nowrap transition-colors ${
              tab.id === activeTabId
                ? 'bg-accent/20 text-accent'
                : 'text-muted hover:text-default hover:bg-surface-base'
            }`}
            onClick={() => toggleMinimize(tab.id)}
          >
            <span className="max-w-[80px] truncate">{tab.title}</span>
            {tab.isDirty && <span className="text-accent">&bull;</span>}
            <span
              className="ml-0.5 rounded p-0.5 hover:bg-border-subtle"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <X size={10} />
            </span>
          </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
