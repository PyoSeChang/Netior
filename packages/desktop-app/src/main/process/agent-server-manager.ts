import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

let agentProcess: ChildProcess | null = null;

function resolveAgentServerPath(): string | null {
  // Try multiple candidate paths
  const candidates = [
    // Development: relative to project root
    join(__dirname, '../../../../agent-server/dist/index.js'),
    // Development: from packages/desktop-app/out/main/ → packages/agent-server/dist/
    join(__dirname, '../../../agent-server/dist/index.js'),
    // Monorepo root relative
    join(process.cwd(), 'packages/agent-server/dist/index.js'),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fallback: try require.resolve (works if properly linked)
  try {
    return require.resolve('@moc/agent-server/dist/index.js');
  } catch {
    return null;
  }
}

export function startAgentServer(config: {
  apiKey: string;
  dbPath: string;
  dataDir: string;
  port?: number;
}): void {
  if (agentProcess) return; // already running

  const modulePath = resolveAgentServerPath();
  if (!modulePath) {
    console.error('[agent-server] Could not resolve agent-server module path. Run: pnpm --filter @moc/agent-server build');
    return;
  }

  console.log(`[agent-server] Starting: ${modulePath}`);
  console.log(`[agent-server] DB: ${config.dbPath}`);
  console.log(`[agent-server] Data: ${config.dataDir}`);

  agentProcess = spawn('node', [modulePath], {
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: config.apiKey,
      MOC_DB_PATH: config.dbPath,
      MOC_DATA_DIR: config.dataDir,
      PORT: String(config.port ?? 3100),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  agentProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[agent-server]', data.toString().trim());
  });

  agentProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[agent-server]', data.toString().trim());
  });

  agentProcess.on('exit', (code) => {
    console.log(`[agent-server] exited with code ${code}`);
    agentProcess = null;
  });

  agentProcess.on('error', (err) => {
    console.error('[agent-server] spawn error:', err.message);
    agentProcess = null;
  });
}

export function stopAgentServer(): void {
  if (agentProcess) {
    agentProcess.kill();
    agentProcess = null;
  }
}

export function isAgentServerRunning(): boolean {
  return agentProcess !== null;
}
