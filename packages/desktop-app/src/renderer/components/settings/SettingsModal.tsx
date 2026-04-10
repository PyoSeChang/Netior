import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Palette, Globe, Bell, Boxes } from 'lucide-react';
import {
  useSettingsStore,
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

interface PrimaryColorPanelProps {
  lightTheme: ThemeSlotConfig;
  darkTheme: ThemeSlotConfig;
  t: ReturnType<typeof useI18n>['t'];
  onSetPrimaryMode: (mode: ResolvedThemeMode, primaryMode: ThemeSlotConfig['primaryMode']) => void;
  onSetPrimaryPreset: (mode: ResolvedThemeMode, presetId: string) => void;
  onSetPrimaryCustomColor: (mode: ResolvedThemeMode, color: string) => void;
}

function PrimaryColorPanel({
  lightTheme,
  darkTheme,
  t,
  onSetPrimaryMode,
  onSetPrimaryPreset,
  onSetPrimaryCustomColor,
}: PrimaryColorPanelProps): JSX.Element {
  const presets = getPrimaryPresets();
  const activeColor = darkTheme.primaryMode === 'custom'
    ? darkTheme.primaryCustomColor
    : (presets.find((preset) => preset.id === darkTheme.primaryPresetId)?.color ?? presets[0].color);
  const [customColorDraft, setCustomColorDraft] = useState(activeColor);
  const bothDiffer =
    lightTheme.primaryMode !== darkTheme.primaryMode ||
    lightTheme.primaryPresetId !== darkTheme.primaryPresetId ||
    lightTheme.primaryCustomColor !== darkTheme.primaryCustomColor;

  const applyToBothModes = useCallback((callback: (mode: ResolvedThemeMode) => void) => {
    (['light', 'dark'] as const).forEach(callback);
  }, []);

  const setPreset = useCallback((presetId: string) => {
    applyToBothModes((mode) => {
      onSetPrimaryMode(mode, 'preset');
      onSetPrimaryPreset(mode, presetId);
    });
  }, [applyToBothModes, onSetPrimaryMode, onSetPrimaryPreset]);

  const setCustomColor = useCallback((color: string) => {
    setCustomColorDraft(color);
    applyToBothModes((mode) => onSetPrimaryCustomColor(mode, color));
  }, [applyToBothModes, onSetPrimaryCustomColor]);

  const commitCustomColor = useCallback((value: string) => {
    const normalized = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(normalized) || /^#[0-9a-fA-F]{3}$/.test(normalized)) {
      setCustomColor(normalized);
    } else {
      setCustomColorDraft(activeColor);
    }
  }, [activeColor, setCustomColor]);

  useEffect(() => {
    setCustomColorDraft(activeColor);
  }, [activeColor]);

  return (
    <section data-section="primary-color" className="mb-10">
      <h3 className="text-base font-semibold text-default">{t('settings.primaryPalette')}</h3>
      <p className="mb-4 mt-1 text-sm text-secondary">
        앱의 배경은 고정됩니다. 여기서 고른 색은 버튼, 선택 표시, 링크, 노드의 작은 강조에만 사용됩니다.
      </p>

      {bothDiffer && (
        <div className="mb-4 rounded-xl border border-subtle bg-surface-card px-4 py-3 text-sm text-secondary">
          이전 설정에서 light/dark 포인트 색이 달랐습니다. 아래에서 색을 고르면 두 모드에 같이 적용됩니다.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`rounded-xl border p-3 text-left transition-all ${
              darkTheme.primaryMode === 'preset' && darkTheme.primaryPresetId === preset.id
                ? 'border-accent bg-interactive-selected text-accent shadow-sm'
                : 'border-subtle bg-surface-card text-secondary hover:border-default hover:bg-surface-hover/60 hover:text-default'
            }`}
            onClick={() => setPreset(preset.id)}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="truncate text-sm font-semibold">{t(preset.labelKey)}</div>
              <div className="h-5 w-5 shrink-0 rounded-full border border-white/40 shadow-sm" style={{ background: preset.color }} />
            </div>
            <div className="h-8 rounded-lg border border-subtle" style={{ background: preset.color }} />
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-subtle bg-surface-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-default">{t('settings.primaryCustom')}</div>
            <div className="mt-1 text-xs text-muted">HEX 값을 직접 넣거나 색상 피커를 엽니다.</div>
          </div>
          <div className="h-8 w-8 rounded-full border border-default" style={{ background: activeColor }} />
        </div>
        <div className="flex gap-3">
          <input
            type="color"
            value={activeColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="h-10 w-16 shrink-0 cursor-pointer rounded-lg border border-input bg-input p-1"
            aria-label={t('settings.openColorPicker')}
          />
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
            placeholder="#0d99ff"
          />
        </div>
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
    nativeAgentNotificationsEnabled,
    agentNotificationSoundEnabled,
    fieldComplexityLevel,
    setAppearanceMode,
    setThemePrimaryMode,
    setThemePrimaryPreset,
    setThemePrimaryCustomColor,
    setLocale,
    setDetachedAgentToastMode,
    setNativeAgentNotificationsEnabled,
    setAgentNotificationSoundEnabled,
    setFieldComplexityLevel,
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
      anchors: [t('settings.appearanceMode'), t('settings.primaryPalette')],
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
      anchors: [
        t('settings.nativeAgentNotifications'),
        t('settings.agentNotificationSounds'),
        t('settings.detachedAgentToasts'),
      ],
    },
    {
      key: 'modeling',
      icon: Boxes,
      label: t('settings.categoryModeling' as never),
      anchors: [t('settings.fieldComplexity' as never)],
    },
  ];

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEsc);
    setSearchQuery('');
    setActiveCategory('appearance');
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
    t('settings.nativeAgentNotifications'),
    t('settings.nativeAgentNotificationsDesc'),
    t('settings.agentNotificationSounds'),
    t('settings.agentNotificationSoundsDesc'),
    t('settings.detachedAgentToasts'),
    t('settings.notificationsEnabled'),
    t('settings.notificationsDisabled'),
  ].some(matchesSearch);
  const showModeling = [
    t('settings.categoryModeling' as never),
    t('settings.fieldComplexity' as never),
    t('settings.fieldComplexityBasic' as never),
    t('settings.fieldComplexityStandard' as never),
    t('settings.fieldComplexityAdvanced' as never),
  ].some(matchesSearch);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex animate-in fade-in duration-200" style={{ zIndex: 10000 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 m-auto flex h-[90vh] w-[min(94vw,1120px)] overflow-hidden rounded-xl border border-subtle bg-surface-modal shadow-2xl ring-1 ring-black/10 animate-in zoom-in-95 duration-200">
        <div className="flex w-60 shrink-0 flex-col border-r border-subtle bg-[var(--surface-sidebar-panel)]">
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
                      ? 'bg-interactive-selected text-accent'
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

        <div className="flex flex-1 flex-col bg-surface-panel">
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
                            ? 'border-accent bg-accent text-on-accent'
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

                <PrimaryColorPanel
                  lightTheme={lightTheme}
                  darkTheme={darkTheme}
                  t={t}
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
                            ? 'border-accent bg-accent text-on-accent'
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
                <section data-section="native-agent-notifications" className="mb-8">
                  <h3 className="text-base font-semibold text-default">{t('settings.nativeAgentNotifications')}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.nativeAgentNotificationsDesc')}</p>
                  <div className="flex gap-3">
                    {([
                      { enabled: true, label: t('settings.notificationsEnabled') },
                      { enabled: false, label: t('settings.notificationsDisabled') },
                    ]).map(({ enabled, label }) => (
                      <button
                        key={label}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          nativeAgentNotificationsEnabled === enabled
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setNativeAgentNotificationsEnabled(enabled)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                <section data-section="agent-notification-sounds" className="mb-8">
                  <h3 className="text-base font-semibold text-default">{t('settings.agentNotificationSounds')}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.agentNotificationSoundsDesc')}</p>
                  <div className="flex gap-3">
                    {([
                      { enabled: true, label: t('settings.notificationsEnabled') },
                      { enabled: false, label: t('settings.notificationsDisabled') },
                    ]).map(({ enabled, label }) => (
                      <button
                        key={label}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          agentNotificationSoundEnabled === enabled
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-subtle text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setAgentNotificationSoundEnabled(enabled)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

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
                            ? 'border-accent bg-accent text-on-accent'
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

            {(activeCategory === 'modeling' || searchQuery) && showModeling && (
              <div data-section="modeling">
                <section data-section="field-complexity" className="mb-8">
                  <h3 className="text-base font-semibold text-default">{t('settings.fieldComplexity' as never)}</h3>
                  <p className="mb-4 text-sm text-secondary">{t('settings.fieldComplexityDesc' as never)}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {([
                      {
                        key: 'basic' as const,
                        label: t('settings.fieldComplexityBasic' as never),
                        description: t('settings.fieldComplexityBasicDesc' as never),
                      },
                      {
                        key: 'standard' as const,
                        label: t('settings.fieldComplexityStandard' as never),
                        description: t('settings.fieldComplexityStandardDesc' as never),
                      },
                      {
                        key: 'advanced' as const,
                        label: t('settings.fieldComplexityAdvanced' as never),
                        description: t('settings.fieldComplexityAdvancedDesc' as never),
                      },
                    ]).map(({ key, label, description }) => (
                      <button
                        key={key}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          fieldComplexityLevel === key
                            ? 'border-accent bg-interactive-selected text-accent shadow-sm'
                            : 'border-subtle bg-surface-card text-secondary hover:border-default hover:bg-surface-hover/60 hover:text-default'
                        }`}
                        onClick={() => setFieldComplexityLevel(key)}
                      >
                        <div className="text-sm font-semibold">{label}</div>
                        <div className="mt-2 text-xs leading-5 text-muted">{description}</div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {searchQuery && !showAppearance && !showLanguage && !showDetachedAgentToasts && !showModeling && (
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
