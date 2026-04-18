import React from 'react';
import { NodeVisual } from '../NodeVisual';
import type { ShapeLayoutProps } from '../types';

/** Entity nodes — horizontal compact: icon + label + semanticTypeLabel */
export const StadiumLayout: React.FC<ShapeLayoutProps> = ({ icon, label, semanticTypeLabel, metadata }) => (
  <div className="w-full h-full flex flex-row items-center gap-2 py-2 px-3">
    <NodeVisual icon={icon} metadata={metadata} size={20} imageSize={44} className="text-[20px] leading-none shrink-0" />
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-sm font-medium text-default whitespace-nowrap">
        {label}
      </span>
      <span className="text-xs text-secondary whitespace-nowrap overflow-hidden text-ellipsis">
        {semanticTypeLabel}
      </span>
    </div>
  </div>
);
