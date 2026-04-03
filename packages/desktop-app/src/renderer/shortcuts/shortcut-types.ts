import type { TranslationKey } from '@netior/shared/i18n';

export type ShortcutScope =
  | 'global'
  | 'canvas'
  | 'terminal'
  | 'fileTree'
  | 'narreChat'
  | 'narreMentionPicker'
  | 'narreSlashPicker'
  | 'settings'
  | 'modal';

export type ShortcutOwner =
  | 'globalDispatcher'
  | 'canvasContext'
  | 'terminalEditor'
  | 'fileTree'
  | 'narreChat'
  | 'narreMentionPicker'
  | 'narreSlashPicker'
  | 'settingsModal';

export type ShortcutPriority = 'local' | 'context' | 'global';

export interface ShortcutDefinition {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  keybinding: string;
  scope: ShortcutScope;
  owner: ShortcutOwner;
  priority: ShortcutPriority;
  implemented: boolean;
  whenKey?: TranslationKey;
}
