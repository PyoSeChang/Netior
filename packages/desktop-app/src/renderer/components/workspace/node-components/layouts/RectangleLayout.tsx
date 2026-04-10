import React from 'react';
import { resolveIcon } from '../../../../utils/icon-resolver';
import type { ShapeLayoutProps } from '../types';

/** Default node card: icon + label + semantic type. */
export const RectangleLayout: React.FC<ShapeLayoutProps> = ({
  icon,
  label,
  semanticTypeLabel,
  updatedAt,
}) => (
  <div className="w-full h-full flex flex-row items-center gap-2 py-2 px-3">
    <span className="text-[20px] leading-none shrink-0">{resolveIcon(icon)}</span>
    <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
      <span className="text-sm font-medium text-default whitespace-nowrap overflow-hidden text-ellipsis">
        {label}
      </span>
      <span className="text-xs text-secondary whitespace-nowrap overflow-hidden text-ellipsis">
        {semanticTypeLabel}
        {updatedAt && <span className="opacity-60"> - {updatedAt}</span>}
      </span>
    </div>
  </div>
);
