import React from 'react';
import { NodeVisual } from '../NodeVisual';
import type { ShapeLayoutProps } from '../types';

/** Asset nodes — icon + label (square card) */
export const SquareLayout: React.FC<ShapeLayoutProps> = ({ icon, label, semanticTypeLabel, metadata }) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-2 py-3 px-3">
    <NodeVisual icon={icon} metadata={metadata} size={24} className="text-[24px] leading-none" />
    <span className="w-full text-center text-xs font-medium text-default whitespace-nowrap">
      {label}
    </span>
  </div>
);
