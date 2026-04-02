/**
 * Narre Eval Harness — 수동 eval 환경 관리
 *
 * Usage:
 *   npx tsx .claude/skills/narre-eval/scripts/harness.ts setup [scenario-dir]
 *   npx tsx .claude/skills/narre-eval/scripts/harness.ts teardown
 *   npx tsx .claude/skills/narre-eval/scripts/harness.ts start-server
 *   npx tsx .claude/skills/narre-eval/scripts/harness.ts stop-server
 *   npx tsx .claude/skills/narre-eval/scripts/harness.ts health
 *   npx tsx .claude/skills/narre-eval/scripts/harness.ts status
 */
import { spawn } from 'child_process';
import { existsSync, unlinkSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

// Resolve project root (find pnpm-workspace.yaml)
function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== '/' && dir !== dir.substring(0, 2) + '\\') {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find project root (pnpm-workspace.yaml)');
}

const PROJECT_ROOT = findProjectRoot();
const APPDATA = process.env.APPDATA || process.env.HOME || '.';
const EVAL_DB_PATH = join(APPDATA, 'netior', 'data', 'netior-eval.db');
const EVAL_DATA_DIR = join(APPDATA, 'netior', 'data', 'eval');
const EVAL_PORT = 3199;
const PID_FILE = join(EVAL_DATA_DIR, 'narre-server.pid');

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'setup': {
      const scenarioDir = process.argv[3];
      await setup(scenarioDir);
      break;
    }
    case 'teardown':
      teardown();
      break;
    case 'start-server':
      await startServer();
      break;
    case 'stop-server':
      stopServer();
      break;
    case 'health':
      await healthCheck();
      break;
    case 'status':
      status();
      break;
    default:
      console.log('Usage: harness.ts <setup|teardown|start-server|stop-server|health|status> [scenario-dir]');
      console.log('');
      console.log('  setup [scenario-dir]  Initialize eval DB. If scenario-dir given, run its seed.ts.');
      console.log('  teardown              Stop server and delete eval DB.');
      console.log('  start-server          Start narre-server on port 3199.');
      console.log('  stop-server           Stop narre-server.');
      console.log('  health                Check narre-server health.');
      console.log('  status                Show eval environment status.');
      process.exit(1);
  }
}

async function setup(scenarioDir?: string) {
  console.log('=== Narre Eval Setup ===');

  // Delete existing eval DB
  if (existsSync(EVAL_DB_PATH)) {
    unlinkSync(EVAL_DB_PATH);
    console.log('Deleted existing eval DB');
  }

  mkdirSync(join(APPDATA, 'netior', 'data'), { recursive: true });
  mkdirSync(EVAL_DATA_DIR, { recursive: true });

  // Import core
  const coreDistPath = join(PROJECT_ROOT, 'packages/netior-core/dist/index.js');
  if (!existsSync(coreDistPath)) {
    throw new Error('netior-core not built. Run: pnpm --filter @netior/core build');
  }
  const core = await import(pathToFileURL(coreDistPath).href);

  core.initDatabase(EVAL_DB_PATH);
  console.log(`Initialized eval DB: ${EVAL_DB_PATH}`);

  if (scenarioDir) {
    // Run scenario's seed.ts
    const seedPath = join(scenarioDir, 'seed.ts');
    if (!existsSync(seedPath)) {
      throw new Error(`seed.ts not found in ${scenarioDir}`);
    }

    const seedModule = await import(pathToFileURL(seedPath).href);
    const seedFn = seedModule.default;

    // Build a minimal SeedContext for manual use
    let projectId: string | null = null;
    const ctx = {
      tempDir: join(EVAL_DATA_DIR, 'temp'),
      scenarioDir,
      createProject(data: any) {
        mkdirSync(ctx.tempDir, { recursive: true });
        const p = core.createProject({ ...data, root_dir: data.root_dir || ctx.tempDir });
        projectId = p.id;
        return p;
      },
      createArchetype: (data: any) => core.createArchetype(data),
      createRelationType: (data: any) => core.createRelationType(data),
      createCanvasType: (data: any) => core.createCanvasType(data),
      createConcept: (data: any) => core.createConcept(data),
      createModule: (data: any) => core.createModule(data),
      addModuleDirectory: (data: any) => core.addModuleDirectory(data),
      async copyFixtures() {
        const { cpSync } = await import('fs');
        const fixturesDir = join(scenarioDir!, 'fixtures');
        if (!existsSync(fixturesDir)) throw new Error(`fixtures/ not found in ${scenarioDir}`);
        cpSync(fixturesDir, ctx.tempDir, { recursive: true });
      },
    };

    await seedFn(ctx);

    if (projectId) {
      writeFileSync(join(EVAL_DATA_DIR, 'project-id.txt'), projectId, 'utf-8');
      console.log(`Seeded from ${scenarioDir} (project: ${projectId})`);
    }
  } else {
    // Create minimal project
    const project = core.createProject({ name: 'Eval Project', root_dir: join(EVAL_DATA_DIR, 'temp') });
    writeFileSync(join(EVAL_DATA_DIR, 'project-id.txt'), project.id, 'utf-8');
    console.log(`Created minimal project: ${project.id}`);
  }

  core.closeDatabase();
  console.log('Setup complete');
}

function teardown() {
  console.log('=== Narre Eval Teardown ===');
  stopServer();

  if (existsSync(EVAL_DB_PATH)) {
    unlinkSync(EVAL_DB_PATH);
    console.log('Deleted eval DB');
  }

  console.log('Teardown complete');
}

async function startServer() {
  if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 0);
      console.log(`narre-server already running (PID: ${pid})`);
      return;
    } catch {
      unlinkSync(PID_FILE);
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const serverPath = join(PROJECT_ROOT, 'packages/narre-server/dist/index.js');
  if (!existsSync(serverPath)) {
    throw new Error('narre-server not built. Run: pnpm --filter @netior/narre-server build');
  }

  console.log(`Starting narre-server on port ${EVAL_PORT}...`);
  const child = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: String(EVAL_PORT),
      MOC_DB_PATH: EVAL_DB_PATH,
      MOC_DATA_DIR: EVAL_DATA_DIR,
      ANTHROPIC_API_KEY: apiKey,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  });

  child.unref();
  writeFileSync(PID_FILE, String(child.pid), 'utf-8');
  console.log(`narre-server started (PID: ${child.pid})`);

  // Wait for health
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(`http://localhost:${EVAL_PORT}/health`);
      if (res.ok) {
        console.log('narre-server is healthy');
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('narre-server health check timed out');
}

function stopServer() {
  if (!existsSync(PID_FILE)) {
    console.log('No narre-server PID file found');
    return;
  }

  const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
  try {
    process.kill(pid);
    console.log(`Killed narre-server (PID: ${pid})`);
  } catch {
    console.log(`narre-server (PID: ${pid}) already stopped`);
  }
  unlinkSync(PID_FILE);
}

async function healthCheck() {
  try {
    const res = await fetch(`http://localhost:${EVAL_PORT}/health`);
    if (res.ok) {
      const data = await res.json();
      console.log('narre-server is healthy:', JSON.stringify(data));
    } else {
      console.log(`narre-server responded with ${res.status}`);
    }
  } catch {
    console.log('narre-server is not reachable');
    process.exit(1);
  }
}

function status() {
  console.log('=== Narre Eval Status ===');
  console.log(`DB path: ${EVAL_DB_PATH}`);
  console.log(`DB exists: ${existsSync(EVAL_DB_PATH)}`);
  console.log(`Data dir: ${EVAL_DATA_DIR}`);
  console.log(`PID file: ${existsSync(PID_FILE) ? readFileSync(PID_FILE, 'utf-8').trim() : 'none'}`);

  const projectIdFile = join(EVAL_DATA_DIR, 'project-id.txt');
  if (existsSync(projectIdFile)) {
    console.log(`Project ID: ${readFileSync(projectIdFile, 'utf-8').trim()}`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
