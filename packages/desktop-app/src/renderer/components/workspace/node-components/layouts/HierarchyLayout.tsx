import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { NodeVisual } from '../NodeVisual';
import type { ShapeLayoutProps } from '../types';

export const HierarchyLayout: React.FC<ShapeLayoutProps> = ({
  icon,
  label,
  semanticTypeLabel,
  collapsed,
  canToggleCollapse,
  onToggleCollapse,
  metadata,
}) => {
  const childCount = typeof metadata?.childCount === 'number' ? metadata.childCount : 0;
  const portalCount = typeof metadata?.portalCount === 'number' ? metadata.portalCount : 0;

  return (
    <div className="flex h-full w-full flex-col gap-2 px-3 py-2">
      <div className="mx-auto flex w-full max-w-[220px] flex-col gap-1 rounded-md border border-default bg-surface-card px-3 py-2 shadow-sm">
        <div className="flex w-full min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <NodeVisual icon={icon} metadata={metadata} size={16} imageSize={28} className="shrink-0 text-[16px] leading-none text-accent" />
            <span className="truncate text-sm font-medium text-default">{label}</span>
          </div>
          {canToggleCollapse && onToggleCollapse && (
            <button
              type="button"
              aria-label={collapsed ? 'Expand container' : 'Collapse container'}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-default bg-surface-base text-[10px] text-secondary hover:border-strong hover:text-default"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleCollapse();
              }}
            >
              {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-secondary">
          <span className="inline-flex h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          <span className="truncate">{semanticTypeLabel}</span>
        </div>
      </div>
      {collapsed ? (
        <div className="mt-auto flex items-center gap-2 text-[11px] text-secondary">
          <span>{childCount} items</span>
          {portalCount > 0 && <span>{portalCount} portals</span>}
        </div>
      ) : (
        <>
          <div className="pointer-events-none mx-auto h-4 w-px bg-border-subtle" aria-hidden="true" />
          <div className="pointer-events-none mt-auto h-px w-full bg-border-subtle" aria-hidden="true" />
        </>
      )}
    </div>
  );
};
