import React from 'react';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tooltipPosition = 'top', children, className = '', ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-transparent text-secondary border-none cursor-pointer transition-all duration-fast hover:enabled:bg-surface-hover hover:enabled:text-default disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        aria-label={label}
        {...props}
      >
        {children}
      </button>
    );

    return <Tooltip content={label} position={tooltipPosition}>{button}</Tooltip>;
  }
);

IconButton.displayName = 'IconButton';
