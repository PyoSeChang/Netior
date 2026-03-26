import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

const GAP = 6;
const VIEWPORT_PAD = 8;

export const Tooltip: React.FC<TooltipProps> = ({ content, position = 'top', className = '', children }) => {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  // Calculate position + viewport clamp before paint (no flicker)
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    const anchor = wrapperRef.current;
    if (!visible || !el || !anchor) return;

    const ar = anchor.getBoundingClientRect();
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;

    switch (position) {
      case 'top':
        top = ar.top - GAP - tipH;
        left = ar.left + ar.width / 2 - tipW / 2;
        break;
      case 'bottom':
        top = ar.bottom + GAP;
        left = ar.left + ar.width / 2 - tipW / 2;
        break;
      case 'left':
        top = ar.top + ar.height / 2 - tipH / 2;
        left = ar.left - GAP - tipW;
        break;
      case 'right':
        top = ar.top + ar.height / 2 - tipH / 2;
        left = ar.right + GAP;
        break;
    }

    // Viewport clamp
    left = Math.max(VIEWPORT_PAD, Math.min(left, vw - tipW - VIEWPORT_PAD));
    top = Math.max(VIEWPORT_PAD, Math.min(top, vh - tipH - VIEWPORT_PAD));

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = 'visible';
  }, [visible, position]);

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed whitespace-nowrap px-3 py-1 text-xs text-default bg-surface-card border border-default rounded-md shadow-lg pointer-events-none"
            style={{ top: 0, left: 0, visibility: 'hidden', zIndex: 10100 }}
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
};
