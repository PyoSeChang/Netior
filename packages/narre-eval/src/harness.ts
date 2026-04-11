import { existsSync, unlinkSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import type { SeedContext } from './types.js';
import {
  createArchetype,
  createConcept,
  createFileEntity,
  createModule,
  createProject,
  createRelationType,
} from './netior-service-client.js';
import { startNetiorServiceForEval } from './netior-service-process.js';

let currentRunId: string | null = null;

export interface SetupResult {
  projectId: string;
  tempDir: string;
  dbPath: string;
  templateVars: Record<string, string>;
  serviceUrl: string;
  stopService: () => Promise<void>;
}

export function getRunId(): string {
  if (!currentRunId) {
    currentRunId = randomUUID().slice(0, 8);
  }
  return currentRunId;
}

export function setRunId(runId: string): void {
  currentRunId = runId;
}

export async function setupScenario(
  scenarioDir: string,
  seedFn: (ctx: SeedContext) => Promise<void>,
  scenarioId: string,
): Promise<SetupResult> {
  // Unique dir per setup call — safe under --repeat
  const uniqueSuffix = randomUUID().slice(0, 8);
  const tempDir = join(tmpdir(), `narre-eval-${scenarioId}-${uniqueSuffix}`);
  mkdirSync(tempDir, { recursive: true });

  // Per-scenario DB path inside temp dir
  const dbPath = join(tempDir, `${scenarioId}.db`);

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const service = await startNetiorServiceForEval(dbPath);

  let projectId: string | null = null;
  let templateVars: Record<string, string> = {};
  const pendingOperations: Promise<unknown>[] = [];

  function track<T>(promise: Promise<T>): Promise<T> {
    pendingOperations.push(promise);
    return promise;
  }

  const ctx: SeedContext = {
    tempDir,
    scenarioDir,
    async createProject(data) {
      const project = await track(createProject(service.baseUrl, {
        ...data,
        root_dir: data.root_dir || tempDir,
      }));
      projectId = project.id;
      return project;
    },
    createArchetype(data) {
      return track(createArchetype(service.baseUrl, data));
    },
    createRelationType(data) {
      return track(createRelationType(service.baseUrl, data));
    },
    createConcept(data) {
      return track(createConcept(service.baseUrl, data));
    },
    createFileEntity(data) {
      return track(createFileEntity(service.baseUrl, data));
    },
    createModule(data) {
      return track(createModule(service.baseUrl, data));
    },
    async copyFixtures() {
      const fixturesDir = join(scenarioDir, 'fixtures');
      if (!existsSync(fixturesDir)) {
        throw new Error(`fixtures/ directory not found in ${scenarioDir}`);
      }
      cpSync(fixturesDir, tempDir, { recursive: true });
    },
    setTemplateVars(vars) {
      templateVars = { ...templateVars, ...vars };
    },
  };

  try {
    await seedFn(ctx);
    await Promise.all(pendingOperations);

    if (!projectId) {
      throw new Error('seed function must call ctx.createProject()');
    }

    return {
      projectId,
      tempDir,
      dbPath,
      templateVars,
      serviceUrl: service.baseUrl,
      stopService: service.stop,
    };
  } catch (error) {
    await service.stop();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

export async function teardownScenario(setup: Pick<SetupResult, 'tempDir' | 'stopService'>): Promise<void> {
  await setup.stopService();
  if (existsSync(setup.tempDir)) {
    rmSync(setup.tempDir, { recursive: true, force: true });
  }
}
