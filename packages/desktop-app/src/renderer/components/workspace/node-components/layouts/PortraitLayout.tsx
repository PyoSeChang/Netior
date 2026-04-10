import React from 'react';
import { resolveIcon } from '../../../../utils/icon-resolver';
import type { ShapeLayoutProps } from '../types';

/** Content nodes — vertical: icon + label + semanticTypeLabel + updatedAt */
export const PortraitLayout: React.FC<ShapeLayoutProps> = ({
  icon,
  label,
  semanticTypeLabel,
  updatedAt,
}) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-2 py-3 px-3">
    <span className="text-[24px] leading-none">{resolveIcon(icon)}</span>
    <div className="flex flex-col items-center gap-0.5 min-w-0 overflow-hidden">
      <span className="text-sm font-medium text-default whitespace-nowrap overflow-hidden text-ellipsis text-center">
        {label}
      </span>
      <span className="text-xs text-secondary whitespace-nowrap overflow-hidden text-ellipsis text-center">
        {semanticTypeLabel}
        {updatedAt && <span className="opacity-60"> · {updatedAt}</span>}
      </span>
    </div>
  </div>
);
