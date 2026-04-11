import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Palette, Globe, Bell, Boxes, Sparkles } from 'lucide-react';
import type { NarreBehaviorSettings, NarreCodexSettings } from '@netior/shared/types';
import {
  useSettingsStore,
  getPrimaryPresets,
  type ResolvedThemeMode,
  type ThemeSlotConfig,
} from '../../stores/settings-store';
import { useI18n } from '../../hooks/useI18n';
import { unwrapIpc } from '../../services/ipc';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { TextArea } from '../ui/TextArea';
import { Toggle } from '../ui/Toggle';

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

type NarreProviderName = 'claude' | 'openai' | 'codex';

interface NarreSettingsDraft {
  provider: NarreProviderName;
  anthropicApiKey: string;
  openaiApiKey: string;
  openaiModel: string;
  behaviorSettings: NarreBehaviorSettings;
  codexSettings: NarreCodexSettings;
}

const DEFAULT_NARRE_BEHAVIOR_SETTINGS: NarreBehaviorSettings = {
  graphPriority: 'strict',
  discourageLocalWorkspaceActions: true,
  extraInstructions: '',
};

const DEFAULT_NARRE_CODEX_SETTINGS: NarreCodexSettings = {
  model: '',
  useProjectRootAsWorkingDirectory: true,
  sandboxMode: 'read-only',
  approvalPolicy: 'on-request',
  enableShellTool: false,
  enableMultiAgent: false,
  enableWebSearch: false,
  enableViewImage: false,
  enableApps: false,
};

const EMPTY_NARRE_SETTINGS: NarreSettingsDraft = {
  provider: 'claude',
  anthropicApiKey: '',
  openaiApiKey: '',
  openaiModel: '',
  behaviorSettings: DEFAULT_NARRE_BEHAVIOR_SETTINGS,
  codexSettings: DEFAULT_NARRE_CODEX_SETTINGS,
};

function normalizeNarreProvider(value: unknown): NarreProviderName {
  if (value === 'openai') {
    return 'openai';
  }
  if (value === 'codex') {
    return 'codex';
  }
  return 'claude';
}

function normalizeBehaviorSettings(value: unknown): NarreBehaviorSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NARRE_BEHAVIOR_SETTINGS };
  }

  const source = value as Record<string, unknown>;
  return {
    graphPriority: source.graphPriority === 'balanced' ? 'balanced' : 'strict',
    discourageLocalWorkspaceActions: source.discourageLocalWorkspaceActions !== false,
    extraInstructions: typeof source.extraInstructions === 'string' ? source.extraInstructions : '',
  };
}

function normalizeCodexSettings(value: unknown): NarreCodexSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NARRE_CODEX_SETTINGS };
  }

  const source = value as Record<string, unknown>;
  return {
    model: typeof source.model === 'string' ? source.model : '',
    useProjectRootAsWorkingDirectory: source.useProjectRootAsWorkingDirectory !== false,
    sandboxMode: source.sandboxMode === 'workspace-write' || source.sandboxMode === 'danger-full-access'
      ? source.sandboxMode
      : 'read-only',
    approvalPolicy: source.approvalPolicy === 'untrusted' || source.approvalPolicy === 'never'
      ? source.approvalPolicy
      : 'on-request',
    enableShellTool: source.enableShellTool === true,
    enableMultiAgent: source.enableMultiAgent === true,
    enableWebSearch: source.enableWebSearch === true,
    enableViewImage: source.enableViewImage === true,
    enableApps: source.enableApps === true,
  };
}

function NarreSettingsPanel({
  open,
  t,
}: {
  open: boolean;
  t: ReturnType<typeof useI18n>['t'];
}): JSX.Element {
  const [draft, setDraft] = useState<NarreSettingsDraft>(EMPTY_NARRE_SETTINGS);
  const [savedDraft, setSavedDraft] = useState<NarreSettingsDraft>(EMPTY_NARRE_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setStatus(null);

    void Promise.all([
      window.electron.config.get('narre.provider'),
      window.electron.config.get('narre.behavior'),
      window.electron.config.get('narre.codex'),
      window.electron.config.get('anthropic_api_key'),
      window.electron.config.get('openai_api_key'),
      window.electron.config.get('narre.openai.model'),
    ]).then(([
      providerResult,
      behaviorResult,
      codexResult,
      anthropicKeyResult,
      openaiKeyResult,
      openaiModelResult,
    ]) => {
      if (cancelled) {
        return;
      }

      const nextDraft: NarreSettingsDraft = {
        provider: normalizeNarreProvider(unwrapIpc(providerResult)),
        behaviorSettings: normalizeBehaviorSettings(unwrapIpc(behaviorResult)),
        codexSettings: normalizeCodexSettings(unwrapIpc(codexResult)),
        anthropicApiKey: typeof unwrapIpc(anthropicKeyResult) === 'string' ? unwrapIpc(anthropicKeyResult) as string : '',
        openaiApiKey: typeof unwrapIpc(openaiKeyResult) === 'string' ? unwrapIpc(openaiKeyResult) as string : '',
        openaiModel: typeof unwrapIpc(openaiModelResult) === 'string' ? unwrapIpc(openaiModelResult) as string : '',
      };

      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setLoading(false);
    }).catch((error: Error) => {
      if (cancelled) {
        return;
      }

      setStatus({
        kind: 'error',
        message: `${t('settings.narreConfigLoadFailed')}: ${error.message}`,
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const hasChanges = (
    draft.provider !== savedDraft.provider ||
    draft.anthropicApiKey !== savedDraft.anthropicApiKey ||
    draft.openaiApiKey !== savedDraft.openaiApiKey ||
    draft.openaiModel !== savedDraft.openaiModel ||
    JSON.stringify(draft.behaviorSettings) !== JSON.stringify(savedDraft.behaviorSettings) ||
    JSON.stringify(draft.codexSettings) !== JSON.stringify(savedDraft.codexSettings)
  );

  const activeApiKey = draft.provider === 'openai' ? draft.openaiApiKey : draft.anthropicApiKey;
  const openaiKeyMissing = draft.provider === 'openai' && draft.openaiApiKey.trim().length === 0;

  const updateDraft = useCallback((updater: (current: NarreSettingsDraft) => NarreSettingsDraft) => {
    setStatus(null);
    setDraft((current) => updater(current));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatus(null);

    const nextDraft: NarreSettingsDraft = {
      ...draft,
      anthropicApiKey: draft.anthropicApiKey.trim(),
      openaiApiKey: draft.openaiApiKey.trim(),
      openaiModel: draft.openaiModel.trim(),
      behaviorSettings: {
        ...draft.behaviorSettings,
        extraInstructions: draft.behaviorSettings.extraInstructions?.trim() ?? '',
      },
      codexSettings: {
        ...draft.codexSettings,
        model: draft.codexSettings.model?.trim() ?? '',
      },
    };

    try {
      unwrapIpc(await window.electron.config.set('anthropic_api_key', nextDraft.anthropicApiKey));
      unwrapIpc(await window.electron.config.set('openai_api_key', nextDraft.openaiApiKey));
      unwrapIpc(await window.electron.config.set('narre.openai.model', nextDraft.openaiModel));
      unwrapIpc(await window.electron.config.set('narre.behavior', nextDraft.behaviorSettings));
      unwrapIpc(await window.electron.config.set('narre.codex', nextDraft.codexSettings));
      unwrapIpc(await window.electron.config.set('narre.provider', nextDraft.provider));

      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setStatus({
        kind: 'success',
        message: t('settings.narreSaveSuccess'),
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: `${t('settings.narreConfigSaveFailed')}: ${(error as Error).message}`,
      });
    } finally {
      setSaving(false);
    }
  }, [draft, t]);

  return (
    <div data-section="narre">
      <section data-section="narre-provider" className="mb-8">
        <h3 className="text-base font-semibold text-default">{t('settings.narreProvider')}</h3>
        <p className="mb-4 text-sm text-secondary">{t('settings.narreProviderDesc')}</p>
        <div className="flex gap-3">
          {([
            { key: 'claude' as const, label: t('settings.narreProviderClaude') },
            { key: 'openai' as const, label: t('settings.narreProviderOpenAI') },
            { key: 'codex' as const, label: t('settings.narreProviderCodex' as never) },
          ]).map(({ key, label }) => (
            <button
              key={key}
              className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                draft.provider === key
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-subtle text-secondary hover:border-default hover:text-default'
              }`}
              onClick={() => updateDraft((current) => ({ ...current, provider: key }))}
              disabled={loading || saving}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section data-section="api-key" className="mb-8">
        {draft.provider === 'codex' ? (
          <>
            <h3 className="text-base font-semibold text-default">{t('settings.narreCodexAuth' as never)}</h3>
            <p className="mb-4 text-sm text-secondary">{t('settings.narreCodexAuthDesc' as never)}</p>
            <div className="rounded-lg border border-subtle bg-surface-card px-4 py-3 text-sm text-secondary">
              {t('settings.narreCodexAuthHint' as never)}
            </div>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold text-default">{t('settings.narreApiKey')}</h3>
            <p className="mb-4 text-sm text-secondary">{t('settings.narreApiKeyDesc')}</p>
            <Input
              type="password"
              value={activeApiKey}
              onChange={(e) => {
                const value = e.target.value;
                updateDraft((current) => current.provider === 'openai'
                  ? { ...current, openaiApiKey: value }
                  : { ...current, anthropicApiKey: value });
              }}
              placeholder={draft.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
              disabled={loading || saving}
            />
            {openaiKeyMissing && (
              <div className="mt-2 text-xs text-status-warning">
                {t('settings.narreOpenAIKeyRequired')}
              </div>
            )}
          </>
        )}
      </section>

      {draft.provider === 'openai' && (
        <section data-section="openai-model" className="mb-8">
          <h3 className="text-base font-semibold text-default">{t('settings.narreOpenAIModel')}</h3>
          <p className="mb-4 text-sm text-secondary">{t('settings.narreOpenAIModelDesc')}</p>
          <Input
            value={draft.openaiModel}
            onChange={(e) => updateDraft((current) => ({ ...current, openaiModel: e.target.value }))}
            placeholder="gpt-5.1"
            disabled={loading || saving}
          />
        </section>
      )}

      {draft.provider === 'codex' && (
        <section data-section="codex-auth" className="mb-8 rounded-xl border border-subtle bg-surface-card p-4">
          <div className="text-sm font-semibold text-default">{t('settings.narreCodexAuth' as never)}</div>
          <div className="mt-2 text-xs text-muted">
            {t('settings.narreCodexAuthSetup' as never)}
          </div>
        </section>
      )}

      <section data-section="narre-behavior" className="mb-8 rounded-xl border border-subtle bg-surface-card p-4">
        <h3 className="text-base font-semibold text-default">{t('settings.narreBehaviorTitle' as never)}</h3>
        <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.narreBehaviorDesc' as never)}</p>

        <div className="mb-4">
          <div className="mb-2 text-sm font-medium text-default">{t('settings.narreGraphPriority' as never)}</div>
          <Select
            value={draft.behaviorSettings.graphPriority}
            onChange={(e) => updateDraft((current) => ({
              ...current,
              behaviorSettings: {
                ...current.behaviorSettings,
                graphPriority: e.target.value as NarreBehaviorSettings['graphPriority'],
              },
            }))}
            disabled={loading || saving}
            options={[
              { value: 'strict', label: t('settings.narreGraphPriorityStrict' as never) },
              { value: 'balanced', label: t('settings.narreGraphPriorityBalanced' as never) },
            ]}
          />
        </div>

        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-default">{t('settings.narreDiscourageLocalWorkspaceActions' as never)}</div>
            <div className="mt-1 text-xs text-muted">{t('settings.narreDiscourageLocalWorkspaceActionsDesc' as never)}</div>
          </div>
          <Toggle
            checked={draft.behaviorSettings.discourageLocalWorkspaceActions}
            onChange={(checked) => updateDraft((current) => ({
              ...current,
              behaviorSettings: {
                ...current.behaviorSettings,
                discourageLocalWorkspaceActions: checked,
              },
            }))}
            disabled={loading || saving}
          />
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-default">{t('settings.narreExtraInstructions' as never)}</div>
          <div className="mb-2 text-xs text-muted">{t('settings.narreExtraInstructionsDesc' as never)}</div>
          <TextArea
            value={draft.behaviorSettings.extraInstructions ?? ''}
            onChange={(e) => updateDraft((current) => ({
              ...current,
              behaviorSettings: {
                ...current.behaviorSettings,
                extraInstructions: e.target.value,
              },
            }))}
            disabled={loading || saving}
            placeholder={t('settings.narreExtraInstructionsPlaceholder' as never)}
          />
        </div>
      </section>

      {draft.provider === 'codex' && (
        <section data-section="codex-runtime" className="mb-8 rounded-xl border border-subtle bg-surface-card p-4">
          <h3 className="text-base font-semibold text-default">{t('settings.narreCodexRuntime' as never)}</h3>
          <p className="mb-4 mt-1 text-sm text-secondary">{t('settings.narreCodexRuntimeDesc' as never)}</p>

          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-default">{t('settings.narreCodexModel' as never)}</div>
            <Input
              value={draft.codexSettings.model ?? ''}
              onChange={(e) => updateDraft((current) => ({
                ...current,
                codexSettings: {
                  ...current.codexSettings,
                  model: e.target.value,
                },
              }))}
              placeholder="gpt-5-codex"
              disabled={loading || saving}
            />
            <div className="mt-2 text-xs text-muted">{t('settings.narreCodexModelDesc' as never)}</div>
          </div>

          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-default">{t('settings.narreCodexUseProjectRoot' as never)}</div>
              <div className="mt-1 text-xs text-muted">{t('settings.narreCodexUseProjectRootDesc' as never)}</div>
            </div>
            <Toggle
              checked={draft.codexSettings.useProjectRootAsWorkingDirectory}
              onChange={(checked) => updateDraft((current) => ({
                ...current,
                codexSettings: {
                  ...current.codexSettings,
                  useProjectRootAsWorkingDirectory: checked,
                },
              }))}
              disabled={loading || saving}
            />
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium text-default">{t('settings.narreCodexSandbox' as never)}</div>
              <Select
                value={draft.codexSettings.sandboxMode}
                onChange={(e) => updateDraft((current) => ({
                  ...current,
                  codexSettings: {
                    ...current.codexSettings,
                    sandboxMode: e.target.value as NarreCodexSettings['sandboxMode'],
                  },
                }))}
                disabled={loading || saving}
                options={[
                  { value: 'read-only', label: t('settings.narreCodexSandboxReadOnly' as never) },
                  { value: 'workspace-write', label: t('settings.narreCodexSandboxWorkspaceWrite' as never) },
                  { value: 'danger-full-access', label: t('settings.narreCodexSandboxDanger' as never) },
                ]}
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-default">{t('settings.narreCodexApproval' as never)}</div>
              <Select
                value={draft.codexSettings.approvalPolicy}
                onChange={(e) => updateDraft((current) => ({
                  ...current,
                  codexSettings: {
                    ...current.codexSettings,
                    approvalPolicy: e.target.value as NarreCodexSettings['approvalPolicy'],
                  },
                }))}
                disabled={loading || saving}
                options={[
                  { value: 'untrusted', label: t('settings.narreCodexApprovalUntrusted' as never) },
                  { value: 'on-request', label: t('settings.narreCodexApprovalOnRequest' as never) },
                  { value: 'never', label: t('settings.narreCodexApprovalNever' as never) },
                ]}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {([
              ['enableShellTool', 'settings.narreCodexEnableShellTool'],
              ['enableMultiAgent', 'settings.narreCodexEnableMultiAgent'],
              ['enableWebSearch', 'settings.narreCodexEnableWebSearch'],
              ['enableViewImage', 'settings.narreCodexEnableViewImage'],
              ['enableApps', 'settings.narreCodexEnableApps'],
            ] as const).map(([key, labelKey]) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-subtle px-3 py-2">
                <div className="text-sm text-default">{t(labelKey as never)}</div>
                <Toggle
                  checked={draft.codexSettings[key]}
                  onChange={(checked) => updateDraft((current) => ({
                    ...current,
                    codexSettings: {
                      ...current.codexSettings,
                      [key]: checked,
                    },
                  }))}
                  disabled={loading || saving}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 rounded-xl border border-subtle bg-surface-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-default">{t('settings.narreSave')}</div>
            <div className="mt-1 text-xs text-muted">{t('settings.narreRestartHint')}</div>
          </div>
          <Button
            onClick={() => { void handleSave(); }}
            isLoading={saving}
            disabled={loading || saving || !hasChanges}
          >
            {t('settings.narreSave')}
          </Button>
        </div>
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-secondary">
            <Spinner size="sm" />
            {t('common.loading')}
          </div>
        )}
        {status && (
          <div className={`mt-3 text-sm ${status.kind === 'success' ? 'text-status-success' : 'text-status-error'}`}>
            {status.message}
          </div>
        )}
      </section>
    </div>
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
    {
      key: 'narre',
      icon: Sparkles,
      label: t('settings.categoryNarre'),
      anchors: [
        t('settings.narreProvider'),
        t('settings.narreApiKey'),
        t('settings.narreOpenAIModel'),
        t('settings.narreCodexAuth' as never),
        t('settings.narreBehaviorTitle' as never),
        t('settings.narreCodexRuntime' as never),
      ],
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
  const showNarre = [
    t('settings.categoryNarre'),
    t('settings.narreProvider'),
    t('settings.narreProviderClaude'),
    t('settings.narreProviderOpenAI'),
    t('settings.narreProviderCodex' as never),
    t('settings.narreApiKey'),
    t('settings.narreOpenAIModel'),
    t('settings.narreCodexAuth' as never),
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

            {(activeCategory === 'narre' || searchQuery) && showNarre && (
              <NarreSettingsPanel open={open} t={t} />
            )}

            {searchQuery && !showAppearance && !showLanguage && !showDetachedAgentToasts && !showModeling && !showNarre && (
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
