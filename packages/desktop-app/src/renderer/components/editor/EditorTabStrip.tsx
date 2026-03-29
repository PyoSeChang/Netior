import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { EditorTab } from '@moc/shared/types';
import { setTabDragData, isTabDrag, getTabDragData } from '../../hooks/useTabDrag';
import { ContextMenu } from '../ui/ContextMenu';
import type { ContextMenuEntry } from '../ui/ContextMenu';
import { buildTabContextMenu, buildStripContextMenu } from './tab-context-menu';
import { useEditorStore } from '../../stores/editor-store';

interface EditorTabStripProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onTabDrop?: (tabId: string) => void;
  rightSlot?: React.ReactNode;
}

function InlineRenameInput({ value, onSubmit, onCancel }: { value: string; onSubmit: (v: string) => void; onCancel: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const v = inputRef.current?.value.trim();
      if (v && v !== value) onSubmit(v);
      else onCancel();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      className="max-w-[120px] rounded border border-accent bg-surface-base px-1 text-xs text-default outline-none"
      defaultValue={value}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        const v = inputRef.current?.value.trim();
        if (v && v !== value) onSubmit(v);
        else onCancel();
      }}
    />
  );
}

export function EditorTabStrip({ tabs, activeTabId, onActivate, onClose, onTabDrop, rightSlot }: EditorTabStripProps): JSX.Element {
  const [dragOver, setDragOver] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuEntry[] } | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  if (tabs.length === 0 && !rightSlot) return <></>;

  const menuCallbacks = {
    onRequestRename: (tabId: string) => setRenamingTabId(tabId),
  };

  const handleTabContextMenu = useCallback((e: React.MouseEvent, tab: EditorTab) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, items: buildTabContextMenu(tab, tabs, menuCallbacks) });
  }, [tabs]);

  const handleStripContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, items: buildStripContextMenu(tabs) });
  }, [tabs]);

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

  const handleRenameSubmit = useCallback((tabId: string, newTitle: string) => {
    useEditorStore.getState().updateTitle(tabId, newTitle);
    setRenamingTabId(null);
  }, []);

  return (
    <div
      className={`flex shrink-0 items-end bg-surface-base transition-colors ${
        dragOver ? 'bg-accent/10' : ''
      }`}
      style={{ height: 35 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleStripContextMenu}
    >
      <div ref={scrollRef} className="tab-scroll flex flex-1 items-end pl-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isRenaming = renamingTabId === tab.id;
          return (
            <div
              key={tab.id}
              ref={isActive ? activeRef : undefined}
              draggable={!isRenaming}
              onDragStart={(e) => setTabDragData(e, tab.id)}
              className={`group flex shrink-0 cursor-pointer items-center gap-1.5 px-3 text-xs transition-colors ${
                isActive
                  ? 'tab-active rounded-t-lg bg-surface-panel text-default -mb-px'
                  : 'text-muted hover:text-secondary rounded-t-lg hover:bg-surface-hover/40'
              }`}
              style={{
                height: isActive ? 30 : 28,
                ...(isActive ? { '--tab-bg': 'var(--surface-panel)' } as React.CSSProperties : {}),
              }}
              onClick={() => !isRenaming && onActivate(tab.id)}
              onContextMenu={(e) => handleTabContextMenu(e, tab)}
            >
              {tab.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              {isRenaming ? (
                <InlineRenameInput
                  value={tab.title}
                  onSubmit={(v) => handleRenameSubmit(tab.id, v)}
                  onCancel={() => setRenamingTabId(null)}
                />
              ) : (
                <span className="max-w-[120px] truncate">{tab.title}</span>
              )}
              <button
                className="ml-0.5 rounded p-0.5 text-muted opacity-0 hover:text-default group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>
      {rightSlot && <div className="flex h-full shrink-0 items-center px-2">{rightSlot}</div>}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
}
