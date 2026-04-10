/**
 * NodeCardDefault
 *
 * Default node rendering component with shape-based layout.
 * Shape determines both the outline (border, clip-path) and the internal layout.
 * Internal rendering is delegated to shape-specific layout components in ./layouts/.
 */

import React, { useCallback, useMemo } from 'react';
import type { NodeComponentProps } from './types';
import type { NodeShape } from './types';
import type { NodeResizeDirection } from './types';
import { getShapeLayout } from './layouts';

// --- Gear clip-path (6-tooth cog) ---
const GEAR_CLIP_PATH =
  'polygon(50% 0%, 61% 4%, 65% 0%, 75% 10%, 82% 7%, 85% 19%, 93% 21%, 90% 33%, 97% 40%, 90% 50%, 97% 60%, 90% 67%, 93% 79%, 85% 81%, 82% 93%, 75% 90%, 65% 100%, 61% 96%, 50% 100%, 39% 96%, 35% 100%, 25% 90%, 18% 93%, 15% 81%, 7% 79%, 10% 67%, 3% 60%, 10% 50%, 3% 40%, 10% 33%, 7% 21%, 15% 19%, 18% 7%, 25% 10%, 35% 0%, 39% 4%)';

/**
 * shape → outline CSS class
 */
function getShapeOutline(shape: NodeShape): string {
  switch (shape) {
    case 'stadium':
    case 'circle':
      return 'rounded-full';
    case 'dashed':
      return 'rounded-lg border-dashed border-2';
    case 'group':
    case 'hierarchy':
      return 'rounded-md';
    case 'gear':
      return '';
    case 'portrait':
    case 'wide':
    case 'rectangle':
    case 'square':
    default:
      return 'rounded-lg';
  }
}

export const NodeCardDefault: React.FC<NodeComponentProps> = ({
  id,
  x,
  y,
  label,
  updatedAt,
  icon,
  semanticTypeLabel,
  selected,
  highlighted,
  mode = 'browse',
  width = 160,
  height = 60,
  shape = 'rectangle',
  content,
  metadata,
  portalChips,
  onPortalChipClick,
  resizable = false,
  onResizeStart,
  collapsed = false,
  onToggleCollapse,
  onClick,
  onDoubleClick,
  onDragStart,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
}) => {
  const hasPortalChips = !!portalChips && portalChips.length > 0;
  const portalChipStripHeight = hasPortalChips ? 32 : 0;
  const resizeHandles: Array<{
    direction: NodeResizeDirection;
    cursor: string;
    style: React.CSSProperties;
  }> = [
    { direction: 'n', cursor: 'ns-resize', style: { top: -5, left: '50%', transform: 'translateX(-50%)' } },
    { direction: 's', cursor: 'ns-resize', style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' } },
    { direction: 'e', cursor: 'ew-resize', style: { right: -5, top: '50%', transform: 'translateY(-50%)' } },
    { direction: 'w', cursor: 'ew-resize', style: { left: -5, top: '50%', transform: 'translateY(-50%)' } },
    { direction: 'ne', cursor: 'nesw-resize', style: { right: -5, top: -5 } },
    { direction: 'nw', cursor: 'nwse-resize', style: { left: -5, top: -5 } },
    { direction: 'se', cursor: 'nwse-resize', style: { right: -5, bottom: -5 } },
    { direction: 'sw', cursor: 'nesw-resize', style: { left: -5, bottom: -5 } },
  ];

  // --- Event handlers ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      onDragStart(id, e.clientX, e.clientY);
    },
    [id, onDragStart],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick(id, e);
    },
    [id, onClick],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDoubleClick(id);
    },
    [id, onDoubleClick],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.('node', e.clientX, e.clientY, id);
    },
    [id, onContextMenu],
  );

  const isGear = shape === 'gear';
  const isContainerShape = shape === 'group' || shape === 'hierarchy';
  const outlineClass = getShapeOutline(shape);

  const cardClassName = useMemo(() => {
    const parts = [
      isContainerShape ? 'bg-transparent shadow-none' : 'bg-surface-card shadow-sm',
      'transition-[border-color,box-shadow] duration-fast',
      isContainerShape ? 'select-none overflow-visible' : 'select-none overflow-hidden',
    ];

    if (isGear) {
      // gear uses clip-path, no border
    } else {
      if (isContainerShape && collapsed) {
        parts.push('border border-transparent');
      } else if (shape === 'hierarchy') {
        parts.push('border-2 border-strong');
      } else {
        parts.push(shape === 'group' ? 'border-2 border-strong' : 'border border-subtle');
      }
      if (isContainerShape && !collapsed) {
        parts.push('hover:border-strong');
      } else if (!isContainerShape) {
        parts.push('hover:border-default hover:shadow-md');
      }
      parts.push(outlineClass);
    }

    if (selected && !(isContainerShape && collapsed)) {
      parts.push(isContainerShape ? 'border-accent shadow-[0_0_0_1px_var(--accent)]' : 'border-accent shadow-[0_0_0_2px_var(--accent-muted)]');
    }
    if (highlighted && !(isContainerShape && collapsed)) {
      parts.push('border-status-warning shadow-[0_0_0_2px_color-mix(in_srgb,var(--status-warning)_30%,transparent)]');
    }

    return parts.filter(Boolean).join(' ');
  }, [shape, isContainerShape, isGear, outlineClass, selected, highlighted, collapsed]);

  const cardStyle: React.CSSProperties = {
    width,
    height,
  };
  if (isGear) {
    cardStyle.clipPath = GEAR_CLIP_PATH;
  }

  const Layout = getShapeLayout(shape);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        transform: `translate(${x - width / 2}px, ${y - height / 2}px)`,
        cursor: mode === 'edit' ? 'move' : 'pointer',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave ? () => onMouseLeave() : undefined}
    >
      {/* Card body */}
      <div className={cardClassName} style={cardStyle}>
        <div style={{ height: hasPortalChips ? Math.max(height - portalChipStripHeight, 0) : height }}>
          <Layout
            label={label}
            icon={icon}
            semanticTypeLabel={semanticTypeLabel}
            collapsed={collapsed}
            canToggleCollapse={!!(isContainerShape && onToggleCollapse)}
            onToggleCollapse={onToggleCollapse ? () => onToggleCollapse(id) : undefined}
            updatedAt={updatedAt}
            content={content}
            metadata={metadata}
          />
        </div>
        {hasPortalChips && (
          <div className="flex h-8 items-center gap-1 overflow-x-auto border-t border-subtle px-2 py-1">
            {portalChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`shrink-0 rounded border px-2 py-0.5 text-[11px] ${
                  mode === 'browse'
                    ? 'border-default bg-accent-muted text-accent hover:border-accent'
                    : 'border-subtle bg-surface-hover text-secondary'
                }`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (mode !== 'browse') return;
                  onPortalChipClick?.(id, chip.id, chip.networkId);
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'edit' && selected && resizable && onResizeStart && (
        <>
          {resizeHandles.map((handle) => (
            <button
              key={handle.direction}
              type="button"
              aria-label={`Resize ${handle.direction}`}
              style={{
                position: 'absolute',
                width: 10,
                height: 10,
                borderRadius: 3,
                border: '1px solid var(--accent)',
                background: 'var(--surface-base)',
                cursor: handle.cursor,
                zIndex: 3,
                ...handle.style,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onResizeStart(id, handle.direction, e.clientX, e.clientY);
              }}
            />
          ))}
        </>
      )}

    </div>
  );
};
