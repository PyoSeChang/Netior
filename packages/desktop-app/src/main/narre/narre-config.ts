import { app } from 'electron';
import { join } from 'path';
import type { NarreBehaviorSettings, NarreCodexSettings } from '@netior/shared/types';
import { getRemoteConfig, setRemoteConfig } from '../netior-service/netior-service-client';
import { startNarreServer, stopNarreServer, type NarreProviderName } from '../process/narre-server-manager';

const NARRE_MANAGED_SETTING_KEYS = new Set([
  'narre.provider',
  'narre.behavior',
  'narre.codex',
  'narre.openai.model',
  'anthropic_api_key',
  'openai_api_key',
]);

export const DEFAULT_NARRE_BEHAVIOR_SETTINGS: NarreBehaviorSettings = {
  graphPriority: 'strict',
  discourageLocalWorkspaceActions: true,
  extraInstructions: '',
};

export const DEFAULT_NARRE_CODEX_SETTINGS: NarreCodexSettings = {
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

export function isNarreManagedSettingKey(key: string): boolean {
  return NARRE_MANAGED_SETTING_KEYS.has(key);
}

export function normalizeNarreProvider(value: unknown): NarreProviderName {
  if (value === 'openai') {
    return 'openai';
  }
  if (value === 'codex') {
    return 'codex';
  }
  return 'claude';
}

export async function readNarreSetting(key: string): Promise<unknown> {
  return await getRemoteConfig(key);
}

export async function writeNarreSetting(key: string, value: unknown): Promise<void> {
  await setRemoteConfig(key, value);
}

export function getApiKeySettingKey(provider: NarreProviderName): 'anthropic_api_key' | 'openai_api_key' | null {
  if (provider === 'openai') {
    return 'openai_api_key';
  }
  if (provider === 'claude') {
    return 'anthropic_api_key';
  }
  return null;
}

export async function getConfiguredNarreProvider(): Promise<NarreProviderName> {
  return normalizeNarreProvider((await readNarreSetting('narre.provider')) ?? process.env.NARRE_PROVIDER);
}

export async function getConfiguredNarreApiKey(provider: NarreProviderName): Promise<string> {
  const settingKey = getApiKeySettingKey(provider);
  if (settingKey) {
    const value = await readNarreSetting(settingKey);
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY ?? '';
  }
  if (provider === 'claude') {
    return process.env.ANTHROPIC_API_KEY ?? '';
  }
  return '';
}

export async function getConfiguredOpenAIModel(): Promise<string | undefined> {
  const value = await readNarreSetting('narre.openai.model');
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return typeof process.env.NARRE_OPENAI_MODEL === 'string' && process.env.NARRE_OPENAI_MODEL.length > 0
    ? process.env.NARRE_OPENAI_MODEL
    : undefined;
}

export async function getConfiguredNarreBehaviorSettings(): Promise<NarreBehaviorSettings> {
  return normalizeNarreBehaviorSettings(await readNarreSetting('narre.behavior'));
}

export async function getConfiguredCodexSettings(): Promise<NarreCodexSettings> {
  return normalizeCodexSettings(await readNarreSetting('narre.codex'));
}

export async function syncNarreServerWithSettings(): Promise<boolean> {
  const provider = await getConfiguredNarreProvider();
  const apiKey = await getConfiguredNarreApiKey(provider);
  const openaiModel = provider === 'openai'
    ? await getConfiguredOpenAIModel()
    : undefined;
  const behaviorSettings = await getConfiguredNarreBehaviorSettings();
  const codexSettings = await getConfiguredCodexSettings();

  const dbDir = join(app.getPath('userData'), 'data');

  if (provider === 'openai' && !apiKey) {
    stopNarreServer();
    return false;
  }

  return await startNarreServer({
    provider,
    apiKey,
    openaiModel,
    behaviorSettings,
    codexSettings,
    dataDir: dbDir,
  });
}

function normalizeNarreBehaviorSettings(value: unknown): NarreBehaviorSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NARRE_BEHAVIOR_SETTINGS };
  }

  const source = value as Record<string, unknown>;
  return {
    graphPriority: source.graphPriority === 'balanced' ? 'balanced' : 'strict',
    discourageLocalWorkspaceActions: source.discourageLocalWorkspaceActions !== false,
    extraInstructions: typeof source.extraInstructions === 'string' ? source.extraInstructions.trim() : '',
  };
}

function normalizeCodexSettings(value: unknown): NarreCodexSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NARRE_CODEX_SETTINGS };
  }

  const source = value as Record<string, unknown>;
  return {
    model: typeof source.model === 'string' ? source.model.trim() : '',
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
