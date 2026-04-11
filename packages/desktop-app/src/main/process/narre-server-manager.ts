import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import type { NarreBehaviorSettings, NarreCodexSettings } from '@netior/shared/types';
import { resolveSidecarRuntime } from './sidecar-runtime';
import { getNetiorServiceBaseUrl } from './netior-service-manager';

export type NarreProviderName = 'claude' | 'openai' | 'codex';

export interface StartNarreServerConfig {
  provider: NarreProviderName;
  apiKey?: string;
  openaiModel?: string;
  behaviorSettings?: NarreBehaviorSettings;
  codexSettings?: NarreCodexSettings;
  dataDir: string;
  port?: number;
}

const DEFAULT_NARRE_PORT = 3100;
const require = createRequire(import.meta.url);

let narreProcess: ChildProcess | null = null;
let narreServerBaseUrl: string | null = null;
let narreLaunchSignature: string | null = null;

function resolveNarreServerPath(): string | null {
  const candidates = [
    join(__dirname, '../../../../narre-server/dist/index.js'),
    join(__dirname, '../../../narre-server/dist/index.js'),
    join(process.cwd(), 'packages/narre-server/dist/index.js'),
  ];

  console.log('[narre-server] __dirname:', __dirname);
  console.log('[narre-server] cwd:', process.cwd());
  console.log('[narre-server] Checking paths:');
  for (const candidate of candidates) {
    const found = existsSync(candidate);
    console.log(`[narre-server]   ${found ? 'FOUND' : 'MISS '} ${candidate}`);
    if (found) {
      return candidate;
    }
  }

  try {
    const resolved = require.resolve('@netior/narre-server');
    console.log(`[narre-server]   require.resolve: ${resolved}`);
    return resolved;
  } catch (err) {
    console.log(`[narre-server]   require.resolve failed: ${(err as Error).message}`);
    return null;
  }
}

function resolveRuntime(provider: NarreProviderName): {
  command: string;
  env: Record<string, string>;
  description: string;
} {
  return resolveSidecarRuntime({
    envVarName: 'NETIOR_NARRE_NODE_PATH',
    displayName: provider === 'openai'
      ? 'OpenAI Narre provider'
      : provider === 'codex'
        ? 'Codex Narre provider'
        : 'Narre sidecar',
    minNodeMajor: provider === 'openai' || provider === 'codex' ? 22 : undefined,
  });
}

function buildLaunchSignature(config: StartNarreServerConfig): string {
  return JSON.stringify({
    provider: config.provider,
    apiKey: config.apiKey ?? '',
    openaiModel: config.openaiModel ?? '',
    behaviorSettings: config.behaviorSettings ?? null,
    codexSettings: config.codexSettings ?? null,
    dataDir: config.dataDir,
    port: config.port ?? DEFAULT_NARRE_PORT,
    externalNodePath: process.env.NETIOR_NARRE_NODE_PATH ?? process.env.npm_node_execpath ?? null,
    electronNodeVersion: process.versions.node,
  });
}

export async function startNarreServer(config: StartNarreServerConfig): Promise<boolean> {
  if (config.provider === 'openai' && !config.apiKey) {
    console.warn('[narre-server] OpenAI provider selected but OPENAI_API_KEY is empty; skipping startup');
    return false;
  }

  const launchSignature = buildLaunchSignature(config);
  if (narreProcess && narreServerBaseUrl && narreLaunchSignature === launchSignature) {
    console.log('[narre-server] Already running with matching config, skipping restart');
    return true;
  }

  if (narreProcess) {
    console.log('[narre-server] Config changed, restarting');
    stopNarreServer();
  }

  const modulePath = resolveNarreServerPath();
  if (!modulePath) {
    console.error('[narre-server] Could not resolve module path. Run: pnpm --filter @netior/narre-server build');
    throw new Error('Could not resolve narre-server module path. Run: pnpm --filter @netior/narre-server build');
  }

  const runtime = resolveRuntime(config.provider);
  const port = config.port ?? DEFAULT_NARRE_PORT;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[narre-server] Starting: ${modulePath}`);
  console.log(`[narre-server] Provider: ${config.provider}`);
  console.log(`[narre-server] Data: ${config.dataDir}`);
  console.log(`[narre-server] Port: ${port}`);
  console.log(`[narre-server] Runtime: ${runtime.description}`);
  console.log(`[narre-server] API key: ${config.apiKey ? '***set***' : '(empty, will use OAuth)'}`);

  narreProcess = spawn(runtime.command, [modulePath], {
    env: {
      ...process.env,
      ...runtime.env,
      ...(getNetiorServiceBaseUrl()
        ? { NETIOR_SERVICE_URL: getNetiorServiceBaseUrl() as string }
        : {}),
      NARRE_PROVIDER: config.provider,
      ...(config.provider === 'claude'
        ? { ANTHROPIC_API_KEY: config.apiKey ?? '' }
        : config.provider === 'openai'
          ? { OPENAI_API_KEY: config.apiKey ?? '' }
          : {}),
      ...(config.provider === 'openai' && config.openaiModel
        ? { NARRE_OPENAI_MODEL: config.openaiModel }
        : {}),
      ...(config.behaviorSettings
        ? { NARRE_BEHAVIOR_SETTINGS_JSON: JSON.stringify(config.behaviorSettings) }
        : {}),
      ...(config.codexSettings
        ? { NARRE_CODEX_SETTINGS_JSON: JSON.stringify(config.codexSettings) }
        : {}),
      MOC_DATA_DIR: config.dataDir,
      PORT: String(port),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  console.log(`[narre-server] Spawned PID: ${narreProcess.pid}`);

  narreProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[narre-server:stdout]', data.toString().trim());
  });

  narreProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[narre-server:stderr]', data.toString().trim());
  });

  narreProcess.on('exit', (code, signal) => {
    console.log(`[narre-server] Exited: code=${code}, signal=${signal}`);
    narreProcess = null;
    narreServerBaseUrl = null;
    narreLaunchSignature = null;
  });

  narreProcess.on('error', (err) => {
    console.error('[narre-server] Spawn error:', err.message);
    narreProcess = null;
    narreServerBaseUrl = null;
    narreLaunchSignature = null;
  });

  const healthy = await waitForHealth(baseUrl);
  if (!healthy) {
    stopNarreServer();
    throw new Error('Narre server health check failed');
  }

  narreServerBaseUrl = baseUrl;
  narreLaunchSignature = launchSignature;
  return true;
}

export function stopNarreServer(): void {
  if (narreProcess) {
    console.log('[narre-server] Stopping...');
    narreProcess.kill();
    narreProcess = null;
  }
  narreServerBaseUrl = null;
  narreLaunchSignature = null;
}

export function isNarreServerRunning(): boolean {
  return narreServerBaseUrl !== null;
}

export function getNarreServerBaseUrl(): string | null {
  return narreServerBaseUrl;
}

async function waitForHealth(baseUrl: string): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}
