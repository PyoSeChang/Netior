import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';
import { resolveSidecarRuntime } from './sidecar-runtime';
import { getNetiorServicePort } from '../runtime/runtime-paths';
import {
  clearSharedSidecarState,
  hasOtherDesktopRuntimeInstances,
  stopSharedSidecarProcess,
  writeSharedSidecarState,
} from '../runtime/runtime-coordination';

const require = createRequire(import.meta.url);
const NETIOR_SERVICE_SIDECAR_NAME = 'netior-service' as const;

let netiorServiceProcess: ChildProcess | null = null;
let netiorServiceBaseUrl: string | null = null;
let netiorServiceOwnedByCurrentProcess = false;

function resolveNetiorServicePath(): string | null {
  const candidates = [
    join(process.resourcesPath ?? '', 'sidecars', 'netior-service', 'dist', 'index.js'),
    join(process.resourcesPath ?? '', 'app.asar.unpacked', 'node_modules', '@netior', 'service', 'dist', 'index.js'),
    join(__dirname, '../../../../netior-service/dist/index.js'),
    join(__dirname, '../../../netior-service/dist/index.js'),
    join(process.cwd(), 'packages/netior-service/dist/index.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const resolved = require.resolve('@netior/service');
    const unpacked = toUnpackedAsarPath(resolved);
    if (unpacked && existsSync(unpacked)) {
      return unpacked;
    }
    return resolved;
  } catch {
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

export async function startNetiorService(config: {
  dbPath: string;
  port?: number;
}): Promise<boolean> {
  const port = config.port ?? getNetiorServicePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  if (netiorServiceBaseUrl) {
    if (await waitForHealth(baseUrl, 1, 0)) {
      return true;
    }

    netiorServiceBaseUrl = null;
    netiorServiceOwnedByCurrentProcess = false;
  }

  if (netiorServiceProcess) {
    return true;
  }

  if (await waitForHealth(baseUrl, 1, 0)) {
    console.log(`[netior-service] Reusing shared service at ${baseUrl}`);
    netiorServiceBaseUrl = baseUrl;
    netiorServiceOwnedByCurrentProcess = false;
    return true;
  }

  const modulePath = resolveNetiorServicePath();
  if (!modulePath) {
    console.warn('[netior-service] Could not resolve module path. Run: pnpm --filter @netior/service build');
    return false;
  }

  const runtime = resolveSidecarRuntime({
    envVarName: 'NETIOR_SERVICE_NODE_PATH',
    displayName: 'Netior service',
    minNodeMajor: 22,
    allowElectronFallback: false,
  });

  const child = spawn(runtime.command, [modulePath], {
    env: {
      ...process.env,
      ...runtime.env,
      NETIOR_SERVICE_DB_PATH: config.dbPath,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  netiorServiceProcess = child;
  netiorServiceOwnedByCurrentProcess = true;
  const spawnedPid = child.pid ?? null;

  child.stdout?.on('data', (data: Buffer) => {
    console.log('[netior-service:stdout]', data.toString().trim());
  });

  child.stderr?.on('data', (data: Buffer) => {
    console.error('[netior-service:stderr]', data.toString().trim());
  });

  child.on('exit', (code, signal) => {
    console.log(`[netior-service] Exited: code=${code}, signal=${signal}`);
    if (spawnedPid != null) {
      clearSharedSidecarState(NETIOR_SERVICE_SIDECAR_NAME, spawnedPid);
    }
    if (netiorServiceProcess === child) {
      netiorServiceProcess = null;
      netiorServiceBaseUrl = null;
      netiorServiceOwnedByCurrentProcess = false;
    }
  });

  child.on('error', (error) => {
    console.error('[netior-service] Spawn error:', error.message);
    if (netiorServiceProcess === child) {
      netiorServiceProcess = null;
      netiorServiceBaseUrl = null;
      netiorServiceOwnedByCurrentProcess = false;
    }
  });

  const healthy = await waitForHealth(baseUrl);
  if (!healthy) {
    console.warn('[netior-service] Health check failed, stopping service');
    stopNetiorService();
    return false;
  }

  netiorServiceBaseUrl = baseUrl;
  if (child.exitCode == null && netiorServiceProcess === child && spawnedPid != null) {
    writeSharedSidecarState(NETIOR_SERVICE_SIDECAR_NAME, { pid: spawnedPid, port });
  } else {
    netiorServiceOwnedByCurrentProcess = false;
    console.log(`[netior-service] Connected to shared service at ${baseUrl}`);
  }
  return true;
}

export function stopNetiorService(): void {
  const child = netiorServiceProcess;
  const childPid = child?.pid ?? null;

  if (hasOtherDesktopRuntimeInstances()) {
    console.log('[netior-service] Other desktop instances detected, leaving shared service running');
    netiorServiceProcess = null;
    netiorServiceBaseUrl = null;
    netiorServiceOwnedByCurrentProcess = false;
    return;
  }

  if (netiorServiceOwnedByCurrentProcess && child && child.exitCode == null && !child.killed) {
    child.kill();
    clearSharedSidecarState(NETIOR_SERVICE_SIDECAR_NAME, childPid);
  } else {
    stopSharedSidecarProcess(NETIOR_SERVICE_SIDECAR_NAME);
  }

  netiorServiceProcess = null;
  netiorServiceBaseUrl = null;
  netiorServiceOwnedByCurrentProcess = false;
}

export function isNetiorServiceRunning(): boolean {
  return netiorServiceBaseUrl !== null;
}

export function getNetiorServiceBaseUrl(): string | null {
  return netiorServiceBaseUrl;
}

async function waitForHealth(baseUrl: string, attempts = 20, delayMs = 250): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Service still starting.
    }

    if (attempt + 1 < attempts && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}
