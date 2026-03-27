import React, { useState, useCallback } from 'react';
import type { SplitDirection } from '@moc/shared/types';
import { isTabDrag, getTabDragData } from '../../hooks/useTabDrag';

export type DropZone = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface DropResult {
  tabId: string;
  zone: DropZone;
  direction: SplitDirection;
  position: 'before' | 'after';
}

interface DropZoneOverlayProps {
  onDrop: (result: DropResult) => void;
  centerOnly?: boolean;
  active: boolean;
}

function zoneToSplit(zone: DropZone): { direction: SplitDirection; position: 'before' | 'after' } {
  switch (zone) {
    case 'top': return { direction: 'vertical', position: 'before' };
    case 'bottom': return { direction: 'vertical', position: 'after' };
    case 'left': return { direction: 'horizontal', position: 'before' };
    case 'right': return { direction: 'horizontal', position: 'after' };
    case 'center': return { direction: 'horizontal', position: 'after' };
  }
}

function getZone(e: React.DragEvent<HTMLDivElement>, centerOnly?: boolean): DropZone {
  if (centerOnly) return 'center';

  const rect = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  const threshold = 0.25;

  if (y < threshold) return 'top';
  if (y > 1 - threshold) return 'bottom';
  if (x < threshold) return 'left';
  if (x > 1 - threshold) return 'right';
  return 'center';
}

export function DropZoneOverlay({ onDrop, centerOnly, active }: DropZoneOverlayProps): JSX.Element | null {
  const [activeZone, setActiveZone] = useState<DropZone | null>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!isTabDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setActiveZone(getZone(e, centerOnly));
    },
    [centerOnly],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setActiveZone(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const tabId = getTabDragData(e);
      if (!tabId) return;

      const zone = getZone(e, centerOnly);
      const { direction, position } = zoneToSplit(zone);
      onDrop({ tabId, zone, direction, position });

      setActiveZone(null);
    },
    [onDrop, centerOnly],
  );

  // Only render when a drag is active
  if (!active) return null;

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {centerOnly ? (
        <div className={`absolute inset-0 pointer-events-auto transition-colors ${
          activeZone === 'center' ? 'bg-accent/20 border-2 border-accent' : ''
        }`} />
      ) : (
        <>
          <div className={`absolute inset-x-0 top-0 h-1/4 pointer-events-auto transition-colors ${
            activeZone === 'top' ? 'bg-accent/20 border-b-2 border-accent' : ''
          }`} />
          <div className={`absolute inset-x-0 bottom-0 h-1/4 pointer-events-auto transition-colors ${
            activeZone === 'bottom' ? 'bg-accent/20 border-t-2 border-accent' : ''
          }`} />
          <div className={`absolute inset-y-0 left-0 w-1/4 pointer-events-auto transition-colors ${
            activeZone === 'left' ? 'bg-accent/20 border-r-2 border-accent' : ''
          }`} />
          <div className={`absolute inset-y-0 right-0 w-1/4 pointer-events-auto transition-colors ${
            activeZone === 'right' ? 'bg-accent/20 border-l-2 border-accent' : ''
          }`} />
          <div className={`absolute left-1/4 right-1/4 top-1/4 bottom-1/4 pointer-events-auto transition-colors ${
            activeZone === 'center' ? 'bg-accent/10 border-2 border-dashed border-accent' : ''
          }`} />
        </>
      )}
    </div>
  );
}
