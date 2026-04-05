import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  isActive?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, isActive, children, className = '', disabled, ...props }, ref) => {
    const baseStyle = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium leading-tight transition-all duration-fast whitespace-nowrap select-none disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-accent text-on-accent hover:enabled:bg-accent-hover',
      secondary: 'bg-surface-card text-default border border-default hover:enabled:bg-surface-hover',
      ghost: 'bg-transparent text-secondary hover:enabled:bg-surface-hover hover:enabled:text-default',
      danger: 'bg-status-error text-white hover:enabled:brightness-110',
    };

    const activeStyles: Record<string, string> = {
      primary: 'bg-accent text-on-accent',
      secondary: 'bg-interactive-selected text-accent border border-accent',
      ghost: 'bg-interactive-selected text-accent',
      danger: 'bg-status-error text-white',
    };

    const sizes = {
      sm: 'px-2.5 py-1 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const cls = [
      baseStyle,
      isActive ? activeStyles[variant] : variants[variant],
      sizes[size],
      className,
    ].filter(Boolean).join(' ');

    return (
      <button ref={ref} className={cls} disabled={disabled || isLoading} {...props}>
        {isLoading && <Loader2 size={14} className="animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
