import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Layout, ChevronRight, ChevronDown, Circle } from 'lucide-react';
import type { CanvasTreeNode } from '@netior/shared/types';
import { useCanvasStore } from '../../stores/canvas-store';
import { useCanvasTypeStore } from '../../stores/canvas-type-store';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import { Select } from '../ui/Select';

interface CanvasListProps {
  projectId: string;
}

// ─── Context Menu ────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  canvasId: string;
  canvasName: string;
}

function CanvasItemContextMenu({
  x, y, canvasId, canvasName, onClose,
}: ContextMenuState & { onClose: () => void }): JSX.Element {
  const { t } = useI18n();
  const { deleteCanvas } = useCanvasStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 bg-surface-card border border-subtle rounded shadow-lg py-1 min-w-[140px]"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
        onClick={() => {
          useEditorStore.getState().openTab({
            type: 'canvas',
            targetId: canvasId,
            title: canvasName,
          });
          onClose();
        }}
      >
        {t('editor.openInEditor')}
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-status-error hover:bg-surface-hover cursor-pointer"
        onClick={async () => {
          await deleteCanvas(canvasId);
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
  currentCanvasId,
  onOpen,
  onContextMenu,
}: {
  treeNode: CanvasTreeNode;
  depth: number;
  currentCanvasId?: string;
  onOpen: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, name: string) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(depth < 2);
  const isActive = currentCanvasId === treeNode.canvas.id;

  // Group children by concept_id to create concept headers
  const conceptGroups = new Map<string, { title: string; nodes: CanvasTreeNode[] }>();
  const directChildren: CanvasTreeNode[] = [];

  for (const child of treeNode.children) {
    if (child.conceptTitle && child.canvas.concept_id) {
      const group = conceptGroups.get(child.canvas.concept_id) ?? { title: child.conceptTitle, nodes: [] };
      group.nodes.push(child);
      conceptGroups.set(child.canvas.concept_id, group);
    } else {
      directChildren.push(child);
    }
  }

  const hasChildren = treeNode.children.length > 0;

  return (
    <>
      {/* Canvas row */}
      <div
        className={`group flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors ${
          isActive
            ? 'bg-accent/10 text-accent'
            : 'text-secondary hover:bg-surface-hover hover:text-default'
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => onOpen(treeNode.canvas.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, treeNode.canvas.id, treeNode.canvas.name);
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
        <span className="flex-1 truncate">{treeNode.canvas.name}</span>
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
              currentCanvasId={currentCanvasId}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
            />
          ))}
          {/* Direct children (no concept grouping) */}
          {directChildren.map((child) => (
            <TreeNode
              key={child.canvas.id}
              treeNode={child}
              depth={depth + 1}
              currentCanvasId={currentCanvasId}
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
  currentCanvasId,
  onOpen,
  onContextMenu,
}: {
  conceptTitle: string;
  nodes: CanvasTreeNode[];
  depth: number;
  currentCanvasId?: string;
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
          key={node.canvas.id}
          treeNode={node}
          depth={depth + 1}
          currentCanvasId={currentCanvasId}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

// ─── CanvasList Root ─────────────────────────────────────────────

export function CanvasList({ projectId }: CanvasListProps): JSX.Element {
  const { t } = useI18n();
  const { currentCanvas, createCanvas, openCanvas, loadCanvasTree, canvasTree } = useCanvasStore();
  const canvasTypes = useCanvasTypeStore((s) => s.canvasTypes);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedCanvasTypeId, setSelectedCanvasTypeId] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    loadCanvasTree(projectId);
  }, [projectId, loadCanvasTree]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const canvas = await createCanvas({
      project_id: projectId,
      name: newName.trim(),
      canvas_type_id: selectedCanvasTypeId || undefined,
    });
    await openCanvas(canvas.id);
    await loadCanvasTree(projectId);
    setNewName('');
    setSelectedCanvasTypeId('');
    setCreating(false);
  };

  const handleCancel = () => {
    setCreating(false);
    setNewName('');
    setSelectedCanvasTypeId('');
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, canvasId: string, canvasName: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, canvasId, canvasName });
  }, []);

  return (
    <div className="flex flex-col gap-0.5" onMouseDown={() => setContextMenu(null)}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-secondary">{t('sidebar.canvases')}</span>
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
            placeholder={t('canvas.namePlaceholder')}
            autoFocus
          />
          {canvasTypes.length > 0 && (
            <Select
              options={[
                { value: '', label: t('canvasType.noType') ?? 'None' },
                ...canvasTypes.map((ct) => ({ value: ct.id, label: ct.name })),
              ]}
              value={selectedCanvasTypeId}
              onChange={(e) => setSelectedCanvasTypeId(e.target.value)}
              selectSize="sm"
            />
          )}
        </div>
      )}

      {canvasTree.map((treeNode) => (
        <TreeNode
          key={treeNode.canvas.id}
          treeNode={treeNode}
          depth={0}
          currentCanvasId={currentCanvas?.id}
          onOpen={openCanvas}
          onContextMenu={handleContextMenu}
        />
      ))}

      {canvasTree.length === 0 && !creating && (
        <div className="px-3 py-4 text-xs text-muted text-center">
          {t('canvas.noCanvases') ?? 'No canvases'}
        </div>
      )}

      {contextMenu && (
        <CanvasItemContextMenu
          {...contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
