import React, { useEffect, useRef, useState } from 'react';
import { Plus, ArrowRightLeft, File } from 'lucide-react';
import type { Canvas } from '@netior/shared/types';
import { useCanvasStore } from '../../stores/canvas-store';
import { canvasService } from '../../services';
import { useI18n } from '../../hooks/useI18n';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onCreateConcept: () => void;
  onAddFileNode?: () => void;
  onClose: () => void;
}

export function CanvasContextMenu({ x, y, onCreateConcept, onAddFileNode, onClose }: CanvasContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const { currentCanvas, canvases, openCanvas } = useCanvasStore();
  const [siblingCanvases, setSiblingCanvases] = useState<Canvas[]>([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Load sibling canvases
  useEffect(() => {
    if (!currentCanvas) return;
    if (currentCanvas.concept_id) {
      canvasService.getCanvasesByConcept(currentCanvas.concept_id).then((list) => {
        setSiblingCanvases(list.filter((c) => c.id !== currentCanvas.id));
      });
    } else {
      setSiblingCanvases(canvases.filter((c) => c.id !== currentCanvas.id));
    }
  }, [currentCanvas, canvases]);

  const handleSwitch = async (canvasId: string) => {
    await openCanvas(canvasId);
    onClose();
  };

  return (
    <div
      className="fixed z-50 rounded-md border border-default bg-surface-modal py-1 shadow-lg min-w-[180px]"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
        onClick={() => {
          onCreateConcept();
          onClose();
        }}
      >
        <Plus size={14} />
        {t('canvas.createConcept')}
      </button>

      {onAddFileNode && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={() => {
            onAddFileNode();
            onClose();
          }}
        >
          <File size={14} />
          {t('canvas.addFileNode')}
        </button>
      )}

      {siblingCanvases.length > 0 && (
        <>
          <div className="my-1 border-t border-subtle" />
          <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
            <ArrowRightLeft size={10} />
            {t('canvas.switchCanvas') ?? 'Switch Canvas'}
          </div>
          {siblingCanvases.map((c) => (
            <button
              key={c.id}
              className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
              onClick={() => handleSwitch(c.id)}
            >
              {c.name}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
