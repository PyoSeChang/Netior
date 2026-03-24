import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';

interface UnsupportedFallbackProps {
  filePath: string;
  absolutePath: string;
}

export function UnsupportedFallback({ filePath, absolutePath }: UnsupportedFallbackProps): JSX.Element {
  const ext = filePath.split('.').pop() ?? '';

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-base">
      <p className="text-sm text-muted">
        <span className="font-mono text-default">.{ext}</span> files cannot be previewed
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          // Use Electron shell to open externally
          window.electron.fs.readFile(absolutePath).catch(() => {});
        }}
      >
        <ExternalLink size={14} className="mr-1" />
        Open in External App
      </Button>
    </div>
  );
}
