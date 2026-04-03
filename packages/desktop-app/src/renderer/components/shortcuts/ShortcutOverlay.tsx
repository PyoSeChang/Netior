import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Select } from '../ui/Select';
import { SHORTCUT_REGISTRY } from '../../shortcuts/shortcut-registry';
import type { ShortcutDefinition, ShortcutScope } from '../../shortcuts/shortcut-types';

interface ShortcutOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  key: string;
  scopes: ShortcutScope[];
  labelKey:
    | 'shortcuts.sections.app'
    | 'shortcuts.sections.canvas'
    | 'shortcuts.sections.fileTree'
    | 'shortcuts.sections.terminal'
    | 'shortcuts.sections.narre'
    | 'shortcuts.sections.narreMentionPicker'
    | 'shortcuts.sections.narreSlashPicker'
    | 'shortcuts.sections.settings'
    | 'shortcuts.sections.modal';
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  { key: 'global', scopes: ['global'], labelKey: 'shortcuts.sections.app' },
  { key: 'canvas', scopes: ['canvas'], labelKey: 'shortcuts.sections.canvas' },
  { key: 'fileTree', scopes: ['fileTree'], labelKey: 'shortcuts.sections.fileTree' },
  { key: 'terminal', scopes: ['terminal'], labelKey: 'shortcuts.sections.terminal' },
  {
    key: 'narre',
    scopes: ['narreChat', 'narreMentionPicker', 'narreSlashPicker'],
    labelKey: 'shortcuts.sections.narre',
  },
  { key: 'settings', scopes: ['settings'], labelKey: 'shortcuts.sections.settings' },
  { key: 'modal', scopes: ['modal'], labelKey: 'shortcuts.sections.modal' },
];

type SearchMode = 'all' | 'category' | 'keybinding' | 'name' | 'description';

function ShortcutRow({
  shortcut,
  t,
}: {
  shortcut: ShortcutDefinition;
  t: ReturnType<typeof useI18n>['t'];
}): JSX.Element {
  const detailText = shortcut.whenKey
    ? `${t(shortcut.descriptionKey)} · ${t(shortcut.whenKey)}`
    : t(shortcut.descriptionKey);

  return (
    <div
      data-shortcut-id={shortcut.id}
      className="grid grid-cols-[minmax(0,1fr)_150px] gap-3 border-t border-subtle px-4 py-2 first:border-t-0"
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-5 text-default">{t(shortcut.labelKey)}</div>
        <div className="text-[11px] leading-4 text-secondary">{detailText}</div>
      </div>
      <div className="flex items-start justify-end pt-0.5">
        <kbd className="rounded-md border border-default bg-surface-panel px-2 py-0.5 text-[11px] font-medium text-secondary">
          {shortcut.keybinding}
        </kbd>
      </div>
    </div>
  );
}

export function ShortcutOverlay({ open, onClose }: ShortcutOverlayProps): JSX.Element | null {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('all');
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEsc);
    setTimeout(() => searchRef.current?.focus(), 100);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  const sectionEntries = SHORTCUT_GROUPS
    .map((group) => ({
      ...group,
      label: t(group.labelKey),
      shortcuts: SHORTCUT_REGISTRY.filter(
        (shortcut) => group.scopes.includes(shortcut.scope) && shortcut.implemented,
      ),
    }))
    .filter((group) => group.shortcuts.length > 0);

  const matchesSearch = (shortcut: ShortcutDefinition, sectionLabel: string): boolean => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.trim().toLowerCase();
    const targets = {
      category: sectionLabel.toLowerCase(),
      keybinding: shortcut.keybinding.toLowerCase(),
      name: t(shortcut.labelKey).toLowerCase(),
      description: t(shortcut.descriptionKey).toLowerCase(),
    };

    if (searchMode === 'all') {
      return Object.values(targets).some((value) => value.includes(query));
    }

    return targets[searchMode].includes(query);
  };

  const filteredSections = sectionEntries
    .map((section) => ({
      ...section,
      shortcuts: section.shortcuts.filter((shortcut) => matchesSearch(shortcut, section.label)),
    }))
    .filter((section) => section.shortcuts.length > 0);

  const visibleSections = filteredSections;

  const scrollToTarget = (selector: string): void => {
    const node = contentRef.current?.querySelector<HTMLElement>(selector);
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const searchModeOptions = [
    { value: 'all', label: t('shortcuts.searchModes.all') },
    { value: 'category', label: t('shortcuts.searchModes.category') },
    { value: 'keybinding', label: t('shortcuts.searchModes.keybinding') },
    { value: 'name', label: t('shortcuts.searchModes.name') },
    { value: 'description', label: t('shortcuts.searchModes.description') },
  ];

  if (!open) return null;

  return (
    createPortal(
      <div className="fixed inset-0 flex animate-in fade-in duration-200" style={{ zIndex: 10000 }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative z-10 m-auto flex h-[85vh] w-[min(94vw,1080px)] overflow-hidden rounded-xl border border-subtle bg-surface-modal shadow-2xl ring-1 ring-black/10 animate-in zoom-in-95 duration-200">
          <div className="flex w-72 shrink-0 flex-col border-r border-subtle bg-surface-panel">
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {sectionEntries.map((section) => {
                const resultSection = filteredSections.find((item) => item.key === section.key);
                const resultCount = resultSection?.shortcuts.length ?? 0;

                return (
                  <div key={section.key} className="mb-2">
                    <button
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-secondary transition-colors hover:bg-surface-hover hover:text-default"
                      onClick={() => scrollToTarget(`[data-section="${section.key}"]`)}
                    >
                      <span>{section.label}</span>
                      <span className="rounded bg-surface-base px-1.5 py-0.5 text-[11px] text-muted">
                        {searchQuery.trim() ? resultCount : section.shortcuts.length}
                      </span>
                    </button>

                    <div className="ml-5 mt-1 flex flex-col border-l border-subtle pl-3">
                      {section.shortcuts.map((shortcut) => (
                        <button
                          key={shortcut.id}
                          className="py-0.5 text-left text-xs text-secondary transition-colors hover:text-default"
                          onClick={() => scrollToTarget(`[data-shortcut-id="${shortcut.id}"]`)}
                        >
                          {t(shortcut.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="border-b border-subtle px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-default">{t('shortcuts.overlay.title')}</h2>
                  <p className="mt-1 text-xs text-secondary">{t('shortcuts.overlay.summaryBody')}</p>
                </div>
                <button
                  className="rounded-md p-1 text-muted transition-colors hover:bg-surface-hover hover:text-default"
                  onClick={onClose}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_220px] gap-3">
                <div className="flex items-center gap-2 rounded-md border border-subtle bg-surface-base px-3 py-2">
                  <Search size={14} className="shrink-0 text-muted" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t('shortcuts.overlay.searchPlaceholder')}
                    className="w-full bg-transparent text-sm text-default outline-none placeholder:text-muted"
                  />
                </div>
                <Select
                  options={searchModeOptions}
                  value={searchMode}
                  onChange={(event) => setSearchMode(event.target.value as SearchMode)}
                  selectSize="sm"
                />
              </div>
            </div>

            <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5">
              {visibleSections.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-muted">
                  <Search size={32} className="mb-3 opacity-40" />
                  <p className="text-sm">{t('shortcuts.overlay.noResults')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {visibleSections.map((section) => (
                    <section
                      key={section.key}
                      data-section={section.key}
                      className="overflow-hidden rounded-xl border border-subtle bg-surface-base"
                    >
                      <div className="flex items-center justify-between border-b border-subtle bg-surface-panel px-4 py-2.5">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
                            {section.label}
                          </h3>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {t('shortcuts.overlay.sectionCount', { count: section.shortcuts.length })}
                          </p>
                        </div>
                      </div>
                      <div>
                        {section.shortcuts.map((shortcut) => (
                          <ShortcutRow key={shortcut.id} shortcut={shortcut} t={t} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
