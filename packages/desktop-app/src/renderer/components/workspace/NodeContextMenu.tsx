import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Link, Plus, Trash2 } from 'lucide-react';
import type { Canvas } from '@netior/shared/types';
import { useCanvasStore } from '../../stores/canvas-store';
import { canvasService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import type { CanvasMode } from '../../stores/ui-store';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  conceptId?: string;
  canvasCount: number;
  mode: CanvasMode;
  onAddConnection?: (nodeId: string) => void;
  onCreateCanvas?: (conceptId: string) => void;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  nodeId,
  conceptId,
  canvasCount,
  mode,
  onAddConnection,
  onCreateCanvas,
  onClose,
}: NodeContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const { drillInto, removeNode, currentCanvas } = useCanvasStore();
  const [canvases, setCanvases] = useState<Canvas[]>([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Load canvases for this concept
  useEffect(() => {
    if (conceptId) {
      canvasService.getCanvasesByConcept(conceptId).then(setCanvases);
    }
  }, [conceptId]);

  const handleNavigateToCanvas = useCallback(async (canvasId: string) => {
    if (currentCanvas) {
      useCanvasStore.setState((s) => ({
        canvasHistory: [...s.canvasHistory, currentCanvas.id],
      }));
    }
    await useCanvasStore.getState().openCanvas(canvasId);
    onClose();
  }, [currentCanvas, onClose]);

  const handleCreateCanvas = useCallback(() => {
    if (conceptId) onCreateCanvas?.(conceptId);
    onClose();
  }, [onCreateCanvas, conceptId, onClose]);

  const handleAddConnection = useCallback(() => {
    onAddConnection?.(nodeId);
    onClose();
  }, [onAddConnection, nodeId, onClose]);

  const handleDelete = useCallback(async () => {
    await removeNode(nodeId);
    onClose();
  }, [removeNode, nodeId, onClose]);

  return (
    <div
      className="fixed z-50 bg-surface-modal border border-default rounded-md shadow-lg py-1 min-w-[180px]"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Canvas list section */}
      {conceptId && canvases.length > 0 && (
        <>
          <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
            <Layers size={10} />
            {t('canvas.canvasesForConcept') ?? 'Canvases'}
          </div>
          {canvases.map((c) => (
            <button
              key={c.id}
              className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
              onClick={() => handleNavigateToCanvas(c.id)}
            >
              {c.name}
            </button>
          ))}
          <div className="my-1 border-t border-subtle" />
        </>
      )}

      {/* Canvas creation */}
      {conceptId && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={handleCreateCanvas}
        >
          <Plus size={14} />
          {t('canvas.createCanvas')}
        </button>
      )}

      {/* Edge connection (edit mode only) */}
      {mode === 'edit' && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={handleAddConnection}
        >
          <Link size={14} />
          {t('edge.addConnection')}
        </button>
      )}

      {/* Delete */}
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
        onClick={handleDelete}
      >
        <Trash2 size={14} />
        {t('common.delete')}
      </button>
    </div>
  );
}
