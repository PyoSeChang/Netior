import React from 'react';
import { Pin, PinOff } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface PinToggleButtonProps {
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
  pinLabel: string;
  unpinLabel: string;
  className?: string;
  iconSize?: number;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export function PinToggleButton({
  pinned,
  onPinChange,
  pinLabel,
  unpinLabel,
  className = '',
  iconSize = 12,
  tooltipPosition = 'top',
}: PinToggleButtonProps): JSX.Element {
  const label = pinned ? unpinLabel : pinLabel;

  return (
    <Tooltip content={label} position={tooltipPosition}>
      <button
        type="button"
        className={`rounded p-0.5 hover:bg-surface-hover ${pinned ? 'text-accent' : 'text-muted hover:text-default'} ${className}`}
        aria-label={label}
        aria-pressed={pinned}
        onClick={() => onPinChange(!pinned)}
      >
        {pinned ? <PinOff size={iconSize} /> : <Pin size={iconSize} />}
      </button>
    </Tooltip>
  );
}
