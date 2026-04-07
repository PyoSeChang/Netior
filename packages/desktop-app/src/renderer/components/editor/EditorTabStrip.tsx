import React, { useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { X, Terminal, Shapes, Link, Layout, Sparkles, Box, FileText } from 'lucide-react';
import type { EditorTab } from '@netior/shared/types';
import { setTabDragData, isTabDrag, getTabDragDataAsync, clearTabDragData } from '../../hooks/useTabDrag';
import { ContextMenu } from '../ui/ContextMenu';
import type { ContextMenuEntry } from '../ui/ContextMenu';
import { buildTabContextMenu, buildStripContextMenu } from './tab-context-menu';
import { useEditorStore } from '../../stores/editor-store';
import { FileIcon } from '../sidebar/FileIcon';
import { getClaudeTerminalState, getClaudeTrackerVersion, subscribeClaudeTracker, type ClaudeTerminalState } from '../../lib/claude-terminal-tracker';

interface EditorTabStripProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  /** Whether this pane is the globally focused pane */
  isFocusedPane?: boolean;
  /** Host id for context menu actions (defaults to main) */
  hostId?: string;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onTabDrop?: (tabId: string) => void;
  rightSlot?: React.ReactNode;
}

const ICON_SIZE = 14;

function ClaudeIcon({ size = 14, className }: { size?: number; className?: string }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={{ flexShrink: 0 }}>
      <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z" />
    </svg>
  );
}

function useClaudeState(targetId: string) {
  // version changes on every tracker update, forcing useSyncExternalStore to re-read
  useSyncExternalStore(subscribeClaudeTracker, getClaudeTrackerVersion);
  return getClaudeTerminalState(targetId);
}

function TabIcon({ tab }: { tab: EditorTab }): JSX.Element {
  const claudeState = useClaudeState(tab.targetId);

  switch (tab.type) {
    case 'file': {
      const filename = tab.title || tab.targetId.split('/').pop() || 'file';
      return <FileIcon name={filename} size={ICON_SIZE} />;
    }
    case 'terminal':
      if (claudeState) {
        return <ClaudeIcon size={ICON_SIZE} className="text-[#E27B35]" />;
      }
      return <Terminal size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'concept':
      return <Box size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'archetype':
      return <Shapes size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'relationType':
    case 'edge':
      return <Link size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'network':
      return <Layout size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'narre':
      return <Sparkles size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'fileMetadata':
      return <FileText size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    default:
      return <span style={{ width: ICON_SIZE, height: ICON_SIZE, flexShrink: 0 }} />;
  }
}

function TabStatus({ tab, claudeState }: { tab: EditorTab; claudeState: ClaudeTerminalState | null }): JSX.Element | null {
  if (tab.type === 'terminal' && claudeState) {
    return (
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#E27B35] ${claudeState.status === 'working' ? 'animate-claude-pulse' : ''}`}
      />
    );
  }
  if (tab.type !== 'terminal') {
    return tab.isDirty ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null;
  }
  return null;
}

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  isFocusedPane: boolean;
  isRenaming: boolean;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onContextMenu: (e: React.MouseEvent, tab: EditorTab) => void;
  onRenameSubmit: (tabId: string, newTitle: string) => void;
  onRenameCancel: () => void;
  activeRef: React.RefObject<HTMLDivElement>;
}

function TabItem({ tab, isActive, isFocusedPane, isRenaming, onActivate, onClose, onContextMenu, onRenameSubmit, onRenameCancel, activeRef }: TabItemProps): JSX.Element {
  const claudeState = useClaudeState(tab.targetId);
  const label = (tab.type === 'terminal' && claudeState?.sessionName) ? claudeState.sessionName : tab.title;

  return (
    <div
      ref={isActive ? (activeRef as React.LegacyRef<HTMLDivElement>) : undefined}
      draggable={!isRenaming}
      onDragStart={(e) => setTabDragData(e, tab.id)}
      onDragEnd={() => clearTabDragData()}
      className={`group flex shrink-0 cursor-pointer items-center gap-1.5 px-3 text-xs transition-colors ${
        isActive
          ? `tab-active bg-surface-panel text-default border-l border-r border-default ${
              isFocusedPane ? 'border-t-2 border-t-accent' : 'border-t border-t-default'
            }`
          : 'relative text-secondary hover:text-default hover:bg-surface-hover/40 tab-inactive'
      }`}
      style={{ height: 30, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onClick={() => !isRenaming && onActivate(tab.id)}
      onContextMenu={(e) => onContextMenu(e, tab)}
    >
      <TabIcon tab={tab} />
      {isRenaming ? (
        <InlineRenameInput
          value={tab.title}
          onSubmit={(v) => onRenameSubmit(tab.id, v)}
          onCancel={onRenameCancel}
        />
      ) : (
        <span className={isActive ? 'whitespace-nowrap' : 'max-w-[120px] truncate'}>{label}</span>
      )}
      <button
        className="ml-0.5 rounded p-0.5 text-muted opacity-0 hover:text-default group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
      >
        <X size={10} />
      </button>
      <TabStatus tab={tab} claudeState={claudeState} />
    </div>
  );
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

export function EditorTabStrip({ tabs, activeTabId, isFocusedPane = true, hostId, onActivate, onClose, onTabDrop, rightSlot }: EditorTabStripProps): JSX.Element {
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

  // Wheel → horizontal scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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
    setCtxMenu({ x: e.clientX, y: e.clientY, items: buildStripContextMenu(tabs, hostId) });
  }, [tabs, hostId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isTabDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    console.log(`[EditorTabStrip] dragOver host=${hostId ?? 'main'}, types=${JSON.stringify(Array.from(e.dataTransfer.types))}`);
    setDragOver(true);
  }, [hostId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!onTabDrop) return;
    const tabId = await getTabDragDataAsync(e);
    console.log(`[EditorTabStrip] drop host=${hostId ?? 'main'}, tabId=${tabId}`);
    if (tabId) {
      onTabDrop(tabId);
    }
  }, [hostId, onTabDrop]);

  const handleRenameSubmit = useCallback((tabId: string, newTitle: string) => {
    useEditorStore.getState().updateTitle(tabId, newTitle, true);
    setRenamingTabId(null);
  }, []);

  return (
    <div
      className={`tab-strip flex shrink-0 items-end bg-surface-base transition-colors ${
        dragOver ? 'bg-interactive-muted' : ''
      }`}
      style={{ height: 35, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleStripContextMenu}
    >
      <div ref={scrollRef} className="tab-scroll flex min-w-0 flex-1 items-end pl-2">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            isFocusedPane={isFocusedPane}
            isRenaming={renamingTabId === tab.id}
            onActivate={onActivate}
            onClose={onClose}
            onContextMenu={handleTabContextMenu}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenamingTabId(null)}
            activeRef={activeRef}
          />
        ))}
      </div>
      {rightSlot && <div className="flex h-full shrink-0 items-center px-2">{rightSlot}</div>}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
}
