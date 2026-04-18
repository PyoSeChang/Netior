import React from 'react';
import { NodeVisual } from '../NodeVisual';
import type { ShapeLayoutProps } from '../types';

/** Template nodes — icon + label + field count */
export const DashedLayout: React.FC<ShapeLayoutProps> = ({
  icon,
  label,
  semanticTypeLabel,
  content,
  metadata,
}) => {
  const fieldCount = Array.isArray(content?.fields) ? content.fields.length : 0;

  return (
    <div className="w-full h-full flex flex-row items-center gap-2 py-2 px-3">
      <NodeVisual icon={icon} metadata={metadata} size={20} className="text-[20px] leading-none shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-default whitespace-nowrap">
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
