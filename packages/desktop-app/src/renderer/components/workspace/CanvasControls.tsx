import React, { useState, useCallback, useRef } from 'react';
import { Eye, Pencil, ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight, GripHorizontal } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { useI18n } from '../../hooks/useI18n';

type HiddenControl = 'zoom' | 'fit' | 'nav' | 'mode';

interface ExtraControlItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface CanvasControlsProps {
  mode: 'browse' | 'edit';
  zoom: number;
  canGoBack: boolean;
  canGoForward: boolean;
  onToggleMode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  hiddenControls?: HiddenControl[];
  extraItems?: ExtraControlItem[];
}

export function CanvasControls({
  mode,
  zoom,
  canGoBack,
  canGoForward,
  onToggleMode,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onNavigateBack,
  onNavigateForward,
  hiddenControls = [],
  extraItems = [],
}: CanvasControlsProps): JSX.Element {
  const { t } = useI18n();
  const [pos, setPos] = useState({ x: -1, y: -1 }); // -1 = default position
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const origX = pos.x === -1 ? rect.left : pos.x;
    const origY = pos.y === -1 ? rect.top : pos.y;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX, origY };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [pos]);

  const hidden = new Set(hiddenControls);
  const showMode = !hidden.has('mode');
  const showNav = !hidden.has('nav');
  const showZoom = !hidden.has('zoom');
  const showFit = !hidden.has('fit');

  const isCustomPos = pos.x !== -1;
  const style: React.CSSProperties = isCustomPos
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 50 }
    : { position: 'absolute', right: 8, top: 8, zIndex: 30 };

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1 rounded-lg border border-subtle bg-surface-panel px-1.5 py-1 shadow-sm"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Drag handle */}
      <div
        className="cursor-grab active:cursor-grabbing text-muted hover:text-secondary p-0.5"
        onMouseDown={handleDragStart}
      >
        <GripHorizontal size={12} />
      </div>

      {/* Mode toggle */}
      {showMode && (
        <Tooltip content={mode === 'browse' ? t('canvas.editMode') : t('canvas.browseMode')} position="bottom">
          <button
            className={`rounded p-1 transition-colors ${
              mode === 'edit'
                ? 'bg-interactive-selected text-accent'
                : 'text-secondary hover:bg-surface-hover hover:text-default'
            }`}
            onClick={onToggleMode}
          >
            {mode === 'browse' ? <Eye size={14} /> : <Pencil size={14} />}
          </button>
        </Tooltip>
      )}

      {showMode && (showNav || showZoom || showFit || extraItems.length > 0) && (
        <div className="mx-0.5 h-4 w-px bg-border-subtle" />
      )}

      {/* Navigation */}
      {showNav && mode === 'browse' && (
        <>
          <Tooltip content={t('canvas.navBack')} position="bottom">
            <button
              className="rounded p-1 text-secondary hover:bg-surface-hover hover:text-default disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={!canGoBack}
              onClick={onNavigateBack}
            >
              <ChevronLeft size={14} />
            </button>
          </Tooltip>
          <Tooltip content={t('canvas.navForward')} position="bottom">
            <button
              className="rounded p-1 text-secondary hover:bg-surface-hover hover:text-default disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={!canGoForward}
              onClick={onNavigateForward}
            >
              <ChevronRight size={14} />
            </button>
          </Tooltip>
          {(showZoom || showFit) && <div className="mx-0.5 h-4 w-px bg-border-subtle" />}
        </>
      )}

      {/* Zoom controls */}
      {showZoom && (
        <>
          <Tooltip content={t('canvas.zoomOut')} position="bottom">
            <button
              className="rounded p-1 text-secondary hover:bg-surface-hover hover:text-default"
              onClick={onZoomOut}
            >
              <ZoomOut size={14} />
            </button>
          </Tooltip>

          <span className="min-w-[36px] text-center text-xs text-secondary tabular-nums">
            {Math.round(zoom * 100)}%
          </span>

          <Tooltip content={t('canvas.zoomIn')} position="bottom">
            <button
              className="rounded p-1 text-secondary hover:bg-surface-hover hover:text-default"
              onClick={onZoomIn}
            >
              <ZoomIn size={14} />
            </button>
          </Tooltip>
        </>
      )}

      {showFit && (
        <Tooltip content={t('canvas.fitToScreen')} position="bottom">
          <button
            className="rounded p-1 text-secondary hover:bg-surface-hover hover:text-default"
            onClick={onFitToScreen}
          >
            <Maximize size={14} />
          </button>
        </Tooltip>
      )}

      {/* Plugin extra items */}
      {extraItems.length > 0 && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border-subtle" />
          {extraItems.map((item) => (
            <Tooltip key={item.key} content={item.label} position="bottom">
              <button
                className="rounded p-1 text-secondary hover:bg-surface-hover hover:text-default"
                onClick={item.onClick}
              >
                {item.icon}
              </button>
            </Tooltip>
          ))}
        </>
      )}
    </div>
  );
}
