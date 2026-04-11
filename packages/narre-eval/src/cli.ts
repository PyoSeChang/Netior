import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadScenarios } from './loader.js';
import { setupScenario, teardownScenario, setRunId } from './harness.js';
import { runScenario } from './runner/session-runner.js';
import { NarreServerAdapter } from './agents/narre-server.js';
import { gradeScenario, errorMetrics, skippedMetrics, GRADING_VERSION, type GradeContext } from './grader.js';
import { recordResult, recordRunResult, printSummary } from './report.js';
import { findBaselineRunDir, loadBaselineResult, compareResults } from './comparator.js';
import type { EvalOptions, ScenarioResult, EvalScenario, ProvenanceInfo } from './types.js';
import type { EvalAgentAdapter } from './agents/base.js';
import { randomUUID } from 'crypto';

const APPDATA = process.env.APPDATA || process.env.HOME || '.';
const EVAL_DATA_DIR = join(APPDATA, 'netior', 'data', 'eval');
const EXECUTOR_INFO: ProvenanceInfo = {
  id: process.env.NARRE_EVAL_EXECUTOR_ID || 'narre-eval-cli',
  name: process.env.NARRE_EVAL_EXECUTOR_NAME || 'narre-eval CLI',
  source: process.env.NARRE_EVAL_EXECUTOR_SOURCE || 'manual-cli',
};

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]): EvalOptions {
  const args = argv.slice(2);
  const options: EvalOptions = {
    repeat: 1,
    judge: true,
    port: 3199,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--scenario':
        options.scenario = args[++i];
        break;
      case '--tag':
        options.tag = args[++i];
        break;
      case '--repeat':
        options.repeat = parseInt(args[++i], 10);
        break;
      case '--no-judge':
        options.judge = false;
        break;
      case '--port':
        options.port = parseInt(args[++i], 10);
        break;
      case '--baseline':
        options.baseline = args[++i];
        break;
    }
  }

  return options;
}

// ── Compatibility check ──

function checkCompatibility(
  scenario: EvalScenario,
  adapter: EvalAgentAdapter,
): string | null {
  const info = scenario.versionInfo;
  if (!info) return null; // Legacy scenario — no constraints

  if (info.supported_agents.length > 0 && !info.supported_agents.includes(adapter.agentId)) {
    return `agent "${adapter.agentId}" not in supported_agents [${info.supported_agents.join(', ')}]`;
  }

  const missingCaps = info.required_capabilities.filter(
    (cap) => !adapter.capabilities.includes(cap),
  );
  if (missingCaps.length > 0) {
    return `missing required capabilities: [${missingCaps.join(', ')}]`;
  }

  return null;
}

function buildSkippedResult(
  runId: string,
  scenario: EvalScenario,
  adapter: EvalAgentAdapter,
  reason: string,
): ScenarioResult {
  return {
    runId,
    scenarioId: scenario.id,
    timestamp: new Date().toISOString(),
    status: 'skipped',
    agent: adapter.getAgentInfo(),
    scenarioAuthor: scenario.versionInfo?.created_by ?? null,
    executedBy: EXECUTOR_INFO,
    scenarioVersion: scenario.versionInfo?.scenario_version ?? null,
    schemaVersion: scenario.versionInfo?.schema_version ?? null,
    gradingVersion: GRADING_VERSION,
    verifyResults: { passed: 0, total: 0, results: [] },
    judgeScores: [],
    judgeAvg: null,
    durationMs: 0,
    metrics: skippedMetrics(),
    transcript: { scenarioId: scenario.id, sessionId: null, turns: [], totalToolCalls: 0, cardResponseCount: 0, sessionResumeCount: 0 },
    skipReason: reason,
  };
}

// ── Main ──

async function main() {
  const options = parseArgs(process.argv);

  const runId = randomUUID().slice(0, 8);
  setRunId(runId);

  const startedAt = new Date().toISOString();

  const packageRoot = join(__dirname, '..');
  const scenariosDir = join(packageRoot, 'scenarios');
  const runsDir = join(packageRoot, 'runs');

  const scenarios = await loadScenarios(scenariosDir, options);
  if (scenarios.length === 0) {
    console.error('No scenarios found matching filters.');
    process.exit(1);
  }

  const adapter = new NarreServerAdapter();
  const agentInfo = adapter.getAgentInfo();

  // Resolve baseline for comparison
  const baselineRunDir = options.baseline !== undefined
    ? findBaselineRunDir(runsDir, runId, options.baseline || 'latest')
    : findBaselineRunDir(runsDir, runId, 'latest');

  console.log(`\nLoaded ${scenarios.length} scenario(s)  [run: ${runId}]`);
  if (baselineRunDir) console.log(`Baseline: ${baselineRunDir}`);
  if (!options.judge) console.log('LLM judge: disabled');
  if (options.repeat > 1) console.log(`Repeat: ${options.repeat}x`);

  const allResults: ScenarioResult[] = [];

  for (let rep = 0; rep < options.repeat; rep++) {
    if (options.repeat > 1) console.log(`\n--- Run ${rep + 1}/${options.repeat} ---`);

    for (const scenario of scenarios) {
      console.log(`\n> Running: ${scenario.id} — ${scenario.description}`);

      // Check compatibility before execution
      const skipReason = checkCompatibility(scenario, adapter);
      if (skipReason) {
        console.log(`  SKIPPED: ${skipReason}`);
        const skipped = buildSkippedResult(runId, scenario, adapter, skipReason);
        recordResult(scenario.scenarioDir, skipped);
        allResults.push(skipped);
        continue;
      }

      let setup: Awaited<ReturnType<typeof setupScenario>> | null = null;

      try {
        console.log('  Setting up scenario...');
        setup = await setupScenario(scenario.scenarioDir, scenario.seed, scenario.id);

        console.log('  Starting narre-server...');
        await adapter.setup({
          runId,
          port: options.port,
          dbPath: setup.dbPath,
          dataDir: EVAL_DATA_DIR,
          serviceUrl: setup.serviceUrl,
          env: {},
        });

        console.log('  Sending turns...');
        const startTime = Date.now();
        const transcript = await runScenario(adapter, scenario, setup.projectId, setup.serviceUrl, setup.templateVars);
        const durationMs = Date.now() - startTime;

        console.log(`  Completed in ${(durationMs / 1000).toFixed(1)}s (${transcript.totalToolCalls} tool calls)`);

        console.log('  Grading...');
        const gradeCtx: GradeContext = {
          runId,
          agent: agentInfo,
          durationMs,
          versionInfo: scenario.versionInfo,
          executedBy: EXECUTOR_INFO,
        };
        const result = await gradeScenario(
          scenario.id,
          transcript,
          scenario.verify,
          scenario.qualitative,
          setup.projectId,
          setup.serviceUrl,
          options.judge,
          gradeCtx,
        );

        // Baseline comparison
        if (baselineRunDir) {
          const baseline = loadBaselineResult(baselineRunDir, scenario.id);
          if (baseline) {
            result.comparison = compareResults(result, baseline);
          }
        }

        recordResult(scenario.scenarioDir, result);
        allResults.push(result);
      } catch (error) {
        const errResult: ScenarioResult = {
          runId,
          scenarioId: scenario.id,
            timestamp: new Date().toISOString(),
            status: 'error',
            agent: agentInfo,
            scenarioAuthor: scenario.versionInfo?.created_by ?? null,
            executedBy: EXECUTOR_INFO,
            scenarioVersion: scenario.versionInfo?.scenario_version ?? null,
            schemaVersion: scenario.versionInfo?.schema_version ?? null,
          gradingVersion: GRADING_VERSION,
          verifyResults: { passed: 0, total: 0, results: [] },
          judgeScores: [],
          judgeAvg: null,
          durationMs: 0,
          metrics: errorMetrics(),
          transcript: { scenarioId: scenario.id, sessionId: null, turns: [], totalToolCalls: 0, cardResponseCount: 0, sessionResumeCount: 0 },
          error: (error as Error).message,
        };
        recordResult(scenario.scenarioDir, errResult);
        allResults.push(errResult);
        console.error(`  ERROR: ${(error as Error).message}`);
      } finally {
        await adapter.teardown();
        if (setup) {
          await teardownScenario(setup);
        }
      }
    }
  }

  // Write run-level output to packages/narre-eval/runs/ (intentionally package-local)
  const finishedAt = new Date().toISOString();
  recordRunResult(packageRoot, {
    runId,
    startedAt,
    finishedAt,
    agent: agentInfo,
    executedBy: EXECUTOR_INFO,
    scenarioIds: allResults.map((r) => r.scenarioId),
  }, allResults);

  printSummary(allResults);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
