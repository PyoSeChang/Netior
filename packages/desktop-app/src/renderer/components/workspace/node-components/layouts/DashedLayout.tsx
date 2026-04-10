import React from 'react';
import { resolveIcon } from '../../../../utils/icon-resolver';
import type { ShapeLayoutProps } from '../types';

/** Template nodes — icon + label + field count */
export const DashedLayout: React.FC<ShapeLayoutProps> = ({
  icon,
  label,
  semanticTypeLabel,
  content,
}) => {
  const fieldCount = Array.isArray(content?.fields) ? content.fields.length : 0;

  return (
    <div className="w-full h-full flex flex-row items-center gap-2 py-2 px-3">
      <span className="text-[20px] leading-none shrink-0">{resolveIcon(icon)}</span>
      <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
        <span className="text-sm font-medium text-default whitespace-nowrap overflow-hidden text-ellipsis">
          {label}
        </span>
        <span className="text-xs text-secondary whitespace-nowrap overflow-hidden text-ellipsis">
          {semanticTypeLabel}
          {fieldCount > 0 && <span className="opacity-60"> · {fieldCount}</span>}
        </span>
      </div>
    </div>
  );
};
