import React from 'react';
import { resolveIcon } from '../../../../utils/icon-resolver';
import type { ShapeLayoutProps } from '../types';

/** Container / span nodes — icon + label + semanticTypeLabel (wide card) */
export const WideLayout: React.FC<ShapeLayoutProps> = ({ icon, label, semanticTypeLabel }) => (
  <div className="w-full h-full flex flex-row items-center gap-3 py-3 px-4">
    <span className="text-[24px] leading-none shrink-0">{resolveIcon(icon)}</span>
    <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
      <span className="text-base font-medium text-default whitespace-nowrap overflow-hidden text-ellipsis">
        {label}
      </span>
      <span className="text-sm text-secondary whitespace-nowrap overflow-hidden text-ellipsis">
        {semanticTypeLabel}
      </span>
    </div>
  </div>
);
