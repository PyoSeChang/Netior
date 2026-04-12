import React, { useEffect, useState } from 'react';

interface WindowControlsProps {
  className?: string;
}

function MinimizeIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1 5.5H9" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
    </svg>
  );
}

function MaximizeIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function RestoreIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M3.5 1.5H8.5V6.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M1.5 3.5H6.5V8.5H1.5Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3.5 1.5V3.5H1.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 2L8 8M8 2L2 8" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
    </svg>
  );
}

export function WindowControls({ className = '' }: WindowControlsProps): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;

    window.electron.window.isMaximized().then((value) => {
      if (mounted) setIsMaximized(value);
    }).catch(() => {});

    const cleanupMaximized = window.electron.window.onMaximizedChanged((value) => {
      setIsMaximized(value);
    });

    return () => {
      mounted = false;
      cleanupMaximized();
    };
  }, []);

  const baseClassName = 'window-control-button inline-flex h-9 w-[46px] items-center justify-center border-none bg-transparent p-0 text-muted transition-colors';

  return (
    <div className={`window-controls flex shrink-0 items-stretch ${className}`} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        type="button"
        className={baseClassName}
        aria-label="Minimize"
        onClick={() => window.electron.window.minimize()}
      >
        <MinimizeIcon />
      </button>
      <button
        type="button"
        className={baseClassName}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        onClick={() => window.electron.window.maximize()}
      >
        {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
      <button
        type="button"
        className={`${baseClassName} window-control-button-close`}
        aria-label="Close"
        onClick={() => window.electron.window.close()}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
