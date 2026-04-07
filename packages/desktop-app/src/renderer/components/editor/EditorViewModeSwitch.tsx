import React from 'react';
import { Maximize2, Maximize, PanelRight, ExternalLink, Minus } from 'lucide-react';
import type { EditorViewMode } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import { useI18n } from '../../hooks/useI18n';
import { Tooltip } from '../ui/Tooltip';
import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';

interface EditorViewModeSwitchProps {
  currentMode: EditorViewMode;
  onModeChange: (mode: EditorViewMode) => void;
  onMinimize?: () => void;
}

interface ModeButtonConfig {
  mode: EditorViewMode;
  icon: typeof Maximize2;
  titleKey: TranslationKey;
  isActive: boolean;
}

export function EditorViewModeSwitch({
  currentMode,
  onModeChange,
  onMinimize,
}: EditorViewModeSwitchProps): JSX.Element {
  const { t, locale } = useI18n();
  const preferredDockMode = useEditorStore((s) => {
    const mainTabs = s.tabs.filter((tab) => tab.hostId === MAIN_HOST_ID);
    const hasFull = mainTabs.some((tab) => tab.viewMode === 'full' && !tab.isMinimized);
    return hasFull ? 'full' : 'side';
  });

  const layoutToggle: { mode: 'side' | 'full'; icon: typeof Maximize; titleKey: TranslationKey } =
    currentMode === 'full'
      ? { mode: 'side', icon: PanelRight, titleKey: 'editor.modeSide' }
      : currentMode === 'side'
        ? { mode: 'full', icon: Maximize, titleKey: 'editor.modeFull' }
        : preferredDockMode === 'full'
          ? { mode: 'full', icon: Maximize, titleKey: 'editor.modeFull' }
          : { mode: 'side', icon: PanelRight, titleKey: 'editor.modeSide' };

  const tabButtons: ModeButtonConfig[] = [
    { mode: 'float', icon: Maximize2, titleKey: 'editor.modeFloat', isActive: currentMode === 'float' },
    { mode: 'detached', icon: ExternalLink, titleKey: 'editor.modeDetached', isActive: currentMode === 'detached' },
  ];
  const paneButtons: ModeButtonConfig[] = [
    { ...layoutToggle, isActive: currentMode === 'side' || currentMode === 'full' },
  ];
  const minimizeTooltip = locale === 'ko' ? '이 편집영역 최소화' : 'Minimize This Pane';

  const renderButton = ({ mode, icon: Icon, titleKey, isActive }: ModeButtonConfig, key: string) => (
    <Tooltip key={key} content={t(titleKey)} position="bottom">
      <button
        className={`rounded p-1 transition-colors ${
          isActive
            ? 'bg-accent text-on-accent'
            : 'text-muted hover:bg-surface-hover hover:text-default'
        }`}
        onClick={() => onModeChange(mode)}
      >
        <Icon size={14} />
      </button>
    </Tooltip>
  );

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {tabButtons.map((button) => renderButton(button, `tab:${button.mode}`))}
      </div>
      <div className="mx-0.5 h-4 border-l border-subtle" />
      <div className="flex items-center gap-0.5">
        {paneButtons.map((button) => renderButton(button, `pane:${button.mode}`))}
        {onMinimize && (
          <Tooltip content={minimizeTooltip} position="bottom">
            <button
              className="rounded p-1 text-muted transition-colors hover:bg-surface-hover hover:text-default"
              onClick={onMinimize}
            >
              <Minus size={14} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
