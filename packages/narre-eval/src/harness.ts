import { existsSync, unlinkSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import {
  initDatabase,
  closeDatabase,
  createProject,
  createArchetype,
  createRelationType,
  createCanvasType,
  createConcept,
  createModule,
  addModuleDirectory,
} from '@netior/core';
import type { SeedContext } from './types.js';

let currentRunId: string | null = null;

export interface SetupResult {
  projectId: string;
  tempDir: string;
  dbPath: string;
  templateVars: Record<string, string>;
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

  initDatabase(dbPath);

  let projectId: string | null = null;
  let templateVars: Record<string, string> = {};

  const ctx: SeedContext = {
    tempDir,
    scenarioDir,
    createProject(data) {
      const project = createProject({ ...data, root_dir: data.root_dir || tempDir });
      projectId = project.id;
      return project;
    },
    createArchetype(data) {
      return createArchetype(data);
    },
    createRelationType(data) {
      return createRelationType(data);
    },
    createCanvasType(data) {
      return createCanvasType(data);
    },
    createConcept(data) {
      return createConcept(data);
    },
    createModule(data) {
      return createModule(data);
    },
    addModuleDirectory(data) {
      return addModuleDirectory(data);
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

  await seedFn(ctx);

  if (!projectId) {
    throw new Error('seed function must call ctx.createProject()');
  }

  return { projectId, tempDir, dbPath, templateVars };
}

export function teardownScenario(tempDir: string): void {
  closeDatabase();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
