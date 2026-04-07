import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Layout, ChevronRight, ChevronDown, Circle } from 'lucide-react';
import type { NetworkTreeNode } from '@netior/shared/types';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';

interface NetworkListProps {
  projectId: string;
}

// ─── Context Menu ────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  networkId: string;
  networkName: string;
}

function NetworkItemContextMenu({
  x, y, networkId, networkName, onClose,
}: ContextMenuState & { onClose: () => void }): JSX.Element {
  const { t } = useI18n();
  const { deleteNetwork } = useNetworkStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 bg-surface-modal border border-default rounded-md shadow-lg py-1 min-w-[180px]"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
        onClick={() => {
          useEditorStore.getState().openTab({
            type: 'network',
            targetId: networkId,
            title: networkName,
          });
          onClose();
        }}
      >
        {t('editor.openInEditor')}
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-red-400 hover:bg-surface-hover cursor-pointer"
        onClick={async () => {
          await deleteNetwork(networkId);
          onClose();
        }}
      >
        <Trash2 size={12} />
        {t('common.delete')}
      </button>
    </div>
  );
}

// ─── Tree Item ───────────────────────────────────────────────────

function TreeNode({
  treeNode,
  depth,
  currentNetworkId,
  onOpen,
  onContextMenu,
}: {
  treeNode: NetworkTreeNode;
  depth: number;
  currentNetworkId?: string;
  onOpen: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, name: string) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(depth < 2);
  const isActive = currentNetworkId === treeNode.network.id;

  // Group children by concept_id to create concept headers
  const conceptGroups = new Map<string, { title: string; nodes: NetworkTreeNode[] }>();
  const directChildren: NetworkTreeNode[] = [];

  for (const child of treeNode.children) {
    if (child.conceptTitle && child.network.concept_id) {
      const group = conceptGroups.get(child.network.concept_id) ?? { title: child.conceptTitle, nodes: [] };
      group.nodes.push(child);
      conceptGroups.set(child.network.concept_id, group);
    } else {
      directChildren.push(child);
    }
  }

  const hasChildren = treeNode.children.length > 0;

  return (
    <>
      {/* Network row */}
      <div
        className={`group flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors ${
          isActive
            ? 'bg-interactive-selected text-accent'
            : 'text-secondary hover:bg-surface-hover hover:text-default'
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => onOpen(treeNode.network.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, treeNode.network.id, treeNode.network.name);
        }}
      >
        {hasChildren ? (
          <button
            className="shrink-0 p-0.5"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Layout size={12} className="shrink-0 opacity-50" />
        <span className="flex-1 truncate">{treeNode.network.name}</span>
      </div>

      {/* Children grouped by concept */}
      {expanded && (
        <>
          {/* Concept groups */}
          {Array.from(conceptGroups.entries()).map(([conceptId, group]) => (
            <ConceptGroup
              key={conceptId}
              conceptTitle={group.title}
              nodes={group.nodes}
              depth={depth + 1}
              currentNetworkId={currentNetworkId}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
            />
          ))}
          {/* Direct children (no concept grouping) */}
          {directChildren.map((child) => (
            <TreeNode
              key={child.network.id}
              treeNode={child}
              depth={depth + 1}
              currentNetworkId={currentNetworkId}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
            />
          ))}
        </>
      )}
    </>
  );
}

// ─── Concept Group Header ────────────────────────────────────────

function ConceptGroup({
  conceptTitle,
  nodes,
  depth,
  currentNetworkId,
  onOpen,
  onContextMenu,
}: {
  conceptTitle: string;
  nodes: NetworkTreeNode[];
  depth: number;
  currentNetworkId?: string;
  onOpen: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, name: string) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(true);

  return (
    <>
      <div
        className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[11px] text-secondary hover:bg-surface-hover"
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <Circle size={8} className="shrink-0 fill-current opacity-40" />
        <span className="truncate">{conceptTitle}</span>
      </div>
      {expanded && nodes.map((node) => (
        <TreeNode
          key={node.network.id}
          treeNode={node}
          depth={depth + 1}
          currentNetworkId={currentNetworkId}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

// ─── NetworkList Root ─────────────────────────────────────────────

export function NetworkList({ projectId }: NetworkListProps): JSX.Element {
  const { t } = useI18n();
  const { currentNetwork, createNetwork, openNetwork, loadNetworkTree, networkTree } = useNetworkStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    loadNetworkTree(projectId);
  }, [projectId, loadNetworkTree]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const network = await createNetwork({
      project_id: projectId,
      name: newName.trim(),
    });
    await openNetwork(network.id);
    await loadNetworkTree(projectId);
    setNewName('');
    setCreating(false);
  };

  const handleCancel = () => {
    setCreating(false);
    setNewName('');
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, networkId: string, networkName: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, networkId, networkName });
  }, []);

  return (
    <div className="flex flex-col gap-0.5" onMouseDown={() => setContextMenu(null)}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-secondary">{t('sidebar.networks')}</span>
        <button
          className="rounded p-0.5 text-muted hover:bg-surface-hover hover:text-default"
          onClick={() => setCreating(true)}
        >
          <Plus size={14} />
        </button>
      </div>

      {creating && (
        <div className="flex flex-col gap-1 px-2">
          <input
            className="rounded border border-subtle bg-input px-2 py-1 text-xs text-default outline-none focus:border-accent"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder={t('network.namePlaceholder')}
            autoFocus
          />
        </div>
      )}

      {networkTree.map((treeNode) => (
        <TreeNode
          key={treeNode.network.id}
          treeNode={treeNode}
          depth={0}
          currentNetworkId={currentNetwork?.id}
          onOpen={openNetwork}
          onContextMenu={handleContextMenu}
        />
      ))}

      {networkTree.length === 0 && !creating && (
        <div className="px-3 py-4 text-xs text-muted text-center">
          {t('network.noNetworks') ?? 'No networks'}
        </div>
      )}

      {contextMenu && (
        <NetworkItemContextMenu
          {...contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
