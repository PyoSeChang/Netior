import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { createServer as createNetServer } from 'net';
import { join } from 'path';

const HEALTH_CHECK_TIMEOUT_MS = 15_000;
const HEALTH_CHECK_INTERVAL_MS = 250;

export interface StartedNetiorService {
  baseUrl: string;
  stop: () => Promise<void>;
}

export async function startNetiorServiceForEval(dbPath: string): Promise<StartedNetiorService> {
  const servicePath = resolveNetiorServicePath();
  if (!servicePath) {
    throw new Error('Could not find netior-service. Run: pnpm --filter @netior/service build');
  }

  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [servicePath], {
    env: {
      ...process.env,
      PORT: String(port),
      NETIOR_SERVICE_PORT: String(port),
      NETIOR_SERVICE_DB_PATH: dbPath,
      NETIOR_SERVICE_ENABLE_EVAL: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      console.log(`  [netior-service] ${line}`);
    }
  });

  child.stderr?.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      console.error(`  [netior-service:err] ${line}`);
    }
  });

  await waitForServiceHealth(baseUrl, child);

  return {
    baseUrl,
    stop: async () => {
      if (!child.killed) {
        child.kill();
      }
      await waitForExit(child);
    },
  };
}

function resolveNetiorServicePath(): string | null {
  const candidates = [
    join(process.cwd(), 'packages/netior-service/dist/index.js'),
    join(process.cwd(), '../netior-service/dist/index.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to allocate a netior-service port for narre-eval'));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForServiceHealth(baseUrl: string, child: ChildProcess): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < HEALTH_CHECK_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(`netior-service exited before health check completed (code=${child.exitCode})`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        return;
      }
    } catch {
      // Service is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
  }

  throw new Error(`netior-service health check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`);
}

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }

    child.once('exit', () => resolve());
    setTimeout(() => resolve(), 2_000);
  });
}
