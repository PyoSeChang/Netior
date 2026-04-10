import React, { useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { X, Terminal, Shapes, Link, Layout, Sparkles, Box, FileText } from 'lucide-react';
import type { EditorTab } from '@netior/shared/types';
import { setTabDragData, isTabDrag, getTabDragDataAsync, clearTabDragData } from '../../hooks/useTabDrag';
import { getFileOpenDragData, isFileOpenDrag } from '../../hooks/useFileOpenDrag';
import { ContextMenu } from '../ui/ContextMenu';
import type { ContextMenuEntry } from '../ui/ContextMenu';
import { ClaudeIcon, CodexIcon, getAgentProviderAccentColor } from '../ui/AgentProviderIcons';
import { buildTabContextMenu, buildStripContextMenu } from './tab-context-menu';
import { useEditorStore } from '../../stores/editor-store';
import { FileIcon } from '../sidebar/FileIcon';
import {
  getAgentSessionStateByTerminal,
  getAgentSessionStoreVersion,
  subscribeAgentSessionStore,
  type AgentSessionState,
} from '../../lib/agent-session-store';

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
  onFileDrop?: (filePaths: string[]) => void;
  rightSlot?: React.ReactNode;
}

const ICON_SIZE = 15;

function useAgentState(targetId: string) {
  useSyncExternalStore(subscribeAgentSessionStore, getAgentSessionStoreVersion);
  return getAgentSessionStateByTerminal(targetId);
}

function TabIcon({ tab }: { tab: EditorTab }): JSX.Element {
  const agentState = useAgentState(tab.targetId);

  switch (tab.type) {
    case 'file': {
      const filename = tab.title || tab.targetId.split('/').pop() || 'file';
      return <FileIcon name={filename} size={ICON_SIZE} />;
    }
    case 'terminal':
      if (agentState?.provider === 'claude') {
        return <ClaudeIcon size={ICON_SIZE} />;
      }
      if (agentState?.provider === 'codex') {
        return <CodexIcon size={ICON_SIZE} />;
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

function TabStatus({ tab, agentState }: { tab: EditorTab; agentState: AgentSessionState | null }): JSX.Element | null {
  if (tab.type === 'terminal' && agentState) {
    const dotColor = agentState.uxState === 'error'
      ? 'var(--status-error)'
      : agentState.uxState === 'needs_attention'
        ? 'var(--status-warning)'
        : agentState.uxState === 'offline'
          ? 'var(--text-muted)'
          : getAgentProviderAccentColor(agentState.provider);
    const shouldAnimate = agentState.uxState === 'working' || agentState.uxState === 'needs_attention';
    const dotStyle = {
      backgroundColor: dotColor,
      '--agent-breathe-color': dotColor,
    } as React.CSSProperties;
    return (
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${shouldAnimate ? 'animate-agent-breathe' : ''}`}
        style={dotStyle}
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
  const agentState = useAgentState(tab.targetId);
  const label = (tab.type === 'terminal' && agentState?.name) ? agentState.name : tab.title;

  return (
    <div
      ref={isActive ? (activeRef as React.LegacyRef<HTMLDivElement>) : undefined}
      draggable={!isRenaming}
      onDragStart={(e) => setTabDragData(e, tab.id)}
      onDragEnd={() => clearTabDragData()}
      className={`group flex shrink-0 cursor-pointer items-center gap-1.5 px-3 text-xs transition-colors ${
        isActive
          ? `tab-active bg-[var(--surface-editor)] text-default border-l border-r border-default ${
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
      <TabStatus tab={tab} agentState={agentState} />
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

export function EditorTabStrip({ tabs, activeTabId, isFocusedPane = true, hostId, onActivate, onClose, onTabDrop, onFileDrop, rightSlot }: EditorTabStripProps): JSX.Element {
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
    if (!isTabDrag(e) && !isFileOpenDrag(e)) return;
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
    if (isFileOpenDrag(e)) {
      const filePaths = getFileOpenDragData(e);
      console.log(`[EditorTabStrip] file drop host=${hostId ?? 'main'}, count=${filePaths.length}`);
      if (filePaths.length > 0) onFileDrop?.(filePaths);
      return;
    }
    if (!onTabDrop) return;
    const tabId = await getTabDragDataAsync(e);
    console.log(`[EditorTabStrip] drop host=${hostId ?? 'main'}, tabId=${tabId}`);
    if (tabId) {
      onTabDrop(tabId);
    }
  }, [hostId, onTabDrop, onFileDrop]);

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
