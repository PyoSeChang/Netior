import React from 'react';
import { Eye, Pencil, ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { useI18n } from '../../hooks/useI18n';

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
}: CanvasControlsProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-lg border border-subtle bg-surface-panel px-1.5 py-1 shadow-sm">
      {/* Mode toggle */}
      <Tooltip content={mode === 'browse' ? t('canvas.editMode') : t('canvas.browseMode')} position="bottom">
        <button
          className={`rounded p-1 transition-colors ${
            mode === 'edit'
              ? 'bg-accent/10 text-accent'
              : 'text-secondary hover:bg-surface-hover hover:text-default'
          }`}
          onClick={onToggleMode}
        >
          {mode === 'browse' ? <Eye size={14} /> : <Pencil size={14} />}
        </button>
      </Tooltip>

      <div className="mx-0.5 h-4 w-px bg-border-subtle" />

      {/* Navigation (browse mode) */}
      {mode === 'browse' && (
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
          <div className="mx-0.5 h-4 w-px bg-border-subtle" />
        </>
      )}

      {/* Zoom controls */}
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

      <Tooltip content={t('canvas.fitToScreen')} position="bottom">
        <button
          className="rounded p-1 text-secondary hover:bg-surface-hover hover:text-default"
          onClick={onFitToScreen}
        >
          <Maximize size={14} />
        </button>
      </Tooltip>
    </div>
  );
}
