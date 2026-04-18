import React from 'react';
import { NodeVisual } from '../NodeVisual';
import type { ShapeLayoutProps } from '../types';

export const IconOnlyLayout: React.FC<ShapeLayoutProps> = ({ icon, metadata }) => (
  <div className="w-full h-full flex items-center justify-center">
    <NodeVisual icon={icon} metadata={metadata} size={24} className="text-[24px] leading-none" />
  </div>
);
