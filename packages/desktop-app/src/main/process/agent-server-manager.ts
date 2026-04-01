import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

let agentProcess: ChildProcess | null = null;

function resolveAgentServerPath(): string | null {
  const candidates = [
    join(__dirname, '../../../../agent-server/dist/index.js'),
    join(__dirname, '../../../agent-server/dist/index.js'),
    join(process.cwd(), 'packages/agent-server/dist/index.js'),
  ];

  console.log('[agent-server] __dirname:', __dirname);
  console.log('[agent-server] cwd:', process.cwd());
  console.log('[agent-server] Checking paths:');
  for (const p of candidates) {
    const found = existsSync(p);
    console.log(`[agent-server]   ${found ? '✓' : '✗'} ${p}`);
    if (found) return p;
  }

  try {
    const resolved = require.resolve('@moc/agent-server/dist/index.js');
    console.log(`[agent-server]   ✓ require.resolve: ${resolved}`);
    return resolved;
  } catch (err) {
    console.log(`[agent-server]   ✗ require.resolve failed: ${(err as Error).message}`);
    return null;
  }
}

export function startAgentServer(config: {
  apiKey: string;
  dbPath: string;
  dataDir: string;
  port?: number;
}): void {
  if (agentProcess) {
    console.log('[agent-server] Already running, skipping start');
    return;
  }

  const modulePath = resolveAgentServerPath();
  if (!modulePath) {
    console.error('[agent-server] ✗ Could not resolve module path! Run: pnpm --filter @moc/agent-server build');
    return;
  }

  const port = config.port ?? 3100;
  console.log(`[agent-server] Starting: ${modulePath}`);
  console.log(`[agent-server] DB: ${config.dbPath}`);
  console.log(`[agent-server] Data: ${config.dataDir}`);
  console.log(`[agent-server] Port: ${port}`);
  console.log(`[agent-server] API key: ${config.apiKey ? '***set***' : '(empty, will use OAuth)'}`);

  agentProcess = spawn('node', [modulePath], {
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: config.apiKey,
      MOC_DB_PATH: config.dbPath,
      MOC_DATA_DIR: config.dataDir,
      PORT: String(port),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  console.log(`[agent-server] Spawned PID: ${agentProcess.pid}`);

  agentProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[agent-server:stdout]', data.toString().trim());
  });

  agentProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[agent-server:stderr]', data.toString().trim());
  });

  agentProcess.on('exit', (code, signal) => {
    console.log(`[agent-server] Exited: code=${code}, signal=${signal}`);
    agentProcess = null;
  });

  agentProcess.on('error', (err) => {
    console.error('[agent-server] Spawn error:', err.message);
    agentProcess = null;
  });
}

export function stopAgentServer(): void {
  if (agentProcess) {
    console.log('[agent-server] Stopping...');
    agentProcess.kill();
    agentProcess = null;
  }
}

export function isAgentServerRunning(): boolean {
  return agentProcess !== null;
}
