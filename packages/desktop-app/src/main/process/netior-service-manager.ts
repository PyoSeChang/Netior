import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';
import { resolveSidecarRuntime } from './sidecar-runtime';

const DEFAULT_NETIOR_SERVICE_PORT = 3201;
const require = createRequire(import.meta.url);

let netiorServiceProcess: ChildProcess | null = null;
let netiorServiceBaseUrl: string | null = null;

function resolveNetiorServicePath(): string | null {
  const candidates = [
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
    return require.resolve('@netior/service');
  } catch {
    return null;
  }
}

export async function startNetiorService(config: {
  dbPath: string;
  port?: number;
}): Promise<boolean> {
  if (netiorServiceProcess) {
    return true;
  }

  const modulePath = resolveNetiorServicePath();
  if (!modulePath) {
    console.warn('[netior-service] Could not resolve module path. Run: pnpm --filter @netior/service build');
    return false;
  }

  const port = config.port ?? DEFAULT_NETIOR_SERVICE_PORT;
  const baseUrl = `http://127.0.0.1:${port}`;
  const runtime = resolveSidecarRuntime({
    envVarName: 'NETIOR_SERVICE_NODE_PATH',
    displayName: 'Netior service',
    minNodeMajor: 22,
    allowElectronFallback: false,
  });

  netiorServiceProcess = spawn(runtime.command, [modulePath], {
    env: {
      ...process.env,
      ...runtime.env,
      NETIOR_SERVICE_DB_PATH: config.dbPath,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  netiorServiceProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[netior-service:stdout]', data.toString().trim());
  });

  netiorServiceProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[netior-service:stderr]', data.toString().trim());
  });

  netiorServiceProcess.on('exit', (code, signal) => {
    console.log(`[netior-service] Exited: code=${code}, signal=${signal}`);
    netiorServiceProcess = null;
    netiorServiceBaseUrl = null;
  });

  netiorServiceProcess.on('error', (error) => {
    console.error('[netior-service] Spawn error:', error.message);
    netiorServiceProcess = null;
    netiorServiceBaseUrl = null;
  });

  const healthy = await waitForHealth(baseUrl);
  if (!healthy) {
    console.warn('[netior-service] Health check failed, stopping service');
    stopNetiorService();
    return false;
  }

  netiorServiceBaseUrl = baseUrl;
  return true;
}

export function stopNetiorService(): void {
  if (netiorServiceProcess) {
    netiorServiceProcess.kill();
    netiorServiceProcess = null;
  }
  netiorServiceBaseUrl = null;
}

export function isNetiorServiceRunning(): boolean {
  return netiorServiceBaseUrl !== null;
}

export function getNetiorServiceBaseUrl(): string | null {
  return netiorServiceBaseUrl;
}

async function waitForHealth(baseUrl: string): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Service still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}
