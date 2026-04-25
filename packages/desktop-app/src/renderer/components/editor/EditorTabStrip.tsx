import React, { useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { X, Terminal, Shapes, Link, Layout, Sparkles, FileText, FolderOpen, RefreshCw, Bot, Waypoints } from 'lucide-react';
import type { EditorTab } from '@netior/shared/types';
import { setTabDragData, isTabDrag, getTabDragDataAsync, clearTabDragData, flushTabDragData } from '../../hooks/useTabDrag';
import { getFileOpenDragData, isFileOpenDrag } from '../../hooks/useFileOpenDrag';
import { ContextMenu } from '../ui/ContextMenu';
import type { ContextMenuEntry } from '../ui/ContextMenu';
import { ClaudeIcon, CodexIcon, getAgentProviderAccentColor } from '../ui/AgentProviderIcons';
import { buildTabContextMenu, buildStripContextMenu } from './tab-context-menu';
import { useEditorStore } from '../../stores/editor-store';
import { FileIcon } from '../sidebar/FileIcon';
import { Tooltip } from '../ui/Tooltip';
import {
  getAgentSessionStateByTerminal,
  getAgentSessionStoreVersion,
  subscribeAgentSessionStore,
  type AgentSessionState,
} from '../../lib/agent-session-store';
import { getFileEditorReloadHandler } from '../../lib/file-editor-reload-registry';
import { fsService } from '../../services';
import { replaceDraftCache } from '../../hooks/useEditorSession';
import { setKnownFileTabSignature } from '../../lib/file-tab-stale-registry';
import { useI18n } from '../../hooks/useI18n';
import { useConceptStore } from '../../stores/concept-store';
import { NodeVisual } from '../workspace/node-components/NodeVisual';

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
  onTabReorder?: (tabId: string, targetTabId: string, position: TabDropPosition) => void;
  onFileDrop?: (filePaths: string[]) => void;
  rightSlot?: React.ReactNode;
}

const ICON_SIZE = 15;
type TabDropPosition = 'before' | 'after';

function toFileSignature(fileStat: Awaited<ReturnType<typeof fsService.statItem>>): string {
  return fileStat.exists
    ? `${fileStat.mtimeMs ?? 0}:${fileStat.size ?? 0}`
    : 'missing';
}

function useAgentState(targetId: string) {
  useSyncExternalStore(subscribeAgentSessionStore, getAgentSessionStoreVersion);
  return getAgentSessionStateByTerminal(targetId);
}

function TabIcon({ tab }: { tab: EditorTab }): JSX.Element {
  const agentState = useAgentState(tab.targetId);
  const conceptIcon = useConceptStore((s) => (
    tab.type === 'concept' && !tab.targetId.startsWith('draft-')
      ? s.concepts.find((concept) => concept.id === tab.targetId)?.icon ?? null
      : null
  ));

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
      return <NodeVisual icon={conceptIcon ?? 'box'} size={ICON_SIZE} imageSize={16} className="shrink-0" />;
    case 'archetype':
      return <Shapes size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'relationType':
    case 'edge':
      return <Link size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'network':
      return <Layout size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'networkViewer':
      return <Waypoints size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'project':
      return <FolderOpen size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'narre':
      return <Sparkles size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'agent':
      return <Bot size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    case 'fileMetadata':
      return <FileText size={ICON_SIZE} style={{ flexShrink: 0 }} />;
    default:
      return <span style={{ width: ICON_SIZE, height: ICON_SIZE, flexShrink: 0 }} />;
  }
}

function TabStatusDot({ tab, agentState }: { tab: EditorTab; agentState: AgentSessionState | null }): JSX.Element | null {
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
        className={`h-1.5 w-1.5 shrink-0 rounded-full transition-opacity group-hover:opacity-0 ${shouldAnimate ? 'animate-agent-breathe group-hover:animate-none' : ''}`}
        style={dotStyle}
      />
    );
  }

  if (tab.type !== 'terminal' && tab.isDirty) {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent transition-opacity group-hover:opacity-0" />;
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
  onTabDragOverTarget: (e: React.DragEvent<HTMLDivElement>, targetTabId: string, position: TabDropPosition) => void;
  onTabDragLeaveTarget: (e: React.DragEvent<HTMLDivElement>, targetTabId: string) => void;
  onTabDropOnTarget: (e: React.DragEvent<HTMLDivElement>, targetTabId: string, position: TabDropPosition) => void;
  dropPosition: TabDropPosition | null;
  activeRef: React.RefObject<HTMLDivElement>;
}

function TabItem({
  tab,
  isActive,
  isFocusedPane,
  isRenaming,
  onActivate,
  onClose,
  onContextMenu,
  onRenameSubmit,
  onRenameCancel,
  onTabDragOverTarget,
  onTabDragLeaveTarget,
  onTabDropOnTarget,
  dropPosition,
  activeRef,
}: TabItemProps): JSX.Element {
  const { t } = useI18n();
  const agentState = useAgentState(tab.targetId);
  const label = tab.type === 'terminal' && agentState?.name ? agentState.name : tab.title;
  const statusDot = <TabStatusDot tab={tab} agentState={agentState} />;
  const showRefresh = tab.type === 'file' && Boolean(tab.isStale);
  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const reload = getFileEditorReloadHandler(tab.id);
    if (reload) {
      reload();
      return;
    }
    if (!tab.isDirty && (tab.editorType === 'code' || tab.editorType === 'markdown')) {
      void (async () => {
        const content = await fsService.readFile(tab.targetId).catch(() => '');
        replaceDraftCache(tab.id, content);
        const signature = toFileSignature(await fsService.statItem(tab.targetId));
        setKnownFileTabSignature(tab.id, signature);
        const store = useEditorStore.getState();
        store.setDirty(tab.id, false);
        store.setStale(tab.id, false);
      })();
      return;
    }
    onActivate(tab.id);
    requestAnimationFrame(() => {
      getFileEditorReloadHandler(tab.id)?.();
    });
  };

  return (
    <div
      ref={isActive ? (activeRef as React.LegacyRef<HTMLDivElement>) : undefined}
      draggable={!isRenaming}
      onDragStart={(e) => setTabDragData(e, tab.id)}
      onDragEnd={() => clearTabDragData()}
      className={`group relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 text-xs transition-colors ${
        isActive
          ? `tab-active bg-[var(--surface-editor)] text-default ${
              isFocusedPane ? 'tab-active-focused' : 'tab-active-unfocused'
            }`
          : 'text-secondary hover:text-default hover:bg-surface-hover/40 tab-inactive'
      }`}
      style={{ height: 30, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onClick={() => !isRenaming && onActivate(tab.id)}
      onContextMenu={(e) => onContextMenu(e, tab)}
      onDragOver={(e) => {
        if (isRenaming || !isTabDrag(e)) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const position: TabDropPosition = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
        onTabDragOverTarget(e, tab.id, position);
      }}
      onDragLeave={(e) => onTabDragLeaveTarget(e, tab.id)}
      onDrop={(e) => {
        if (!dropPosition || !isTabDrag(e)) return;
        onTabDropOnTarget(e, tab.id, dropPosition);
      }}
    >
      {isActive && <span aria-hidden="true" className="tab-active-indicator" />}
      {dropPosition && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-1 top-1 z-10 w-0.5 rounded-full bg-accent ${
            dropPosition === 'before' ? 'left-0' : 'right-0'
          }`}
        />
      )}
      <TabIcon tab={tab} />
      {isRenaming ? (
        <InlineRenameInput
          value={label}
          onSubmit={(v) => onRenameSubmit(tab.id, v)}
          onCancel={onRenameCancel}
        />
      ) : (
        <span className={isActive ? 'whitespace-nowrap' : 'max-w-[120px] truncate'}>{label}</span>
      )}
      {showRefresh && (
        <Tooltip content={t('fileEditor.reloadFromDisk')} position="bottom">
          <button
            className="rounded p-0.5 text-muted hover:text-default"
            onClick={handleRefreshClick}
          >
            <RefreshCw size={10} />
          </button>
        </Tooltip>
      )}
      <span className="relative ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {statusDot ? <span className="absolute inset-0 flex items-center justify-center">{statusDot}</span> : null}
        <button
          className="absolute inset-0 rounded p-0.5 text-muted opacity-0 hover:text-default group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
        >
          <X size={10} />
        </button>
      </span>
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

export function EditorTabStrip({
  tabs,
  activeTabId,
  isFocusedPane = true,
  hostId,
  onActivate,
  onClose,
  onTabDrop,
  onTabReorder,
  onFileDrop,
  rightSlot,
}: EditorTabStripProps): JSX.Element {
  const [dragOver, setDragOver] = useState(false);
  const [tabDropTarget, setTabDropTarget] = useState<{ tabId: string; position: TabDropPosition } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuEntry[] } | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  // Keep the active tab fully visible inside the horizontal scroll viewport.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const activeEl = activeRef.current;
    if (!scrollEl || !activeEl) return;

    const frame = requestAnimationFrame(() => {
      const containerRect = scrollEl.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const padding = 8;

      if (activeRect.left < containerRect.left) {
        const nextScrollLeft = Math.max(0, scrollEl.scrollLeft - (containerRect.left - activeRect.left) - padding);
        scrollEl.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
        return;
      }

      if (activeRect.right > containerRect.right) {
        const nextScrollLeft = scrollEl.scrollLeft + (activeRect.right - containerRect.right) + padding;
        scrollEl.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTabId, activeTab?.isDirty]);

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

  const handleTabDragOverTarget = useCallback((
    e: React.DragEvent<HTMLDivElement>,
    targetTabId: string,
    position: TabDropPosition,
  ) => {
    if (!onTabReorder) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(false);
    setTabDropTarget((current) => (
      current?.tabId === targetTabId && current.position === position
        ? current
        : { tabId: targetTabId, position }
    ));
  }, [onTabReorder]);

  const handleTabDragLeaveTarget = useCallback((e: React.DragEvent<HTMLDivElement>, targetTabId: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setTabDropTarget((current) => (current?.tabId === targetTabId ? null : current));
  }, []);

  const handleTabDropOnTarget = useCallback(async (
    e: React.DragEvent<HTMLDivElement>,
    targetTabId: string,
    position: TabDropPosition,
  ) => {
    if (!onTabReorder) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    setTabDropTarget(null);
    const tabId = await getTabDragDataAsync(e);
    flushTabDragData();
    console.log(`[EditorTabStrip] tab reorder host=${hostId ?? 'main'}, tabId=${tabId}, targetTabId=${targetTabId}, position=${position}`);
    if (tabId && tabId !== targetTabId) {
      onTabReorder(tabId, targetTabId, position);
    }
  }, [hostId, onTabReorder]);

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
    setTabDropTarget(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setTabDropTarget(null);
    if (isFileOpenDrag(e)) {
      const filePaths = getFileOpenDragData(e);
      console.log(`[EditorTabStrip] file drop host=${hostId ?? 'main'}, count=${filePaths.length}`);
      if (filePaths.length > 0) onFileDrop?.(filePaths);
      return;
    }
    if (!onTabDrop) return;
    const tabId = await getTabDragDataAsync(e);
    flushTabDragData();
    console.log(`[EditorTabStrip] drop host=${hostId ?? 'main'}, tabId=${tabId}`);
    if (tabId) {
      onTabDrop(tabId);
    }
  }, [hostId, onTabDrop, onFileDrop]);

  const handleRenameSubmit = useCallback((tabId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      setRenamingTabId(null);
      return;
    }

    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) {
      setRenamingTabId(null);
      return;
    }

    const agentState = tab.type === 'terminal' ? getAgentSessionStateByTerminal(tab.targetId) : null;
    const shouldSyncAgentName = tab.type === 'terminal'
      && Boolean(tab.terminalLaunchConfig?.agent || agentState);
    const previousTitle = tab.title;

    if (shouldSyncAgentName) {
      useEditorStore.getState().updateTitle(tabId, trimmedTitle, true);
      void window.electron.agent.setName(tab.targetId, trimmedTitle)
        .then((handled) => {
          if (!handled) {
            throw new Error('Agent terminal session name sync is not active');
          }
        })
        .catch((error) => {
          useEditorStore.getState().updateTitle(tabId, previousTitle, true);
          console.error('[EditorTabStrip] failed to sync agent session name:', error);
        });
    } else {
      useEditorStore.getState().updateTitle(tabId, trimmedTitle, true);
    }

    setRenamingTabId(null);
  }, [tabs]);

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
      <div ref={scrollRef} className="tab-scroll flex min-w-0 flex-1 items-end pl-3 pr-2">
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
            onTabDragOverTarget={handleTabDragOverTarget}
            onTabDragLeaveTarget={handleTabDragLeaveTarget}
            onTabDropOnTarget={handleTabDropOnTarget}
            dropPosition={tabDropTarget?.tabId === tab.id ? tabDropTarget.position : null}
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
