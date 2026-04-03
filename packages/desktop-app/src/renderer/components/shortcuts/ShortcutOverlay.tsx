import React from 'react';
import { Modal } from '../ui/Modal';
import { SHORTCUT_REGISTRY } from '../../shortcuts/shortcut-registry';
import type { ShortcutDefinition, ShortcutScope } from '../../shortcuts/shortcut-types';

interface ShortcutOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  scope: ShortcutScope;
  label: string;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  { scope: 'global', label: 'App' },
  { scope: 'canvas', label: 'Canvas' },
  { scope: 'fileTree', label: 'File Tree' },
  { scope: 'terminal', label: 'Terminal' },
  { scope: 'narreChat', label: 'Narre' },
  { scope: 'narreMentionPicker', label: 'Narre Mention Picker' },
  { scope: 'narreSlashPicker', label: 'Narre Slash Picker' },
  { scope: 'settings', label: 'Settings' },
  { scope: 'modal', label: 'Modal' },
];

function ShortcutRow({ shortcut }: { shortcut: ShortcutDefinition }): JSX.Element {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-4 border-t border-subtle px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-default">{shortcut.description}</div>
        {shortcut.when && <div className="mt-1 text-xs text-muted">{shortcut.when}</div>}
      </div>
      <div className="flex items-start justify-end">
        <kbd className="rounded-md border border-default bg-surface-panel px-2.5 py-1 text-xs font-medium text-secondary">
          {shortcut.keybinding}
        </kbd>
      </div>
    </div>
  );
}

export function ShortcutOverlay({ open, onClose }: ShortcutOverlayProps): JSX.Element | null {
  const sections = SHORTCUT_GROUPS
    .map((group) => ({
      ...group,
      shortcuts: SHORTCUT_REGISTRY.filter((shortcut) => shortcut.scope === group.scope && shortcut.implemented),
    }))
    .filter((group) => group.shortcuts.length > 0);

  return (
    <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" width="min(92vw, 900px)">
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border border-subtle bg-surface-panel px-4 py-3">
          <div>
            <div className="text-sm font-medium text-default">Registry-backed shortcut overview</div>
            <div className="mt-1 text-xs text-muted">
              Local widgets override context shortcuts, and context shortcuts override global shortcuts.
            </div>
          </div>
          <kbd className="rounded-md border border-default bg-surface-base px-2.5 py-1 text-xs font-medium text-secondary">
            Ctrl/Cmd+/
          </kbd>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          {sections.map((section) => (
            <section key={section.scope} className="overflow-hidden rounded-xl border border-subtle bg-surface-base">
              <div className="border-b border-subtle bg-surface-panel px-4 py-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
                  {section.label}
                </h3>
              </div>
              <div>
                {section.shortcuts.map((shortcut) => (
                  <ShortcutRow key={shortcut.id} shortcut={shortcut} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
