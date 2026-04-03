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
  description: string;
  keybinding: string;
  scope: ShortcutScope;
  owner: ShortcutOwner;
  priority: ShortcutPriority;
  implemented: boolean;
  when?: string;
}
