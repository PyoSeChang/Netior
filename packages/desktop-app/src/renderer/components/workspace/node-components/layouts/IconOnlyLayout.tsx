import React from 'react';
import { resolveIcon } from '../../../../utils/icon-resolver';
import type { ShapeLayoutProps } from '../types';

export const IconOnlyLayout: React.FC<ShapeLayoutProps> = ({ icon }) => (
  <div className="w-full h-full flex items-center justify-center">
    <span className="text-[24px] leading-none">{resolveIcon(icon)}</span>
  </div>
);
