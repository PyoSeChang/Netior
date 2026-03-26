import React, { useCallback, useEffect, useRef } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvas-store';
import { canvasService } from '../../services';
import { useI18n } from '../../hooks/useI18n';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  conceptId: string;
  hasSubCanvas: boolean;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  nodeId,
  conceptId,
  hasSubCanvas,
  onClose,
}: NodeContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const { drillInto, removeNode, currentCanvas, openCanvas, nodes } =
    useCanvasStore();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDrillInto = useCallback(async () => {
    await drillInto(conceptId);
    onClose();
  }, [drillInto, conceptId, onClose]);

  const handleCreateSubCanvas = useCallback(async () => {
    if (!currentCanvas) return;
    const node = nodes.find((n) => n.id === nodeId);
    const name = node ? `${node.concept.title} Canvas` : 'Sub Canvas';

    await canvasService.create({
      project_id: currentCanvas.project_id,
      name,
      concept_id: conceptId,
    });

    // Reload current canvas to update has_sub_canvas flags
    await openCanvas(currentCanvas.id);
    onClose();
  }, [currentCanvas, nodes, nodeId, conceptId, openCanvas, onClose]);

  const handleDelete = useCallback(async () => {
    await removeNode(nodeId);
    onClose();
  }, [removeNode, nodeId, onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface-card border border-subtle rounded shadow-lg py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {hasSubCanvas ? (
        <button
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-default hover:bg-surface-hover cursor-pointer"
          onClick={handleDrillInto}
        >
          <Layers size={14} />
          {t('canvas.openSubCanvas')}
        </button>
      ) : (
        <button
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-default hover:bg-surface-hover cursor-pointer"
          onClick={handleCreateSubCanvas}
        >
          <Plus size={14} />
          {t('canvas.createSubCanvas')}
        </button>
      )}
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-default hover:bg-surface-hover cursor-pointer"
        onClick={handleDelete}
      >
        <Trash2 size={14} />
        {t('common.delete')}
      </button>
    </div>
  );
}
