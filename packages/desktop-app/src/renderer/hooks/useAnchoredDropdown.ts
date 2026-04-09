import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

interface AnchorPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
  ready: boolean;
}

interface AnchorPositionOptions {
  estimatedHeight?: number;
  minWidth?: number;
  gap?: number;
  viewportPadding?: number;
}

export function useAnchoredDropdown<T extends HTMLElement>(
  open: boolean,
  anchorRef: React.RefObject<T>,
  options: AnchorPositionOptions,
  dropdownRef?: React.RefObject<HTMLElement>,
): AnchorPosition {
  const {
    estimatedHeight = 240,
    minWidth = 0,
    gap = 4,
    viewportPadding = 8,
  } = options;
  const [position, setPosition] = useState<AnchorPosition>({
    top: 0,
    left: 0,
    width: minWidth,
    maxHeight: estimatedHeight,
    placement: 'bottom',
    ready: false,
  });

  const updatePosition = useCallback((ready = true) => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const dropdownRect = dropdownRef?.current?.getBoundingClientRect();
    const dropdownHeight = dropdownRect && dropdownRect.height > 0
      ? dropdownRect.height
      : estimatedHeight;
    const width = Math.max(anchorRect.width, minWidth);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - anchorRect.bottom - gap - viewportPadding;
    const spaceAbove = anchorRect.top - gap - viewportPadding;
    const placement: AnchorPosition['placement'] = spaceBelow >= Math.min(dropdownHeight, estimatedHeight) || spaceBelow >= spaceAbove
      ? 'bottom'
      : 'top';
    const availableHeight = Math.max(80, placement === 'bottom' ? spaceBelow : spaceAbove);
    const renderedHeight = Math.min(dropdownHeight, availableHeight);

    const unclampedTop = placement === 'bottom'
      ? anchorRect.bottom + gap
      : anchorRect.top - gap - renderedHeight;
    const unclampedLeft = anchorRect.left;

    const nextPosition = {
      top: Math.min(
        Math.max(unclampedTop, viewportPadding),
        Math.max(viewportPadding, viewportHeight - viewportPadding - renderedHeight),
      ),
      left: Math.min(
        Math.max(unclampedLeft, viewportPadding),
        Math.max(viewportPadding, viewportWidth - viewportPadding - width),
      ),
      width,
      maxHeight: availableHeight,
      placement,
      ready,
    };

    setPosition((current) => (
      current.top === nextPosition.top
        && current.left === nextPosition.left
        && current.width === nextPosition.width
        && current.maxHeight === nextPosition.maxHeight
        && current.placement === nextPosition.placement
        && current.ready === nextPosition.ready
        ? current
        : nextPosition
    ));
  }, [anchorRef, dropdownRef, estimatedHeight, gap, minWidth, viewportPadding]);

  useLayoutEffect(() => {
    setPosition((current) => (
      current.ready || open
        ? { ...current, ready: false }
        : current
    ));
    if (!open) return;

    updatePosition(false);
    const frameId = window.requestAnimationFrame(() => updatePosition(true));
    return () => window.cancelAnimationFrame(frameId);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const commitPosition = () => updatePosition(true);
    const dropdown = dropdownRef?.current;
    const resizeObserver = dropdown ? new ResizeObserver(commitPosition) : null;
    if (dropdown) resizeObserver?.observe(dropdown);

    window.addEventListener('resize', commitPosition);
    window.addEventListener('scroll', commitPosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', commitPosition);
      window.removeEventListener('scroll', commitPosition, true);
    };
  }, [dropdownRef, open, updatePosition]);

  return position;
}
