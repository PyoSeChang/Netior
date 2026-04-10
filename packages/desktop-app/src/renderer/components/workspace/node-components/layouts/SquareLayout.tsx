import React from 'react';
import { resolveIcon } from '../../../../utils/icon-resolver';
import type { ShapeLayoutProps } from '../types';

/** Asset nodes — icon + label (square card) */
export const SquareLayout: React.FC<ShapeLayoutProps> = ({ icon, label, semanticTypeLabel }) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-2 py-3 px-3">
    <span className="text-[24px] leading-none">{resolveIcon(icon)}</span>
    <span className="text-xs font-medium text-default whitespace-nowrap overflow-hidden text-ellipsis text-center">
      {label}
    </span>
  </div>
);
