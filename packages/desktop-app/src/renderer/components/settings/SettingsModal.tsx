import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Palette, Globe, Bell } from 'lucide-react';
import { useSettingsStore, AVAILABLE_CONCEPTS } from '../../stores/settings-store';
import { useI18n } from '../../hooks/useI18n';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface CategoryItem {
  key: string;
  icon: React.ElementType;
  label: string;
  anchors: string[];
}

export function SettingsModal({ open, onClose }: SettingsModalProps): JSX.Element | null {
  const { t } = useI18n();
  const {
    themeConcept,
    themeMode,
    locale,
    detachedAgentToastMode,
    setThemeConcept,
    setThemeMode,
    setLocale,
    setDetachedAgentToastMode,
  } = useSettingsStore();

  const [activeCategory, setActiveCategory] = useState('appearance');
  const [searchQuery, setSearchQuery] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const categories: CategoryItem[] = [
    {
      key: 'appearance',
      icon: Palette,
      label: t('settings.categoryAppearance'),
      anchors: [t('settings.mode'), t('settings.theme')],
    },
    {
      key: 'language',
      icon: Globe,
      label: t('settings.categoryLanguage'),
      anchors: [t('settings.language')],
    },
    {
      key: 'notifications',
      icon: Bell,
      label: 'Notifications',
      anchors: ['Detached Agent Toasts'],
    },
  ];

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEsc);
    setSearchQuery('');
    setActiveCategory('appearance');
    setTimeout(() => searchRef.current?.focus(), 100);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, handleEsc]);

  const scrollToSection = (sectionId: string) => {
    const el = contentRef.current?.querySelector(`[data-section="${sectionId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCategoryClick = (key: string) => {
    setActiveCategory(key);
    scrollToSection(key);
  };

  const handleAnchorClick = (anchor: string) => {
    const sectionId = anchor.toLowerCase().replace(/\s+/g, '-');
    scrollToSection(sectionId);
  };

  const matchesSearch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const showMode = matchesSearch(t('settings.mode')) || matchesSearch(t('settings.dark')) || matchesSearch(t('settings.light'));
  const showTheme =
    matchesSearch(t('settings.theme')) ||
    AVAILABLE_CONCEPTS.some(
      ({ id, label, description }) =>
        matchesSearch(id) || matchesSearch(label) || matchesSearch(description),
    );
  const showLanguage = matchesSearch(t('settings.language')) || matchesSearch('한국어') || matchesSearch('English');
  const showDetachedAgentToasts =
    matchesSearch('Detached Agent Toasts') ||
    matchesSearch('Always Show') ||
    matchesSearch('Only When Tab Inactive');

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex animate-in fade-in duration-200" style={{ zIndex: 10000 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 m-auto flex h-[85vh] w-[min(90vw,900px)] overflow-hidden rounded-xl border border-subtle bg-surface-modal shadow-2xl ring-1 ring-black/10 animate-in zoom-in-95 duration-200">
        <div className="flex w-56 shrink-0 flex-col border-r border-subtle bg-surface-panel">
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-md border border-subtle bg-surface-base px-3 py-1.5">
              <Search size={14} className="shrink-0 text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('settings.search')}
                className="w-full bg-transparent text-sm text-default outline-none placeholder:text-muted"
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-3">
            {categories.map(({ key, icon: Icon, label, anchors }) => (
              <div key={key} className="mb-1">
                <button
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    activeCategory === key
                      ? 'bg-accent/10 text-accent'
                      : 'text-secondary hover:bg-surface-hover hover:text-default'
                  }`}
                  onClick={() => handleCategoryClick(key)}
                >
                  <Icon size={16} />
                  {label}
                </button>
                {activeCategory === key && (
                  <div className="ml-5 mt-0.5 flex flex-col border-l border-subtle pl-3">
                    {anchors.map((anchor) => (
                      <button
                        key={anchor}
                        className="py-1 text-left text-xs text-secondary transition-colors hover:text-default"
                        onClick={() => handleAnchorClick(anchor)}
                      >
                        {anchor}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
            <h2 className="text-lg font-semibold text-default">
              {categories.find((c) => c.key === activeCategory)?.label ?? t('settings.title')}
            </h2>
            <button
              className="rounded-md p-1 text-muted transition-colors hover:bg-surface-hover hover:text-default"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5">
            {(activeCategory === 'appearance' || searchQuery) && (
              <div data-section="appearance">
                {showMode && (
                  <section data-section={t('settings.mode').toLowerCase().replace(/\s+/g, '-')} className="mb-8">
                    <h3 className="text-base font-semibold text-default">{t('settings.mode')}</h3>
                    <p className="mb-4 text-sm text-secondary">{t('settings.modeDesc')}</p>
                    <div className="flex gap-3">
                      {(['dark', 'light'] as const).map((mode) => (
                        <button
                          key={mode}
                          className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                            themeMode === mode
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-subtle text-secondary hover:border-default hover:text-default'
                          }`}
                          onClick={() => setThemeMode(mode)}
                        >
                          {mode === 'dark' ? t('settings.dark') : t('settings.light')}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {showTheme && (
                  <section data-section={t('settings.theme').toLowerCase().replace(/\s+/g, '-')} className="mb-8">
                    <h3 className="text-base font-semibold text-default">{t('settings.theme')}</h3>
                    <p className="mb-4 text-sm text-secondary">{t('settings.themeDesc')}</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {AVAILABLE_CONCEPTS.map(({ id, label, description, preview }) => (
                        <button
                          key={id}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            themeConcept === id
                              ? 'border-accent bg-accent/10 text-accent shadow-sm'
                              : 'border-subtle text-secondary hover:border-default hover:bg-surface-hover/60 hover:text-default'
                          }`}
                          onClick={() => setThemeConcept(id)}
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{label}</div>
                              <div className="mt-1 text-xs text-muted">{description}</div>
                            </div>
                            {themeConcept === id && (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15">
                                <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                              </div>
                            )}
                          </div>
                          <div className="flex h-12 overflow-hidden rounded-lg border border-subtle">
                            {preview.map((color, index) => (
                              <div key={`${id}-${index}`} className="flex-1" style={{ background: color }} />
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {(activeCategory === 'language' || searchQuery) && showLanguage && (
              <div data-section="language">
                <section data-section={t('settings.language').toLowerCase().replace(/\s+/g, '-')} className="mb-8">
                  <h3 className="text-base font-semibold text-default">{t('settings.language')}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.languageDesc')}</p>
                  <div className="flex gap-3">
                    {([
                      { key: 'ko' as const, label: '한국어' },
                      { key: 'en' as const, label: 'English' },
                    ]).map(({ key, label }) => (
                      <button
                        key={key}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          locale === key
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setLocale(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {(activeCategory === 'notifications' || searchQuery) && showDetachedAgentToasts && (
              <div data-section="notifications">
                <section data-section="detached-agent-toasts" className="mb-8">
                  <h3 className="text-base font-semibold text-default">Detached Agent Toasts</h3>
                  <p className="mb-4 text-sm text-secondary">
                    Choose when detached windows should also show agent-complete toast notifications. Main window toasts always remain enabled.
                  </p>
                  <div className="flex gap-3">
                    {([
                      { key: 'always' as const, label: 'Always Show' },
                      { key: 'inactive-only' as const, label: 'Only When Tab Inactive' },
                    ]).map(({ key, label }) => (
                      <button
                        key={key}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          detachedAgentToastMode === key
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setDetachedAgentToastMode(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {searchQuery && !showMode && !showTheme && !showLanguage && !showDetachedAgentToasts && (
              <div className="flex flex-col items-center justify-center py-16 text-muted">
                <Search size={32} className="mb-3 opacity-40" />
                <p className="text-sm">{t('common.noResults')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

