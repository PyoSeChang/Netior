import React from 'react';
import { NodeVisual } from '../NodeVisual';
import type { ShapeLayoutProps } from '../types';

/** Container / span nodes — icon + label + semanticTypeLabel (wide card) */
export const WideLayout: React.FC<ShapeLayoutProps> = ({ icon, label, semanticTypeLabel, metadata }) => (
  <div className="w-full h-full flex flex-row items-center gap-3 py-3 px-4">
    <NodeVisual icon={icon} metadata={metadata} size={24} imageSize={52} className="text-[24px] leading-none shrink-0" />
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-base font-medium text-default whitespace-nowrap">
        {label}
      </span>
      <span className="text-sm text-secondary whitespace-nowrap overflow-hidden text-ellipsis">
        {semanticTypeLabel}
      </span>
    </div>
  </div>
);
