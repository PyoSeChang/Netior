import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { pathToFileURL } from 'url';
import type { EvalScenario, EvalOptions, ScenarioManifest, VerifyItem, QualitativeItem, Turn } from './types.js';

// ── Legacy scenario.yaml shape ──

interface ScenarioYaml {
  id: string;
  description: string;
  type: 'single-turn' | 'conversation';
  tags: string[];
  turns: Array<{ role: 'user'; content: string }>;
  verify: EvalScenario['verify'];
  qualitative: EvalScenario['qualitative'];
}

// ── Public API ──

export async function loadScenarios(scenariosDir: string, options: EvalOptions): Promise<EvalScenario[]> {
  const entries = readdirSync(scenariosDir).filter((entry) => {
    const fullPath = join(scenariosDir, entry);
    return statSync(fullPath).isDirectory();
  });

  const scenarios: EvalScenario[] = [];

  for (const dir of entries) {
    const scenarioDir = join(scenariosDir, dir);
    const manifestPath = join(scenarioDir, 'manifest.yaml');
    const legacyPath = join(scenarioDir, 'scenario.yaml');

    let scenario: EvalScenario;
    if (existsSync(manifestPath)) {
      scenario = await loadFromManifest(scenarioDir, manifestPath);
    } else if (existsSync(legacyPath)) {
      scenario = await loadFromLegacy(scenarioDir, legacyPath);
    } else {
      continue;
    }

    scenarios.push(scenario);
  }

  // Apply filters
  let filtered = scenarios;

  if (options.scenario) {
    filtered = filtered.filter((s) => s.id === options.scenario);
  }

  if (options.tag) {
    filtered = filtered.filter((s) => s.tags.includes(options.tag!));
  }

  return filtered;
}

// ── Manifest bundle loader ──

async function loadFromManifest(scenarioDir: string, manifestPath: string): Promise<EvalScenario> {
  const raw = readFileSync(manifestPath, 'utf-8');
  const manifest = parse(raw) as ScenarioManifest;

  // Load turns from turn_plan file
  const turnsPath = join(scenarioDir, manifest.turn_plan.file);
  if (!existsSync(turnsPath)) {
    throw new Error(`Turn plan file not found: ${turnsPath}`);
  }
  const turnsRaw = readFileSync(turnsPath, 'utf-8');
  const turnsYaml = parse(turnsRaw) as { turns: Turn[] };

  // Load verify from assets.verify files
  const verify: VerifyItem[] = [];
  if (manifest.assets.verify) {
    for (const verifyRef of manifest.assets.verify) {
      const verifyPath = join(scenarioDir, verifyRef);
      if (!existsSync(verifyPath)) {
        throw new Error(`Verify file not found: ${verifyPath}`);
      }
      const verifyRaw = readFileSync(verifyPath, 'utf-8');
      const verifyYaml = parse(verifyRaw) as { verify: VerifyItem[] };
      verify.push(...(verifyYaml.verify ?? []));
    }
  }

  // Load rubrics from assets.rubrics files
  const qualitative: QualitativeItem[] = [];
  if (manifest.assets.rubrics) {
    for (const rubricRef of manifest.assets.rubrics) {
      const rubricPath = join(scenarioDir, rubricRef);
      if (!existsSync(rubricPath)) {
        throw new Error(`Rubric file not found: ${rubricPath}`);
      }
      const rubricRaw = readFileSync(rubricPath, 'utf-8');
      const rubricYaml = parse(rubricRaw) as { rubrics: QualitativeItem[] };
      qualitative.push(...(rubricYaml.rubrics ?? []));
    }
  }

  // Dynamic import seed
  const seedFile = manifest.entrypoints.seed;
  const seedPath = join(scenarioDir, seedFile);
  if (!existsSync(seedPath)) {
    throw new Error(`Seed entrypoint not found: ${seedPath}`);
  }
  const seedModule = await import(pathToFileURL(seedPath).href);
  const seed = seedModule.default;

  // Dynamic import responder (optional)
  let responder: EvalScenario['responder'];
  if (manifest.entrypoints.responder) {
    const responderPath = join(scenarioDir, manifest.entrypoints.responder);
    if (!existsSync(responderPath)) {
      throw new Error(`Responder entrypoint not found: ${responderPath}`);
    }
    const responderModule = await import(pathToFileURL(responderPath).href);
    responder = responderModule.default;
  }
  // responder is optional for conversation — only needed when the agent emits cards

  return {
    id: manifest.id,
    description: manifest.description,
    type: manifest.type,
    tags: manifest.labels ?? [],
    turns: turnsYaml.turns ?? [],
    verify,
    qualitative,
    scenarioDir,
    seed,
    responder,
    versionInfo: {
      scenario_version: manifest.scenario_version,
      schema_version: manifest.schema_version,
      supported_agents: manifest.execution?.supported_agents ?? [],
      required_capabilities: manifest.execution?.required_capabilities ?? [],
      created_by: manifest.provenance?.created_by ?? null,
    },
  };
}

// ── Legacy scenario.yaml loader ──

async function loadFromLegacy(scenarioDir: string, yamlPath: string): Promise<EvalScenario> {
  const raw = readFileSync(yamlPath, 'utf-8');
  const yaml = parse(raw) as ScenarioYaml;

  // Dynamic import seed.ts
  const seedPath = join(scenarioDir, 'seed.ts');
  if (!existsSync(seedPath)) {
    throw new Error(`seed.ts not found in ${scenarioDir}`);
  }
  const seedModule = await import(pathToFileURL(seedPath).href);
  const seed = seedModule.default;

  // Dynamic import responder.ts (optional, conversation only)
  let responder: EvalScenario['responder'];
  const responderPath = join(scenarioDir, 'responder.ts');
  if (existsSync(responderPath)) {
    const responderModule = await import(pathToFileURL(responderPath).href);
    responder = responderModule.default;
  }
  // responder is optional for conversation — only needed when the agent emits cards

  return {
    id: yaml.id,
    description: yaml.description,
    type: yaml.type,
    tags: yaml.tags ?? [],
    turns: yaml.turns ?? [],
    verify: yaml.verify ?? [],
    qualitative: yaml.qualitative ?? [],
    scenarioDir,
    seed,
    responder,
    versionInfo: null,
  };
}
