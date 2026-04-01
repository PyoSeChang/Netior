import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import type { Canvas } from '@netior/shared/types';
import { canvasService } from '../../services';
import { useCanvasStore } from '../../stores/canvas-store';
import { useI18n } from '../../hooks/useI18n';

interface NodeCanvasOverlayProps {
  conceptId: string;
  /** Screen-space position of the node */
  x: number;
  y: number;
  onClose: () => void;
}

export function NodeCanvasOverlay({ conceptId, x, y, onClose }: NodeCanvasOverlayProps): JSX.Element | null {
  const { t } = useI18n();
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const { openCanvas, currentCanvas } = useCanvasStore();

  useEffect(() => {
    canvasService.getCanvasesByConcept(conceptId).then(setCanvases);
  }, [conceptId]);

  if (canvases.length === 0) return null;

  const handleClick = async (canvasId: string) => {
    if (currentCanvas) {
      useCanvasStore.setState((s) => ({
        canvasHistory: [...s.canvasHistory, currentCanvas.id],
      }));
    }
    await openCanvas(canvasId);
    onClose();
  };

  return (
    <div
      className="fixed z-40 bg-surface-panel border border-default rounded-md shadow-lg py-1 min-w-[140px]"
      style={{ left: x, top: y - 8, transform: 'translateY(-100%)' }}
      onMouseLeave={onClose}
    >
      <div className="px-2 py-1 text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
        <Layers size={10} />
        {t('canvas.canvasesForConcept') ?? 'Canvases'}
      </div>
      {canvases.map((c) => (
        <button
          key={c.id}
          type="button"
          className="w-full text-left px-3 py-1 text-xs text-default hover:bg-surface-hover transition-colors"
          onClick={() => handleClick(c.id)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
