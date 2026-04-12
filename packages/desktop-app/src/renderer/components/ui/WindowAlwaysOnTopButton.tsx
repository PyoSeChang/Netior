import React, { useEffect, useState } from 'react';
import { PinToggleButton } from './PinToggleButton';

interface WindowAlwaysOnTopButtonProps {
  className?: string;
}

export function WindowAlwaysOnTopButton({
  className = '',
}: WindowAlwaysOnTopButtonProps): JSX.Element {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  useEffect(() => {
    let mounted = true;

    window.electron.window.isAlwaysOnTop().then((value) => {
      if (mounted) setIsAlwaysOnTop(value);
    }).catch(() => {});

    const cleanup = window.electron.window.onAlwaysOnTopChanged((value) => {
      setIsAlwaysOnTop(value);
    });

    return () => {
      mounted = false;
      cleanup();
    };
  }, []);

  return (
    <div className={`flex items-center px-1 ${className}`} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <PinToggleButton
        pinned={isAlwaysOnTop}
        onPinChange={() => window.electron.window.toggleAlwaysOnTop()}
        pinLabel="Always On Top"
        unpinLabel="Disable Always On Top"
        tooltipPosition="bottom"
        className="rounded-md border border-subtle bg-surface-base p-1.5"
      />
    </div>
  );
}
