import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { useI18n } from '../../hooks/useI18n';

interface UnsupportedFallbackProps {
  filePath: string;
  absolutePath: string;
}

export function UnsupportedFallback({ filePath, absolutePath }: UnsupportedFallbackProps): JSX.Element {
  const { t } = useI18n();
  const ext = filePath.split('.').pop() ?? '';

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-base">
      <p className="text-sm text-muted">
        {t('editor.cannotPreview', { ext })}
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
        {t('editor.openExternal')}
      </Button>
    </div>
  );
}
