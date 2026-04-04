import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { useI18n } from '../../hooks/useI18n';

interface EdgePanelProps {
  /** Which edge the panel slides from. */
  side: 'left' | 'right';
  /** Panel width in px. Default 260. */
  width?: number;
  /** When true, panel stays visible regardless of hover. */
  pinned?: boolean;
  /** Called when pin button is toggled. If omitted, pin button is hidden. */
  onPinChange?: (pinned: boolean) => void;
  /** Header title text. If omitted, header is hidden. */
  title?: string;
  /** Extra elements rendered in the header (right side, before pin button). */
  headerActions?: React.ReactNode;
  /** Auto-show the panel for a duration (in ms), then hide. */
  autoShowMs?: number;
  /** Delay before showing on hover (ms). Default 120. */
  showDelay?: number;
  /** Delay before hiding after mouse leaves (ms). Default 400. */
  hideDelay?: number;
  /** Top offset for panel and trapezoid (e.g. to clear a toolbar). Default 0. */
  topOffset?: number;
  children: React.ReactNode;
}

export function EdgePanel({
  side,
  width = 260,
  pinned = false,
  onPinChange,
  title,
  headerActions,
  autoShowMs,
  showDelay = 120,
  hideDelay = 400,
  topOffset = 0,
  children,
}: EdgePanelProps): JSX.Element {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [autoShow, setAutoShow] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoShowMs || autoShowMs <= 0) return;
    setAutoShow(true);
    autoHideTimerRef.current = setTimeout(() => setAutoShow(false), autoShowMs);
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [autoShowMs]);

  const handleMouseEnter = useCallback(() => {
    if (pinned) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    hoverTimerRef.current = setTimeout(() => setHovered(true), showDelay);
  }, [pinned, showDelay]);

  const handleMouseLeave = useCallback(() => {
    if (pinned) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHovered(false);
      setAutoShow(false);
    }, hideDelay);
  }, [pinned, hideDelay]);

  const visible = pinned || hovered || autoShow;
  const isLeft = side === 'left';
  const tabColor = 'color-mix(in srgb, var(--text-muted) 30%, transparent)';

  const trapezoidPath = isLeft ? 'M0 0 L0 60 L6 52 L6 8 Z' : 'M6 0 L6 60 L0 52 L0 8 Z';
  const trapezoidPos = isLeft ? 'left-[1px]' : 'right-[1px]';
  const triggerPos = isLeft ? 'left-0' : 'right-0';
  const panelPos = isLeft ? 'left-[1px]' : 'right-[1px]';
  const panelRounded = isLeft ? 'rounded-r-md' : 'rounded-l-md';
  const panelBorder = isLeft ? 'border-y border-r border-subtle' : 'border-y border-l border-subtle';
  const hiddenTransform = isLeft ? '-translate-x-full' : 'translate-x-full';

  const showHeader = title || onPinChange || headerActions;

  return (
    <>
      {!pinned && (
        <svg
          className={`pointer-events-none absolute ${trapezoidPos} z-30`}
          style={{ top: `calc(3rem + ${topOffset}px)` }}
          width="6"
          height="60"
          viewBox="0 0 6 60"
        >
          <path d={trapezoidPath} fill={tabColor} />
        </svg>
      )}

      {!pinned && (
        <div
          className={`absolute ${triggerPos} top-0 z-30 w-2 h-full`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}

      <div
        className={`absolute ${panelPos} z-30 flex flex-col overflow-hidden ${panelRounded} ${panelBorder} bg-surface-panel shadow-lg transition-all duration-200 ${
          visible ? 'translate-x-0 opacity-100' : `${hiddenTransform} opacity-0 pointer-events-none`
        }`}
        style={{ width, top: topOffset, maxHeight: `calc(80% - ${topOffset}px)` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {showHeader && (
          <div className="flex shrink-0 items-center justify-between px-3 py-1.5 border-b border-subtle">
            {title && <span className="text-xs font-medium text-secondary">{title}</span>}
            <div className="ml-auto flex items-center gap-1">
              {headerActions}
              {onPinChange && (
                <Tooltip content={pinned ? t('edgePanel.unpin') : t('edgePanel.pin')}>
                  <button
                    className={`rounded p-0.5 hover:bg-surface-hover ${pinned ? 'text-accent' : 'text-muted hover:text-default'}`}
                    onClick={() => onPinChange(!pinned)}
                  >
                    {pinned ? <PinOff size={12} /> : <Pin size={12} />}
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
