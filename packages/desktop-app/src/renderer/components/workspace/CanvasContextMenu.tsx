import React, { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onCreateConcept: () => void;
  onClose: () => void;
}

export function CanvasContextMenu({ x, y, onCreateConcept, onClose }: CanvasContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded border border-subtle bg-surface-card py-1 shadow-lg min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-default hover:bg-surface-hover cursor-pointer"
        onClick={() => {
          onCreateConcept();
          onClose();
        }}
      >
        <Plus size={14} />
        {t('canvas.createConcept')}
      </button>
    </div>
  );
}
