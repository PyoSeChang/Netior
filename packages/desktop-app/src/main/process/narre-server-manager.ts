import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import type { NarreBehaviorSettings, NarreCodexSettings } from '@netior/shared/types';
import { resolveSidecarRuntime } from './sidecar-runtime';
import { getNetiorServiceBaseUrl } from './netior-service-manager';
import { getNarreServerPort } from '../runtime/runtime-paths';
import {
  clearSharedSidecarState,
  hasOtherDesktopRuntimeInstances,
  stopSharedSidecarProcess,
  writeSharedSidecarState,
} from '../runtime/runtime-coordination';

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

const require = createRequire(import.meta.url);
const NARRE_SERVER_SIDECAR_NAME = 'narre-server' as const;

let narreProcess: ChildProcess | null = null;
let narreServerBaseUrl: string | null = null;
let narreLaunchSignature: string | null = null;
let narreOwnedByCurrentProcess = false;

function resolveNarreServerPath(): string | null {
  const candidates = [
    join(process.resourcesPath ?? '', 'sidecars', 'narre-server', 'dist', 'index.cjs'),
    join(process.resourcesPath ?? '', 'sidecars', 'narre-server', 'dist', 'index.js'),
    join(process.resourcesPath ?? '', 'app.asar.unpacked', 'node_modules', '@netior', 'narre-server', 'dist', 'index.cjs'),
    join(process.resourcesPath ?? '', 'app.asar.unpacked', 'node_modules', '@netior', 'narre-server', 'dist', 'index.js'),
    join(__dirname, '../../../../narre-server/dist/index.cjs'),
    join(__dirname, '../../../../narre-server/dist/index.js'),
    join(__dirname, '../../../narre-server/dist/index.cjs'),
    join(__dirname, '../../../narre-server/dist/index.js'),
    join(__dirname, '../../../../narre-server/dist-trace/index.cjs'),
    join(__dirname, '../../../../narre-server/dist-trace/index.js'),
    join(__dirname, '../../../narre-server/dist-trace/index.cjs'),
    join(__dirname, '../../../narre-server/dist-trace/index.js'),
    join(process.cwd(), 'packages/narre-server/dist/index.cjs'),
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
    const unpacked = toUnpackedAsarPath(resolved);
    if (unpacked && existsSync(unpacked)) {
      console.log(`[narre-server]   require.resolve -> unpacked: ${unpacked}`);
      return unpacked;
    }
    console.log(`[narre-server]   require.resolve: ${resolved}`);
    return resolved;
  } catch (err) {
    console.log(`[narre-server]   require.resolve failed: ${(err as Error).message}`);
    return null;
  }
}

function toUnpackedAsarPath(resolvedPath: string): string | null {
  const marker = `${process.platform === 'win32' ? '\\' : '/'}app.asar${process.platform === 'win32' ? '\\' : '/'}`;
  if (!resolvedPath.includes(marker)) {
    return null;
  }

  return resolvedPath.replace(marker, marker.replace('app.asar', 'app.asar.unpacked'));
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
    port: config.port ?? getNarreServerPort(),
    externalNodePath: process.env.NETIOR_NARRE_NODE_PATH ?? process.env.npm_node_execpath ?? null,
    electronNodeVersion: process.versions.node,
  });
}

export async function startNarreServer(config: StartNarreServerConfig): Promise<boolean> {
  if (config.provider === 'openai' && !config.apiKey) {
    console.warn('[narre-server] OpenAI provider selected but OPENAI_API_KEY is empty; skipping startup');
    return false;
  }

  const port = config.port ?? getNarreServerPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const launchSignature = buildLaunchSignature(config);
  if (narreServerBaseUrl && narreLaunchSignature === launchSignature) {
    if (await waitForHealth(baseUrl, 1, 0)) {
      console.log('[narre-server] Already running with matching config, skipping restart');
      return true;
    }

    narreServerBaseUrl = null;
    narreLaunchSignature = null;
    narreOwnedByCurrentProcess = false;
  }

  if (narreProcess) {
    console.log('[narre-server] Config changed, restarting');
    stopNarreServer();
  }

  if (await waitForHealth(baseUrl, 1, 0)) {
    console.log(`[narre-server] Reusing shared service at ${baseUrl}`);
    narreServerBaseUrl = baseUrl;
    narreLaunchSignature = launchSignature;
    narreOwnedByCurrentProcess = false;
    return true;
  }

  const modulePath = resolveNarreServerPath();
  if (!modulePath) {
    console.error('[narre-server] Could not resolve module path. Run: pnpm --filter @netior/narre-server build');
    throw new Error('Could not resolve narre-server module path. Run: pnpm --filter @netior/narre-server build');
  }

  const runtime = resolveRuntime(config.provider);
  console.log(`[narre-server] Starting: ${modulePath}`);
  console.log(`[narre-server] Provider: ${config.provider}`);
  console.log(`[narre-server] Data: ${config.dataDir}`);
  console.log(`[narre-server] Port: ${port}`);
  console.log(`[narre-server] Runtime: ${runtime.description}`);
  console.log(`[narre-server] API key: ${config.apiKey ? '***set***' : '(empty, will use OAuth)'}`);

  const child = spawn(runtime.command, [modulePath], {
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
  narreProcess = child;
  narreOwnedByCurrentProcess = true;
  const spawnedPid = child.pid ?? null;

  console.log(`[narre-server] Spawned PID: ${child.pid}`);

  child.stdout?.on('data', (data: Buffer) => {
    console.log('[narre-server:stdout]', data.toString().trim());
  });

  child.stderr?.on('data', (data: Buffer) => {
    console.error('[narre-server:stderr]', data.toString().trim());
  });

  child.on('exit', (code, signal) => {
    console.log(`[narre-server] Exited: code=${code}, signal=${signal}`);
    if (spawnedPid != null) {
      clearSharedSidecarState(NARRE_SERVER_SIDECAR_NAME, spawnedPid);
    }
    if (narreProcess === child) {
      narreProcess = null;
      narreServerBaseUrl = null;
      narreLaunchSignature = null;
      narreOwnedByCurrentProcess = false;
    }
  });

  child.on('error', (err) => {
    console.error('[narre-server] Spawn error:', err.message);
    if (narreProcess === child) {
      narreProcess = null;
      narreServerBaseUrl = null;
      narreLaunchSignature = null;
      narreOwnedByCurrentProcess = false;
    }
  });

  const healthy = await waitForHealth(baseUrl);
  if (!healthy) {
    stopNarreServer();
    throw new Error('Narre server health check failed');
  }

  narreServerBaseUrl = baseUrl;
  narreLaunchSignature = launchSignature;
  if (child.exitCode == null && narreProcess === child && spawnedPid != null) {
    writeSharedSidecarState(NARRE_SERVER_SIDECAR_NAME, { pid: spawnedPid, port });
  } else {
    narreOwnedByCurrentProcess = false;
    console.log(`[narre-server] Connected to shared service at ${baseUrl}`);
  }
  return true;
}

export function stopNarreServer(): void {
  const child = narreProcess;
  const childPid = child?.pid ?? null;

  if (hasOtherDesktopRuntimeInstances()) {
    console.log('[narre-server] Other desktop instances detected, leaving shared service running');
    narreProcess = null;
    narreServerBaseUrl = null;
    narreLaunchSignature = null;
    narreOwnedByCurrentProcess = false;
    return;
  }

  if (narreOwnedByCurrentProcess && child && child.exitCode == null && !child.killed) {
    console.log('[narre-server] Stopping...');
    child.kill();
    clearSharedSidecarState(NARRE_SERVER_SIDECAR_NAME, childPid);
  } else {
    stopSharedSidecarProcess(NARRE_SERVER_SIDECAR_NAME);
  }

  narreProcess = null;
  narreServerBaseUrl = null;
  narreLaunchSignature = null;
  narreOwnedByCurrentProcess = false;
}

export function isNarreServerRunning(): boolean {
  return narreServerBaseUrl !== null;
}

export function getNarreServerBaseUrl(): string | null {
  return narreServerBaseUrl;
}

async function waitForHealth(baseUrl: string, attempts = 20, delayMs = 250): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server still starting.
    }

    if (attempt + 1 < attempts && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}
