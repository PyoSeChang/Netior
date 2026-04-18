import React from 'react';
import { NodeVisual } from '../NodeVisual';
import type { ShapeLayoutProps } from '../types';

/** Content nodes — vertical: icon + label + semanticTypeLabel + updatedAt */
export const PortraitLayout: React.FC<ShapeLayoutProps> = ({
  icon,
  label,
  semanticTypeLabel,
  updatedAt,
  metadata,
}) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-2 py-3 px-3">
    <NodeVisual icon={icon} metadata={metadata} size={24} className="text-[24px] leading-none" />
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="w-full text-center text-sm font-medium text-default whitespace-nowrap">
        {label}
      </span>
      <span className="text-xs text-secondary whitespace-nowrap overflow-hidden text-ellipsis text-center">
        {semanticTypeLabel}
        {updatedAt && <span className="opacity-60"> · {updatedAt}</span>}
      </span>
    </div>
  </div>
);
