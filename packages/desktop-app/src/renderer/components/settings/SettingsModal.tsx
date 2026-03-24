import React from 'react';
import { Modal } from '../ui/Modal';
import { useSettingsStore, AVAILABLE_CONCEPTS } from '../../stores/settings-store';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps): JSX.Element {
  const { themeConcept, themeMode, locale, setThemeConcept, setThemeMode, setLocale } =
    useSettingsStore();

  return (
    <Modal open={open} onClose={onClose} title="Settings" width={420}>
      <div className="flex flex-col gap-5">
        {/* Theme Mode */}
        <div>
          <label className="mb-2 block text-xs font-medium text-secondary">Mode</label>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((mode) => (
              <button
                key={mode}
                className={`rounded-md border px-4 py-1.5 text-sm transition-colors ${
                  themeMode === mode
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-subtle text-muted hover:border-default hover:text-default'
                }`}
                onClick={() => setThemeMode(mode)}
              >
                {mode === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Concept */}
        <div>
          <label className="mb-2 block text-xs font-medium text-secondary">Theme</label>
          <div className="grid grid-cols-4 gap-2">
            {AVAILABLE_CONCEPTS.map((concept) => (
              <button
                key={concept}
                className={`rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${
                  themeConcept === concept
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-subtle text-muted hover:border-default hover:text-default'
                }`}
                onClick={() => setThemeConcept(concept)}
              >
                {concept}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="mb-2 block text-xs font-medium text-secondary">Language</label>
          <div className="flex gap-2">
            {([
              { key: 'ko' as const, label: '한국어' },
              { key: 'en' as const, label: 'English' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                className={`rounded-md border px-4 py-1.5 text-sm transition-colors ${
                  locale === key
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-subtle text-muted hover:border-default hover:text-default'
                }`}
                onClick={() => setLocale(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
