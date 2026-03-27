import React from 'react';
import { Maximize2, Maximize, PanelRight, ExternalLink, Minus } from 'lucide-react';
import type { EditorViewMode } from '@moc/shared/types';
import type { TranslationKey } from '@moc/shared/i18n';
import { useI18n } from '../../hooks/useI18n';
import { Tooltip } from '../ui/Tooltip';

interface EditorViewModeSwitchProps {
  currentMode: EditorViewMode;
  onModeChange: (mode: EditorViewMode) => void;
  onMinimize?: () => void;
}

const MODE_BUTTONS: { mode: EditorViewMode; icon: typeof Maximize2; titleKey: TranslationKey }[] = [
  { mode: 'float', icon: Maximize2, titleKey: 'editor.modeFloat' },
  { mode: 'full', icon: Maximize, titleKey: 'editor.modeFull' },
  { mode: 'side', icon: PanelRight, titleKey: 'editor.modeSide' },
  { mode: 'detached', icon: ExternalLink, titleKey: 'editor.modeDetached' },
];

export function EditorViewModeSwitch({
  currentMode,
  onModeChange,
  onMinimize,
}: EditorViewModeSwitchProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-0.5">
      {MODE_BUTTONS.map(({ mode, icon: Icon, titleKey }) => (
        <Tooltip key={mode} content={t(titleKey)} position="bottom">
          <button
            className={`rounded p-1 transition-colors ${
              currentMode === mode
                ? 'bg-accent text-on-accent'
                : 'text-muted hover:bg-surface-hover hover:text-default'
            }`}
            onClick={() => onModeChange(mode)}
          >
            <Icon size={14} />
          </button>
        </Tooltip>
      ))}
      {onMinimize && (
        <Tooltip content={t('common.minimize')} position="bottom">
          <button
            className="rounded p-1 text-muted transition-colors hover:bg-surface-hover hover:text-default"
            onClick={onMinimize}
          >
            <Minus size={14} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
