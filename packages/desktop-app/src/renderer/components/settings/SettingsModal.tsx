import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Palette, Globe, Bell } from 'lucide-react';
import {
  useSettingsStore,
  AVAILABLE_THEME_FAMILIES,
  getThemeVariants,
  getPrimaryPresets,
  type ResolvedThemeMode,
  type ThemeSlotConfig,
} from '../../stores/settings-store';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';

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

type ThemeEditTarget = ResolvedThemeMode | 'both';

function buildFallbackSlot(familyId: ThemeSlotConfig['family']): ThemeSlotConfig {
  const family = AVAILABLE_THEME_FAMILIES.find((item) => item.id === familyId) ?? AVAILABLE_THEME_FAMILIES[0];
  const variant = family.variants.find((item) => item.id === family.defaultVariant) ?? family.variants[0];
  const preset = getPrimaryPresets(variant.recommendedPrimaryPresetIds)[0] ?? getPrimaryPresets()[0];

  return {
    family: family.id,
    variant: variant.id,
    primaryMode: 'preset',
    primaryPresetId: preset.id,
    primaryCustomColor: preset.color,
  };
}

function getSummaryText(slot: ThemeSlotConfig, t: ReturnType<typeof useI18n>['t']): string {
  const family = AVAILABLE_THEME_FAMILIES.find((item) => item.id === slot.family) ?? AVAILABLE_THEME_FAMILIES[0];
  const variant = getThemeVariants(slot.family).find((item) => item.id === slot.variant) ?? getThemeVariants(slot.family)[0];
  const preset = getPrimaryPresets().find((item) => item.id === slot.primaryPresetId) ?? getPrimaryPresets()[0];
  const primaryLabel = slot.primaryMode === 'custom' ? slot.primaryCustomColor : t(preset.labelKey);
  return `${t(family.labelKey)} / ${t(variant.labelKey)} / ${primaryLabel}`;
}

interface ThemeSetupPanelProps {
  selectedFamilyId: ThemeSlotConfig['family'] | null;
  target: ThemeEditTarget;
  lightTheme: ThemeSlotConfig;
  darkTheme: ThemeSlotConfig;
  t: ReturnType<typeof useI18n>['t'];
  onSelectFamily: (familyId: ThemeSlotConfig['family']) => void;
  onTargetChange: (target: ThemeEditTarget) => void;
  onSetFamily: (mode: ResolvedThemeMode, family: ThemeSlotConfig['family']) => void;
  onSetVariant: (mode: ResolvedThemeMode, variant: string) => void;
  onSetPrimaryMode: (mode: ResolvedThemeMode, primaryMode: ThemeSlotConfig['primaryMode']) => void;
  onSetPrimaryPreset: (mode: ResolvedThemeMode, presetId: string) => void;
  onSetPrimaryCustomColor: (mode: ResolvedThemeMode, color: string) => void;
}

function ThemeSetupPanel({
  selectedFamilyId,
  target,
  lightTheme,
  darkTheme,
  t,
  onSelectFamily,
  onTargetChange,
  onSetFamily,
  onSetVariant,
  onSetPrimaryMode,
  onSetPrimaryPreset,
  onSetPrimaryCustomColor,
}: ThemeSetupPanelProps): JSX.Element {
  const targetModes: ResolvedThemeMode[] = target === 'both' ? ['light', 'dark'] : [target];
  const applyFamilyIfNeeded = useCallback((mode: ResolvedThemeMode, familyId: ThemeSlotConfig['family']) => {
    const currentFamily = mode === 'light' ? lightTheme.family : darkTheme.family;
    if (currentFamily !== familyId) {
      onSetFamily(mode, familyId);
    }
  }, [darkTheme.family, lightTheme.family, onSetFamily]);

  if (!selectedFamilyId) {
    return (
      <section data-section="theme-library" className="mb-10">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-default">{t('settings.themeLibrary')}</h3>
          <p className="mt-1 text-sm text-secondary">{t('settings.themeLibraryDesc')}</p>
        </div>

        <div className="space-y-3">
          {AVAILABLE_THEME_FAMILIES.map((family) => (
            <button
              key={family.id}
              type="button"
              className="flex w-full items-center justify-between gap-4 rounded-2xl border border-subtle bg-surface-base p-4 text-left transition-all hover:border-default hover:bg-surface-card"
              onClick={() => {
                onSelectFamily(family.id);
                targetModes.forEach((mode) => applyFamilyIfNeeded(mode, family.id));
              }}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-default">{t(family.labelKey)}</div>
                <div className="mt-1 text-xs text-secondary">{t(family.descriptionKey)}</div>
              </div>
              <div className="flex h-12 w-36 shrink-0 overflow-hidden rounded-xl border border-subtle">
                {family.preview.map((color, index) => (
                  <div key={`${family.id}-${index}`} className="flex-1" style={{ background: color }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  }
  const familyApplied = targetModes.every((mode) => (mode === 'light' ? lightTheme.family : darkTheme.family) === selectedFamilyId);
  const referenceSlot = familyApplied ? (target === 'dark' ? darkTheme : lightTheme) : buildFallbackSlot(selectedFamilyId);
  const variants = getThemeVariants(selectedFamilyId);
  const activeVariant = variants.find((item) => item.id === referenceSlot.variant) ?? variants[0];
  const recommendedPresets = getPrimaryPresets(activeVariant.recommendedPrimaryPresetIds);
  const [customColorDraft, setCustomColorDraft] = useState(referenceSlot.primaryCustomColor);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomColorDraft(referenceSlot.primaryCustomColor);
  }, [referenceSlot.primaryCustomColor, selectedFamilyId, target]);

  const applyToTargetModes = useCallback((callback: (mode: ResolvedThemeMode) => void) => {
    targetModes.forEach(callback);
  }, [targetModes]);

  const commitCustomColor = useCallback((value: string) => {
    const normalized = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(normalized) || /^#[0-9a-fA-F]{3}$/.test(normalized)) {
      applyToTargetModes((mode) => {
        if ((mode === 'light' ? lightTheme.family : darkTheme.family) !== selectedFamilyId) {
          applyFamilyIfNeeded(mode, selectedFamilyId);
        }
        onSetPrimaryCustomColor(mode, normalized);
      });
      setCustomColorDraft(normalized);
    }
  }, [applyFamilyIfNeeded, applyToTargetModes, darkTheme.family, lightTheme.family, onSetPrimaryCustomColor, selectedFamilyId]);

  const bothDiffer = target === 'both' && (
    lightTheme.family !== darkTheme.family ||
    lightTheme.variant !== darkTheme.variant ||
    lightTheme.primaryMode !== darkTheme.primaryMode ||
    lightTheme.primaryPresetId !== darkTheme.primaryPresetId ||
    lightTheme.primaryCustomColor !== darkTheme.primaryCustomColor
  );

  return (
    <section data-section="theme-library" className="mb-10">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-default">{t('settings.themeLibrary')}</h3>
        <p className="mt-1 text-sm text-secondary">{t('settings.themeLibraryDesc')}</p>
      </div>

      <div className="space-y-3">
        {AVAILABLE_THEME_FAMILIES.map((family) => {
          const expanded = family.id === selectedFamilyId;

          return (
            <div
              key={family.id}
              className={`overflow-hidden rounded-2xl border transition-all ${
                expanded ? 'border-accent/50 bg-surface-card shadow-sm' : 'border-subtle bg-surface-base'
              }`}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 p-4 text-left"
                onClick={() => {
                  onSelectFamily(family.id);
                  targetModes.forEach((mode) => applyFamilyIfNeeded(mode, family.id));
                }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-default">{t(family.labelKey)}</div>
                  <div className="mt-1 text-xs text-secondary">{t(family.descriptionKey)}</div>
                </div>
                <div className="flex h-12 w-36 shrink-0 overflow-hidden rounded-xl border border-subtle">
                  {family.preview.map((color, index) => (
                    <div key={`${family.id}-${index}`} className="flex-1" style={{ background: color }} />
                  ))}
                </div>
              </button>

              {expanded && (
                <div className="border-t border-subtle px-4 py-4">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('settings.editScope')}</div>
                      <p className="mt-1 text-sm text-secondary">{t('settings.editScopeDesc')}</p>
                    </div>
                    <div className="flex gap-2">
                      {([
                        { id: 'light' as const, label: t('settings.lightTheme') },
                        { id: 'dark' as const, label: t('settings.darkTheme') },
                        { id: 'both' as const, label: t('settings.bothModes') },
                      ]).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                            target === item.id
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-subtle text-secondary hover:border-default hover:text-default'
                          }`}
                          onClick={() => {
                            onTargetChange(item.id);
                            (item.id === 'both' ? (['light', 'dark'] as const) : [item.id]).forEach((mode) =>
                              applyFamilyIfNeeded(mode, selectedFamilyId),
                            );
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <>
                      {bothDiffer && (
                        <div className="mb-5 rounded-xl border border-subtle bg-surface-panel px-4 py-3 text-sm text-secondary">
                          {t('settings.bothModesWillSync')}
                        </div>
                      )}

                      <div className="mb-5">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('settings.themeVariant')}</div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          {variants.map((variant) => (
                            <button
                              key={`${target}-${variant.id}`}
                              type="button"
                              className={`rounded-xl border p-3 text-left transition-all ${
                                referenceSlot.variant === variant.id
                                  ? 'border-accent bg-accent/10 text-accent shadow-sm'
                                  : 'border-subtle text-secondary hover:border-default hover:bg-surface-hover/60 hover:text-default'
                              }`}
                              onClick={() => applyToTargetModes((mode) => onSetVariant(mode, variant.id))}
                            >
                              <div className="text-sm font-semibold">{t(variant.labelKey)}</div>
                              <div className="mt-1 text-xs text-muted">{t(variant.descriptionKey)}</div>
                              <div className="mt-3 flex h-10 overflow-hidden rounded-lg border border-subtle">
                                {variant.preview.map((color, index) => (
                                  <div key={`${variant.id}-${index}`} className="flex-1" style={{ background: color }} />
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('settings.primaryPalette')}</div>
                        <div className="mb-4 flex gap-2">
                          {([
                            { id: 'preset' as const, label: t('settings.primaryRecommended') },
                            { id: 'custom' as const, label: t('settings.primaryCustom') },
                          ]).map((item) => (
                            <button
                              key={`${target}-${item.id}`}
                              type="button"
                              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                                referenceSlot.primaryMode === item.id
                                  ? 'border-accent bg-accent/10 text-accent'
                                  : 'border-subtle text-secondary hover:border-default hover:text-default'
                              }`}
                              onClick={() => applyToTargetModes((mode) => onSetPrimaryMode(mode, item.id))}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>

                        {referenceSlot.primaryMode === 'preset' ? (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {recommendedPresets.map((preset) => (
                              <button
                                key={`${target}-${preset.id}`}
                                type="button"
                                className={`rounded-xl border p-3 text-left transition-all ${
                                  referenceSlot.primaryPresetId === preset.id
                                    ? 'border-accent bg-accent/10 text-accent shadow-sm'
                                    : 'border-subtle text-secondary hover:border-default hover:bg-surface-hover/60 hover:text-default'
                                }`}
                                onClick={() => applyToTargetModes((mode) => onSetPrimaryPreset(mode, preset.id))}
                              >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold">{t(preset.labelKey)}</div>
                                    <div className="mt-1 text-xs text-muted">{t(preset.descriptionKey)}</div>
                                  </div>
                                  <div className="h-5 w-5 rounded-full border border-white/40 shadow-sm" style={{ background: preset.color }} />
                                </div>
                                <div className="h-9 rounded-lg border border-subtle" style={{ background: preset.color }} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-subtle bg-surface-panel p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="relative h-12 w-24 overflow-hidden rounded-lg border border-subtle shadow-sm"
                                style={{ background: referenceSlot.primaryCustomColor }}
                              >
                                <input
                                  ref={colorInputRef}
                                  type="color"
                                  value={referenceSlot.primaryCustomColor}
                                  onChange={(e) => {
                                    setCustomColorDraft(e.target.value);
                                    applyToTargetModes((mode) => onSetPrimaryCustomColor(mode, e.target.value));
                                  }}
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  aria-label={t('settings.openColorPicker')}
                                />
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-end px-2">
                                  <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-medium text-white whitespace-nowrap backdrop-blur-sm">
                                    {t('settings.openColorPicker')}
                                  </span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="mb-1 text-sm font-medium text-default">{t('settings.customColor')}</div>
                                <div className="flex gap-2">
                                  <Input
                                    value={customColorDraft}
                                    onChange={(e) => setCustomColorDraft(e.target.value)}
                                    onBlur={(e) => commitCustomColor(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        commitCustomColor((e.currentTarget as HTMLInputElement).value);
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    placeholder="#8f7f73"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {recommendedPresets.map((preset) => (
                                <button
                                  key={`${target}-custom-${preset.id}`}
                                  type="button"
                                  className="flex items-center gap-2 rounded-full border border-subtle bg-surface-base px-3 py-1.5 text-xs text-secondary transition-colors hover:border-default hover:text-default"
                                  onClick={() => {
                                    setCustomColorDraft(preset.color);
                                    applyToTargetModes((mode) => onSetPrimaryCustomColor(mode, preset.color));
                                  }}
                                >
                                  <span className="h-3 w-3 rounded-full border border-white/40" style={{ background: preset.color }} />
                                  {t(preset.labelKey)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                  </>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SettingsModal({ open, onClose }: SettingsModalProps): JSX.Element | null {
  const { t } = useI18n();
  const {
    appearanceMode,
    resolvedThemeMode,
    lightTheme,
    darkTheme,
    locale,
    detachedAgentToastMode,
    setAppearanceMode,
    setThemeFamily,
    setThemeVariant,
    setThemePrimaryMode,
    setThemePrimaryPreset,
    setThemePrimaryCustomColor,
    setLocale,
    setDetachedAgentToastMode,
  } = useSettingsStore();

  const [activeCategory, setActiveCategory] = useState('appearance');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState<ThemeSlotConfig['family'] | null>(null);
  const [themeTarget, setThemeTarget] = useState<ThemeEditTarget>('both');
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const categories: CategoryItem[] = [
    {
      key: 'appearance',
      icon: Palette,
      label: t('settings.categoryAppearance'),
      anchors: [t('settings.appearanceMode'), t('settings.currentThemeSetup'), t('settings.themeLibrary')],
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
      label: t('settings.categoryNotifications'),
      anchors: [t('settings.detachedAgentToasts')],
    },
  ];

  const currentThemeSummary = useMemo(() => ({
    light: getSummaryText(lightTheme, t),
    dark: getSummaryText(darkTheme, t),
  }), [darkTheme, lightTheme, t]);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEsc);
    setSearchQuery('');
    setActiveCategory('appearance');
    setSelectedFamilyId(null);
    setThemeTarget('both');
    setTimeout(() => searchRef.current?.focus(), 100);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [handleEsc, open]);

  const scrollToSection = (sectionId: string) => {
    const el = contentRef.current?.querySelector(`[data-section="${sectionId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCategoryClick = (key: string) => {
    setActiveCategory(key);
    scrollToSection(key);
  };

  const handleAnchorClick = (anchor: string) => {
    scrollToSection(anchor.toLowerCase().replace(/\s+/g, '-'));
  };

  const matchesSearch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const showAppearance = [
    t('settings.categoryAppearance'),
    t('settings.appearanceMode'),
    t('settings.currentThemeSetup'),
    t('settings.themeLibrary'),
    t('settings.themeFamily'),
    t('settings.themeVariant'),
    t('settings.primaryPalette'),
  ].some(matchesSearch);
  const showLanguage = [
    t('settings.categoryLanguage'),
    t('settings.language'),
    '한국어',
    'English',
  ].some(matchesSearch);
  const showDetachedAgentToasts = [
    t('settings.categoryNotifications'),
    t('settings.detachedAgentToasts'),
  ].some(matchesSearch);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex animate-in fade-in duration-200" style={{ zIndex: 10000 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 m-auto flex h-[90vh] w-[min(94vw,1120px)] overflow-hidden rounded-xl border border-subtle bg-surface-modal shadow-2xl ring-1 ring-black/10 animate-in zoom-in-95 duration-200">
        <div className="flex w-60 shrink-0 flex-col border-r border-subtle bg-surface-panel">
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
            {(activeCategory === 'appearance' || searchQuery) && showAppearance && (
              <div data-section="appearance">
                <section data-section="appearance-mode" className="mb-10">
                  <h3 className="text-base font-semibold text-default">{t('settings.appearanceMode')}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.appearanceModeDesc')}</p>
                  <div className="flex gap-3">
                    {([
                      { key: 'system' as const, label: t('settings.system') },
                      { key: 'dark' as const, label: t('settings.dark') },
                      { key: 'light' as const, label: t('settings.light') },
                    ]).map(({ key, label }) => (
                      <button
                        key={key}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          appearanceMode === key
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setAppearanceMode(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-muted">
                    {t('settings.currentResolvedMode')}: <span className="font-medium text-default">{resolvedThemeMode === 'dark' ? t('settings.dark') : t('settings.light')}</span>
                  </div>
                </section>

                <section data-section="current-theme-setup" className="mb-10">
                  <h3 className="text-base font-semibold text-default">{t('settings.currentThemeSetup')}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.currentThemeSetupDesc')}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-subtle bg-surface-card p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-default">{t('settings.lightTheme')}</div>
                        <button
                          type="button"
                          className="rounded-full border border-subtle px-2.5 py-1 text-[11px] font-medium text-secondary hover:border-default hover:text-default"
                          onClick={() => {
                            setSelectedFamilyId(lightTheme.family);
                            setThemeTarget('light');
                            scrollToSection('theme-library');
                          }}
                        >
                          {t('settings.editLight')}
                        </button>
                      </div>
                      <div className="text-sm text-secondary">{currentThemeSummary.light}</div>
                    </div>
                    <div className="rounded-2xl border border-subtle bg-surface-card p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-default">{t('settings.darkTheme')}</div>
                        <button
                          type="button"
                          className="rounded-full border border-subtle px-2.5 py-1 text-[11px] font-medium text-secondary hover:border-default hover:text-default"
                          onClick={() => {
                            setSelectedFamilyId(darkTheme.family);
                            setThemeTarget('dark');
                            scrollToSection('theme-library');
                          }}
                        >
                          {t('settings.editDark')}
                        </button>
                      </div>
                      <div className="text-sm text-secondary">{currentThemeSummary.dark}</div>
                    </div>
                  </div>
                </section>

                <ThemeSetupPanel
                  selectedFamilyId={selectedFamilyId}
                  target={themeTarget}
                  lightTheme={lightTheme}
                  darkTheme={darkTheme}
                  t={t}
                  onSelectFamily={setSelectedFamilyId}
                  onTargetChange={setThemeTarget}
                  onSetFamily={setThemeFamily}
                  onSetVariant={setThemeVariant}
                  onSetPrimaryMode={setThemePrimaryMode}
                  onSetPrimaryPreset={setThemePrimaryPreset}
                  onSetPrimaryCustomColor={setThemePrimaryCustomColor}
                />
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
                  <h3 className="text-base font-semibold text-default">{t('settings.detachedAgentToasts')}</h3>
                  <p className="mb-4 text-sm text-secondary">
                    {t('settings.detachedAgentToastsDesc')}
                  </p>
                  <div className="flex gap-3">
                    {([
                      { key: 'always' as const, label: t('settings.detachedAgentToastsAlways') },
                      { key: 'inactive-only' as const, label: t('settings.detachedAgentToastsInactiveOnly') },
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

            {searchQuery && !showAppearance && !showLanguage && !showDetachedAgentToasts && (
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
