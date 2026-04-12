import React from 'react';

interface WindowTitleBarProps {
  left: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function WindowTitleBar({
  left,
  center = null,
  right = null,
  className = '',
}: WindowTitleBarProps): JSX.Element {
  return (
    <div
      className={`relative z-[1000] grid h-9 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-subtle bg-surface-base pl-4 text-default ${className}`}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex min-w-0 items-center gap-2">
        {left}
      </div>
      <div className="flex min-w-0 justify-center px-3">
        {center}
      </div>
      <div className="flex min-w-0 justify-end">
        {right}
      </div>
    </div>
  );
}
