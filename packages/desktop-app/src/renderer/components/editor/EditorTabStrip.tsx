import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { EditorTab } from '@moc/shared/types';
import { setTabDragData, isTabDrag, getTabDragData } from '../../hooks/useTabDrag';

interface EditorTabStripProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onTabDrop?: (tabId: string) => void;
  rightSlot?: React.ReactNode;
}

export function EditorTabStrip({ tabs, activeTabId, onActivate, onClose, onTabDrop, rightSlot }: EditorTabStripProps): JSX.Element {
  const [dragOver, setDragOver] = useState(false);

  if (tabs.length === 0 && !rightSlot) return <></>;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isTabDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const tabId = getTabDragData(e);
    if (tabId && onTabDrop) {
      onTabDrop(tabId);
    }
  }, [onTabDrop]);

  return (
    <div
      className={`flex h-8 shrink-0 items-center border-b border-subtle bg-surface-panel transition-colors ${
        dragOver ? 'bg-accent/10' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-1 items-center overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => setTabDragData(e, tab.id)}
              className={`group flex shrink-0 cursor-pointer items-center gap-1 border-r border-subtle px-3 py-1 text-xs transition-colors ${
                isActive
                  ? 'bg-surface-base text-default'
                  : 'text-muted hover:bg-surface-hover hover:text-default'
              }`}
              onClick={() => onActivate(tab.id)}
            >
              {tab.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              <span className="max-w-[120px] truncate">{tab.title}</span>
              <button
                className="ml-1 rounded p-0.5 text-muted opacity-0 hover:text-default group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>
      {rightSlot && <div className="shrink-0 px-2">{rightSlot}</div>}
    </div>
  );
}
