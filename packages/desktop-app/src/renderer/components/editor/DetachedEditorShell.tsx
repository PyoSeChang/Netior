import React, { useMemo } from 'react';
import { X, Minus, Maximize2 } from 'lucide-react';
import type { EditorTab, EditorTabType, EditorViewMode } from '@moc/shared/types';
import { EditorContent } from './EditorContent';
import { EditorViewModeSwitch } from './EditorViewModeSwitch';
import { IconButton } from '../ui/IconButton';
import { useI18n } from '../../hooks/useI18n';

interface DetachedEditorShellProps {
  tabId: string;
  title: string;
}

export function DetachedEditorShell({ tabId, title }: DetachedEditorShellProps): JSX.Element {
  const { t } = useI18n();

  const tab = useMemo<EditorTab>(() => {
    const colonIdx = tabId.indexOf(':');
    const type = (colonIdx > 0 ? tabId.slice(0, colonIdx) : 'file') as EditorTabType;
    const targetId = colonIdx > 0 ? tabId.slice(colonIdx + 1) : tabId;

    return {
      id: tabId,
      type,
      targetId,
      title,
      viewMode: 'detached',
      floatRect: { x: 0, y: 0, width: 0, height: 0 },
      isMinimized: false,
      sideSplitRatio: 0.5,
      isDirty: false,
      activeFilePath: null,
    };
  }, [tabId, title]);

  const handleModeChange = (mode: EditorViewMode) => {
    if (mode === 'detached') return;
    window.electron.editor.reattach(tabId, mode);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-surface-panel">
      {/* Title bar — matches FloatWindow header */}
      <div
        className="flex shrink-0 items-center gap-1 border-b border-subtle bg-surface-card px-2 py-1.5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="flex-1 truncate text-xs font-medium text-default">
          {title}
          {tab.isDirty && <span className="ml-1 text-accent">*</span>}
        </span>

        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center">
          <EditorViewModeSwitch
            currentMode="detached"
            onModeChange={handleModeChange}
          />

          <IconButton
            label={t('common.minimize')}
            className="w-7 h-7"
            onClick={() => window.electron.window.minimize()}
            tooltipPosition="bottom"
          >
            <Minus size={14} />
          </IconButton>
          <IconButton
            label={t('common.maximize')}
            className="w-7 h-7"
            onClick={() => window.electron.window.maximize()}
            tooltipPosition="bottom"
          >
            <Maximize2 size={14} />
          </IconButton>
          <IconButton
            label={t('common.close')}
            className="w-7 h-7"
            onClick={() => window.electron.window.close()}
            tooltipPosition="bottom"
          >
            <X size={14} />
          </IconButton>
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-hidden">
        <EditorContent tab={tab} />
      </div>
    </div>
  );
}
