import React from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvas-store';
import { useI18n } from '../../hooks/useI18n';

export function CanvasBreadcrumb(): JSX.Element | null {
  const { breadcrumbs, canvasHistory, navigateToBreadcrumb, navigateBack } =
    useCanvasStore();

  const { t } = useI18n();

  if (breadcrumbs.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 bg-surface-panel border-b border-subtle px-2 py-1">
      <button
        className="flex items-center justify-center rounded p-0.5 text-text-secondary hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={canvasHistory.length === 0}
        onClick={() => navigateBack()}
        aria-label={t('canvas.navigateBack')}
      >
        <ArrowLeft size={14} />
      </button>

      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        const label = crumb.conceptTitle ?? crumb.canvasName;

        return (
          <React.Fragment key={crumb.canvasId}>
            {idx > 0 && (
              <ChevronRight size={12} className="text-text-muted shrink-0" />
            )}
            {isLast ? (
              <span className="text-xs text-accent font-medium truncate">
                {label}
              </span>
            ) : (
              <button
                className="text-xs text-text-secondary hover:text-text-default hover:underline truncate"
                onClick={() => navigateToBreadcrumb(crumb.canvasId)}
              >
                {label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
