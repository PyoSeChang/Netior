/**
 * Narre Eval Harness — DB 초기화 + agent-server 프로세스 관리
 *
 * Usage:
 *   npx tsx scripts/harness.ts setup [seed-json-path]
 *   npx tsx scripts/harness.ts teardown
 *   npx tsx scripts/harness.ts start-server
 *   npx tsx scripts/harness.ts stop-server
 *   npx tsx scripts/harness.ts health
 */
import { spawn, execSync } from 'child_process';
import { existsSync, unlinkSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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
const PID_FILE = join(EVAL_DATA_DIR, 'agent-server.pid');

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'setup': {
      const seedPath = process.argv[3];
      await setup(seedPath);
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
      console.log('Usage: harness.ts <setup|teardown|start-server|stop-server|health|status> [seed-json]');
      process.exit(1);
  }
}

async function setup(seedPath?: string) {
  console.log('=== Narre Eval Setup ===');

  // Delete existing eval DB
  if (existsSync(EVAL_DB_PATH)) {
    unlinkSync(EVAL_DB_PATH);
    console.log('Deleted existing eval DB');
  }

  mkdirSync(join(APPDATA, 'netior', 'data'), { recursive: true });
  mkdirSync(EVAL_DATA_DIR, { recursive: true });

  // Import moc-core dynamically
  const corePath = join(PROJECT_ROOT, 'packages/netior-core/src/index.ts');
  // Use the built version
  const coreDistPath = join(PROJECT_ROOT, 'packages/netior-core/dist/index.js');

  let core: any;
  if (existsSync(coreDistPath)) {
    core = await import(coreDistPath);
  } else {
    throw new Error('moc-core not built. Run: pnpm --filter @netior/core build');
  }

  core.initDatabase(EVAL_DB_PATH);
  console.log(`Initialized eval DB: ${EVAL_DB_PATH}`);

  // Seed data if provided
  if (seedPath) {
    const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));
    const projectId = seedFromData(core, seed);
    console.log(`Seeded project: ${seed.project.name} (${projectId})`);

    // Write project ID for later use
    writeFileSync(join(EVAL_DATA_DIR, 'project-id.txt'), projectId, 'utf-8');
  } else {
    // Create a minimal project
    const project = core.createProject({ name: 'Eval Project', root_dir: 'C:/tmp/eval-project' });
    writeFileSync(join(EVAL_DATA_DIR, 'project-id.txt'), project.id, 'utf-8');
    console.log(`Created minimal project: ${project.id}`);
  }

  core.closeDatabase();
  console.log('Setup complete');
}

function seedFromData(core: any, seed: any): string {
  const project = core.createProject({
    name: seed.project.name,
    root_dir: seed.project.root_dir,
  });

  const archetypeMap = new Map<string, string>();

  if (seed.archetypes) {
    for (const a of seed.archetypes) {
      const created = core.createArchetype({
        project_id: project.id,
        name: a.name,
        icon: a.icon,
        color: a.color,
        node_shape: a.node_shape,
      });
      archetypeMap.set(a.name, created.id);
    }
    console.log(`  Seeded ${seed.archetypes.length} archetype(s)`);
  }

  if (seed.relation_types) {
    for (const r of seed.relation_types) {
      core.createRelationType({
        project_id: project.id,
        name: r.name,
        directed: r.directed ?? false,
        line_style: r.line_style ?? 'solid',
        color: r.color,
      });
    }
    console.log(`  Seeded ${seed.relation_types.length} relation type(s)`);
  }

  if (seed.canvas_types) {
    for (const c of seed.canvas_types) {
      core.createCanvasType({
        project_id: project.id,
        name: c.name,
        description: c.description,
      });
    }
    console.log(`  Seeded ${seed.canvas_types.length} canvas type(s)`);
  }

  if (seed.concepts) {
    for (const c of seed.concepts) {
      const archetypeId = c.archetype_name ? archetypeMap.get(c.archetype_name) : undefined;
      core.createConcept({
        project_id: project.id,
        title: c.title,
        archetype_id: archetypeId,
        color: c.color,
        icon: c.icon,
      });
    }
    console.log(`  Seeded ${seed.concepts.length} concept(s)`);
  }

  return project.id;
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
  // Check if already running
  if (existsSync(PID_FILE)) {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
    try {
      process.kill(pid, 0);
      console.log(`agent-server already running (PID: ${pid})`);
      return;
    } catch {
      unlinkSync(PID_FILE);
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const serverPath = join(PROJECT_ROOT, 'packages/agent-server/dist/index.js');
  if (!existsSync(serverPath)) {
    throw new Error('agent-server not built. Run: pnpm --filter @netior/agent-server build');
  }

  console.log(`Starting agent-server on port ${EVAL_PORT}...`);
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
  console.log(`agent-server started (PID: ${child.pid})`);

  // Wait for health
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(`http://localhost:${EVAL_PORT}/health`);
      if (res.ok) {
        console.log('agent-server is healthy');
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('agent-server health check timed out');
}

function stopServer() {
  if (!existsSync(PID_FILE)) {
    console.log('No agent-server PID file found');
    return;
  }

  const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
  try {
    process.kill(pid);
    console.log(`Killed agent-server (PID: ${pid})`);
  } catch {
    console.log(`agent-server (PID: ${pid}) already stopped`);
  }
  unlinkSync(PID_FILE);
}

async function healthCheck() {
  try {
    const res = await fetch(`http://localhost:${EVAL_PORT}/health`);
    if (res.ok) {
      const data = await res.json();
      console.log('agent-server is healthy:', JSON.stringify(data));
    } else {
      console.log(`agent-server responded with ${res.status}`);
    }
  } catch (e) {
    console.log('agent-server is not reachable');
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
