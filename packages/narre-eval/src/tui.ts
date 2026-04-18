import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface, emitKeypressEvents } from 'node:readline';
import type { Interface as ReadlineInterface, Key } from 'node:readline';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { parse, stringify as stringifyYaml } from 'yaml';
import { runCodexTextTask } from './codex-exec.js';
import { normalizeScenarioExecution } from './execution.js';
import type {
  EvalProviderId,
  EvalTesterId,
  RunSpec,
  ScenarioExecutionConfig,
  ScenarioExecutionManifest,
  ScenarioLifecycle,
  ScenarioResult,
  ScenarioType,
  Transcript,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const scenariosDir = join(packageRoot, 'scenarios');
const runsDir = join(packageRoot, 'runs');

const TESTER_OPTIONS: Array<{ id: EvalTesterId; label: string; description: string }> = [
  {
    id: 'codex-tester',
    label: 'codex-tester',
    description: 'Domain-aware user persona with Codex-based tester reasoning',
  },
  {
    id: 'approval-sensitive',
    label: 'approval-sensitive',
    description: 'More conservative on approval and destructive transitions',
  },
  {
    id: 'conversation-tester',
    label: 'conversation-tester',
    description: 'Prefers interview and back-and-forth clarification',
  },
  {
    id: 'card-responder',
    label: 'card-responder',
    description: 'Minimal automatic card responder',
  },
  {
    id: 'basic-turn-runner',
    label: 'basic-turn-runner',
    description: 'Legacy lightweight tester',
  },
];

const PROVIDER_OPTIONS: Array<{ id: EvalProviderId; label: string }> = [
  { id: 'codex', label: 'codex' },
  { id: 'claude', label: 'claude' },
  { id: 'openai', label: 'openai' },
];

type FocusPane = 'scenarios' | 'runs' | 'content';
type ViewTab = 'summary' | 'report' | 'transcript' | 'narreTester' | 'findings' | 'scenario' | 'operator';

interface TuiState {
  scenarios: TuiScenarioSummary[];
  scenarioIndex: number;
  runRefs: TuiRunRef[];
  runIndex: number;
  provider: EvalProviderId;
  tester: EvalTesterId;
  judge: boolean;
  operatorHistory: OperatorChatTurn[];
  operatorHistoryScopeKey: string | null;
  operatorSessionId: string | null;
  operatorGeneratedSelectionKey: string | null;
  operatorGeneratedCandidateKey: string | null;
  operatorGeneratedResultKey: string | null;
  operatorGeneratedResultMessage: string | null;
  workspaceStatusLines: string[];
  focusPane: FocusPane;
  activeView: ViewTab;
  contentScroll: number;
  operatorComposeMode: boolean;
  operatorInput: string;
  statusMessage: string;
  quitting: boolean;
  busy: boolean;
}

interface OperatorChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface LoadedArtifacts {
  result?: ScenarioResult;
  reportMarkdown?: string;
  transcriptMarkdown?: string;
  transcript?: Transcript;
}

interface OperatorGeneratedArtifact {
  key: string;
  scope: 'run' | 'scenario';
  name: string;
  path: string;
  content: string;
}

interface ScenarioSourceBundle {
  manifest?: string;
  turns?: string;
  verifyFiles: Array<{ path: string; content: string }>;
  rubricFiles: Array<{ path: string; content: string }>;
}

interface HarnessSourceBundle {
  files: Array<{ path: string; content: string }>;
}

interface TuiRunRef {
  kind: 'latest' | 'history';
  label: string;
  runDir: string;
}

interface TuiScenarioSummary {
  id: string;
  title?: string;
  description: string;
  type: ScenarioType;
  labels: string[];
  lifecycle: ScenarioLifecycle;
  execution: ScenarioExecutionConfig;
  verifyNames: string[];
  rubricNames: string[];
}

interface TuiManifest {
  id: string;
  title?: string;
  description: string;
  type: ScenarioType;
  lifecycle: ScenarioLifecycle;
  labels?: string[];
  execution?: ScenarioExecutionManifest;
  assets?: {
    verify?: string[];
    rubrics?: string[];
  };
}

interface TuiLegacyScenario {
  id: string;
  description: string;
  type: ScenarioType;
  tags?: string[];
  verify?: Array<{ name?: string }>;
  qualitative?: Array<{ rubric?: string }>;
}

async function main(): Promise<void> {
  const scenarios = loadScenarioSummaries(scenariosDir);
  if (scenarios.length === 0) {
    console.error('No scenarios found.');
    return;
  }

  const initialScenarioIndex = scenarios.findIndex((scenario) => listRunRefsForScenario(scenario.id).length > 0);
  const scenarioIndex = initialScenarioIndex >= 0 ? initialScenarioIndex : 0;
  const initialScenario = scenarios[scenarioIndex];
  const state: TuiState = {
    scenarios,
    scenarioIndex,
    runRefs: listRunRefsForScenario(initialScenario.id),
    runIndex: 0,
    provider: initialScenario.execution.provider,
    tester: initialScenario.execution.tester,
    judge: true,
    operatorHistory: [],
    operatorHistoryScopeKey: null,
    operatorSessionId: null,
    operatorGeneratedSelectionKey: null,
    operatorGeneratedCandidateKey: null,
    operatorGeneratedResultKey: null,
    operatorGeneratedResultMessage: null,
    workspaceStatusLines: [],
    focusPane: 'scenarios',
    activeView: 'summary',
    contentScroll: 0,
    operatorComposeMode: false,
    operatorInput: '',
    statusMessage: 'Arrow keys move, 1-7 switches views, e runs eval, i opens inline operator compose, q quits.',
    quitting: false,
    busy: false,
  };

  const rl = createInterface({ input, output });
  emitKeypressEvents(input, rl);
  if (input.isTTY) {
    input.setRawMode(true);
  }
  if (output.isTTY) {
    output.write('\x1b[?1049h\x1b[?25l');
  }

  const cleanup = () => {
    if (input.isTTY) {
      input.setRawMode(false);
    }
    if (output.isTTY) {
      output.write('\x1b[?25h\x1b[?1049l');
    }
    rl.close();
  };

  syncState(state);
  refreshWorkspaceStatus(state);
  renderDashboard(state);

  try {
    while (!state.quitting) {
      const key = await readKey();
      await handleKey(rl, state, key);
      if (state.quitting) {
        break;
      }
      syncState(state);
      renderDashboard(state);
    }
  } finally {
    cleanup();
  }
}

function syncState(state: TuiState): void {
  if (state.scenarios.length === 0) {
    state.scenarioIndex = 0;
    state.runRefs = [];
    state.runIndex = 0;
    return;
  }

  state.scenarioIndex = clamp(state.scenarioIndex, 0, state.scenarios.length - 1);
  const scenario = state.scenarios[state.scenarioIndex];
  const currentRunLabel = state.runRefs[state.runIndex]?.label;
  state.runRefs = listRunRefsForScenario(scenario.id);
  if (state.runRefs.length === 0) {
    state.runIndex = 0;
  } else if (currentRunLabel) {
    const preservedIndex = state.runRefs.findIndex((item) => item.label === currentRunLabel);
    state.runIndex = preservedIndex >= 0 ? preservedIndex : clamp(state.runIndex, 0, state.runRefs.length - 1);
  } else {
    state.runIndex = clamp(state.runIndex, 0, state.runRefs.length - 1);
  }
  state.contentScroll = Math.max(0, state.contentScroll);
  hydrateOperatorHistoryForSelection(state);
  hydrateOperatorGeneratedSelection(state);
}

async function handleKey(
  rl: ReadlineInterface,
  state: TuiState,
  key: Key | null,
): Promise<void> {
  if (state.busy || !key) {
    return;
  }

  if (state.operatorComposeMode) {
    await handleOperatorComposeKey(rl, state, key);
    return;
  }

  if (key.ctrl && key.name === 'c') {
    state.quitting = true;
    return;
  }

  switch (key.name) {
    case 'q':
      state.quitting = true;
      return;
    case 'left':
      focusPrevPane(state);
      return;
    case 'right':
    case 'tab':
      focusNextPane(state);
      return;
    case 'up':
      moveSelection(state, -1);
      return;
    case 'down':
      moveSelection(state, 1);
      return;
    case 'pageup':
      state.contentScroll = Math.max(0, state.contentScroll - 15);
      return;
    case 'pagedown':
      state.contentScroll += 15;
      return;
    case 'home':
      state.contentScroll = 0;
      return;
    case 'end':
      state.contentScroll += 1000;
      return;
  }

  switch (key.sequence) {
    case '1':
      switchView(state, 'summary');
      return;
    case '2':
      switchView(state, 'report');
      return;
    case '3':
      switchView(state, 'transcript');
      return;
    case '4':
      switchView(state, 'narreTester');
      return;
    case '5':
      switchView(state, 'findings');
      return;
    case '6':
      switchView(state, 'scenario');
      return;
    case '7':
      switchView(state, 'operator');
      return;
    case 'e':
      await withBusy(state, async () => {
        await runEvalFromTui(rl, state);
      });
      return;
    case 'r':
      state.scenarios = loadScenarioSummaries(scenariosDir);
      refreshWorkspaceStatus(state);
      state.statusMessage = 'Scenarios and run history refreshed.';
      return;
    case 't':
      await withBusy(state, async () => {
        await promptTesterSelection(rl, state);
      });
      return;
    case 'p':
      await withBusy(state, async () => {
        await promptProviderSelection(rl, state);
      });
      return;
    case 'j':
      state.judge = !state.judge;
      state.statusMessage = `Judge is now ${state.judge ? 'on' : 'off'}.`;
      return;
    case 'i':
      await withBusy(state, async () => {
        openOperatorCompose(state);
      });
      return;
  }
}

function switchView(state: TuiState, view: ViewTab): void {
  state.activeView = view;
  state.contentScroll = 0;
}

function openOperatorCompose(state: TuiState): void {
  state.activeView = 'operator';
  state.focusPane = 'content';
  state.contentScroll = 0;
  state.operatorComposeMode = true;
  state.statusMessage = 'Operator compose mode: type in the pane, Enter sends, Esc cancels.';
}

async function handleOperatorComposeKey(
  rl: ReadlineInterface,
  state: TuiState,
  key: Key,
): Promise<void> {
  if (key.ctrl && key.name === 'c') {
    state.quitting = true;
    return;
  }

  switch (key.name) {
    case 'escape':
      state.operatorComposeMode = false;
      state.statusMessage = 'Operator compose cancelled.';
      return;
    case 'return':
    case 'enter':
      if (!state.operatorInput.trim()) {
        state.operatorComposeMode = false;
        state.statusMessage = 'Operator compose cancelled.';
        return;
      }
      await withBusy(state, async () => {
        await executeOperatorInput(rl, state);
      });
      return;
    case 'backspace':
      state.operatorInput = state.operatorInput.slice(0, -1);
      state.statusMessage = 'Editing operator message...';
      return;
  }

  if (key.ctrl && key.name === 'u') {
    state.operatorInput = '';
    state.statusMessage = 'Operator input cleared.';
    return;
  }

  const sequence = key.sequence ?? '';
  if (isPrintableInput(sequence, key)) {
    state.operatorInput += sequence;
    state.statusMessage = 'Editing operator message...';
  }
}

async function withBusy(state: TuiState, fn: () => Promise<void>): Promise<void> {
  state.busy = true;
  try {
    await fn();
  } finally {
    state.busy = false;
  }
}

function moveSelection(state: TuiState, delta: number): void {
  if (state.focusPane === 'scenarios') {
    const nextIndex = clamp(state.scenarioIndex + delta, 0, state.scenarios.length - 1);
    if (nextIndex !== state.scenarioIndex) {
      state.scenarioIndex = nextIndex;
      state.runIndex = 0;
      const scenario = state.scenarios[state.scenarioIndex];
      state.provider = scenario.execution.provider;
      state.tester = scenario.execution.tester;
      state.statusMessage = `Selected scenario: ${scenario.id}`;
    }
    return;
  }

  if (state.focusPane === 'runs') {
    if (state.runRefs.length === 0) {
      return;
    }
    state.runIndex = clamp(state.runIndex + delta, 0, state.runRefs.length - 1);
    state.statusMessage = `Selected run: ${state.runRefs[state.runIndex]?.label ?? 'none'}`;
    return;
  }

  state.contentScroll = Math.max(0, state.contentScroll + delta);
}

function focusPrevPane(state: TuiState): void {
  if (state.focusPane === 'content') {
    state.focusPane = 'runs';
  } else if (state.focusPane === 'runs') {
    state.focusPane = 'scenarios';
  }
}

function focusNextPane(state: TuiState): void {
  if (state.focusPane === 'scenarios') {
    state.focusPane = 'runs';
  } else if (state.focusPane === 'runs') {
    state.focusPane = 'content';
  }
}

function renderDashboard(state: TuiState): void {
  const scenario = getSelectedScenario(state);
  const runRef = state.runRefs[state.runIndex];
  const artifacts = runRef ? loadArtifactsForRun(runRef, scenario.id) : {};

  const width = Math.max(output.columns || 120, 96);
  const height = Math.max(output.rows || 40, 26);
  const bodyHeight = height - 6;

  const leftWidth = 32;
  const middleWidth = 28;
  const rightWidth = Math.max(width - leftWidth - middleWidth - 4, 28);

  const scenarioLines = state.scenarios.map((item, index) => {
    const selected = index === state.scenarioIndex;
    const marker = selected ? '>' : ' ';
    const focus = state.focusPane === 'scenarios' && selected ? '*' : ' ';
    const label = item.title ? `${item.id} (${item.title})` : item.id;
    return `${focus}${marker} ${label}`;
  });

  const runLines = state.runRefs.length > 0
    ? state.runRefs.map((item, index) => {
      const selected = index === state.runIndex;
      const marker = selected ? '>' : ' ';
      const focus = state.focusPane === 'runs' && selected ? '*' : ' ';
      return `${focus}${marker} ${item.label}`;
    })
    : ['(no runs yet)'];

  const contentLines = buildContentLines(state, scenario, artifacts);
  const leftBox = renderBox(formatPaneTitle('Scenarios', state.focusPane === 'scenarios'), scenarioLines, leftWidth, bodyHeight);
  const middleBox = renderBox(formatPaneTitle('Runs', state.focusPane === 'runs'), runLines, middleWidth, bodyHeight);
  const rightBox = renderBox(formatPaneTitle('Content', state.focusPane === 'content'), contentLines, rightWidth, bodyHeight);

  const headerLines = [
    'narre-eval TUI',
    [
      `scenario=${scenario.id}`,
      `run=${runRef?.label ?? 'none'}`,
      `provider=${state.provider}`,
      `tester=${state.tester}`,
      `judge=${state.judge ? 'on' : 'off'}`,
      `view=${state.activeView}`,
    ].join('  '),
  ];

  const footerLines = [
    state.statusMessage || 'Ready.',
    `Focus pane: ${state.focusPane}`,
    state.operatorComposeMode
      ? `Operator draft: ${state.operatorInput || '(empty)'}`
      : 'Press i to start inline operator compose.',
    'Arrows move, Tab changes pane, 1-7 tabs, e run, t tester, p provider, j judge, i operator, r refresh, q quit',
  ];

  const frameLines: string[] = [];
  for (const line of headerLines) {
    frameLines.push(padRight(stripAnsi(line), width));
  }
  frameLines.push(`${leftBox.top} ${middleBox.top} ${rightBox.top}`);
  for (let index = 0; index < bodyHeight - 2; index += 1) {
    frameLines.push(`${leftBox.body[index]} ${middleBox.body[index]} ${rightBox.body[index]}`);
  }
  frameLines.push(`${leftBox.bottom} ${middleBox.bottom} ${rightBox.bottom}`);
  for (const line of footerLines) {
    frameLines.push(padRight(line, width));
  }
  while (frameLines.length < height) {
    frameLines.push(' '.repeat(width));
  }

  output.write(`\x1b[H${frameLines.map((line) => padRight(line, width)).join('\n')}`);
}

function buildContentLines(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
): string[] {
  let markdown = '';

  switch (state.activeView) {
    case 'summary':
      markdown = renderSummaryMarkdown(scenario, state, artifacts);
      break;
    case 'report':
      markdown = artifacts.reportMarkdown ?? 'report.md not found for this run.';
      break;
    case 'transcript':
      markdown = artifacts.transcriptMarkdown ?? 'transcript.md not found for this run.';
      break;
    case 'narreTester':
      markdown = artifacts.transcript
        ? renderNarreTesterTranscript(artifacts.transcript)
        : 'transcript.json not found for this run.';
      break;
    case 'findings':
      markdown = artifacts.result
        ? renderFindingsMarkdown(artifacts.result, artifacts.transcript)
        : 'result.json not found for this run.';
      break;
    case 'scenario':
      markdown = renderScenarioDetailMarkdown(scenario);
      break;
    case 'operator':
      markdown = renderOperatorViewMarkdown(state, scenario, artifacts);
      break;
  }

  return markdown.split(/\r?\n/).slice(state.contentScroll);
}

function renderSummaryMarkdown(
  scenario: TuiScenarioSummary,
  state: TuiState,
  artifacts: LoadedArtifacts,
): string {
  const result = artifacts.result;
  const transcript = artifacts.transcript;
  const findings = result?.analysis.toolUse.findings ?? [];
  const failedChecks = result?.verifyResults.results.filter((item) => !item.passed) ?? [];

  return [
    '# Summary',
    '',
    `- Scenario: ${scenario.id}`,
    `- Description: ${scenario.description}`,
    `- Target skill: ${scenario.execution.target_skill ?? '(none)'}`,
    `- Provider: ${state.provider}`,
    `- Tester: ${state.tester}`,
    `- Judge: ${state.judge ? 'on' : 'off'}`,
    '',
    `- Status: ${result?.status ?? '(no run selected)'}`,
    result ? `- Verify: ${result.verifyResults.passed}/${result.verifyResults.total}` : '',
    result ? `- Judge avg: ${result.judgeAvg != null ? result.judgeAvg.toFixed(1) : '-'}` : '',
    transcript ? `- Tool calls: ${transcript.totalToolCalls}` : '',
    transcript ? `- Tester interactions: ${transcript.testerInteractionCount}` : '',
    '',
    '## Findings',
    '',
    ...(findings.length > 0 ? findings.map((item) => `- [${item.severity}] ${item.kind}: ${item.message}`) : ['- none']),
    '',
    '## Failed verify items',
    '',
    ...(failedChecks.length > 0
      ? failedChecks.map((item) => `- ${item.name}${item.detail ? `: ${item.detail}` : ''}`)
      : ['- none']),
    '',
  ].filter(Boolean).join('\n');
}

function renderOperatorViewMarkdown(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
): string {
  const lines: string[] = [];
  const transcript = artifacts.transcript;
  const generatedArtifacts = listOperatorGeneratedArtifactsDetailed(state, scenario.id);
  const selectedGeneratedArtifact = generatedArtifacts.find((item) => item.key === state.operatorGeneratedSelectionKey) ?? null;
  lines.push('# Codex Operator');
  lines.push('');
  lines.push('- Role: scenario management, harness analysis, next-action suggestions');
  lines.push('- Press `i` to start inline compose in this pane.');
  lines.push(`- Current scenario: ${scenario.id}`);
  lines.push(`- Selected run: ${state.runRefs[state.runIndex]?.label ?? 'none'}`);
  lines.push(`- Scope key: ${state.operatorHistoryScopeKey ?? '(none)'}`);
  lines.push(`- Codex session: ${state.operatorSessionId ?? '(none)'}`);
  lines.push('');

  if (artifacts.result) {
    lines.push('## Current run summary');
    lines.push('');
    lines.push(`- Status: ${artifacts.result.status}`);
    lines.push(`- Verify: ${artifacts.result.verifyResults.passed}/${artifacts.result.verifyResults.total}`);
    lines.push(`- Judge avg: ${artifacts.result.judgeAvg != null ? artifacts.result.judgeAvg.toFixed(1) : '-'}`);
    lines.push(`- Findings: ${artifacts.result.analysis.toolUse.findings.map((item) => item.kind).join(', ') || '(none)'}`);
    if (transcript) {
      lines.push(`- Tool calls: ${transcript.totalToolCalls}`);
      lines.push(`- Tester interactions: ${transcript.testerInteractionCount}`);
    }
    lines.push('');
  }

  lines.push('## Workspace status');
  lines.push('');
  if (state.workspaceStatusLines.length === 0) {
    lines.push('- clean');
  } else {
    for (const line of state.workspaceStatusLines) {
      lines.push(`- ${line}`);
    }
  }
  lines.push('');

  lines.push('## Generated artifacts');
  lines.push('');
  if (generatedArtifacts.length === 0) {
    lines.push('- none');
  } else {
    generatedArtifacts.forEach((item, index) => {
      const currentMarker = item.key === state.operatorGeneratedSelectionKey ? '*' : ' ';
      const candidateMarker = item.key === state.operatorGeneratedCandidateKey ? 'C' : ' ';
      lines.push(`- ${currentMarker}${candidateMarker} ${index + 1}. [${item.scope}] ${item.name}`);
    });
  }
  lines.push('');

  lines.push('## Selected generated artifact');
  lines.push('');
  if (!selectedGeneratedArtifact) {
    lines.push('- none');
  } else {
    lines.push(`- name: ${selectedGeneratedArtifact.name}`);
    lines.push(`- scope: ${selectedGeneratedArtifact.scope}`);
    lines.push(`- path: ${selectedGeneratedArtifact.path}`);
    if (selectedGeneratedArtifact.key === state.operatorGeneratedCandidateKey) {
      lines.push('- apply candidate: yes');
    }
    if (
      selectedGeneratedArtifact.key === state.operatorGeneratedResultKey
      && state.operatorGeneratedResultMessage
    ) {
      lines.push(`- last action: ${state.operatorGeneratedResultMessage}`);
    }
    lines.push('');
    lines.push(trimBlock(selectedGeneratedArtifact.content, 5000));
  }
  lines.push('');

  lines.push('## Conversation');
  lines.push('');
  if (state.operatorHistory.length === 0) {
    lines.push('- No operator conversation yet.');
  } else {
    for (const turn of state.operatorHistory) {
      lines.push(`### ${turn.role === 'user' ? 'User' : 'Codex'}`);
      lines.push('');
      lines.push(turn.content.trim());
      lines.push('');
    }
  }

  lines.push('');
  lines.push('## Composer');
  lines.push('');
  lines.push(`- mode: ${state.operatorComposeMode ? 'active' : 'idle'}`);
  lines.push(`- draft: ${state.operatorInput || '(empty)'}`);
  lines.push('- controls: i start, Enter send, Esc cancel, Backspace delete');
  lines.push('- local commands: /help, /runs, /select-run <...>, /generated, /open-generated <...>, /validate-generated <...>, /candidate-generated <...>, /apply-generated <...>, /apply-candidate, /rerun, /view <tab>, /tester <id>, /provider <id>, /judge on|off, /new-session, /draft-scenario-patch, /draft-scenario-diff, /draft-harness-patch, /draft-harness-diff, /save-note, /clear');

  return lines.join('\n');
}

async function runEvalFromTui(
  rl: ReadlineInterface,
  state: TuiState,
): Promise<void> {
  const scenario = getSelectedScenario(state);
  state.statusMessage = `Running eval for ${scenario.id}...`;
  renderDashboard(state);

  const runSpecDir = mkdtempSync(join(tmpdir(), 'narre-eval-tui-'));
  const runSpecPath = join(runSpecDir, 'run-spec.yaml');

  const runSpec: RunSpec = {
    run_id: 'auto',
    scenario_id: scenario.id,
    target_skill: scenario.execution.target_skill,
    agent_id: scenario.execution.agent_id,
    provider: state.provider,
    tester: state.tester,
    execution_mode: scenario.execution.execution_mode,
    analysis_targets: scenario.execution.analysis_targets,
    judge: state.judge,
    provider_settings: scenario.execution.provider_settings,
    tester_settings: scenario.execution.tester_settings,
  };

  writeFileSync(runSpecPath, stringifyYaml(runSpec), 'utf-8');

  try {
    await promptPauseRawMode(rl, async () => {
      console.clear();
      console.log(chalk.bold(`Running eval: ${scenario.id}`));
      console.log(`- provider: ${state.provider}`);
      console.log(`- tester: ${state.tester}`);
      console.log(`- judge: ${state.judge ? 'on' : 'off'}`);
      console.log('');
      console.log(chalk.gray('Streaming CLI output below.\n'));
      await spawnEvalCli(runSpecPath);
      await question(rl, '\nRun finished. Press Enter to return to the dashboard. ');
    });

    state.runRefs = listRunRefsForScenario(scenario.id);
    state.runIndex = 0;
    state.statusMessage = `Eval finished for ${scenario.id}.`;
  } catch (error) {
    state.statusMessage = `Eval failed: ${(error as Error).message}`;
  } finally {
    rmSync(runSpecDir, { recursive: true, force: true });
  }
}

async function promptTesterSelection(
  rl: ReadlineInterface,
  state: TuiState,
): Promise<void> {
  const choice = await promptSelect(
    rl,
    'Select tester',
    TESTER_OPTIONS.map((item) => `${item.label} - ${item.description}`),
  );

  if (choice == null) {
    state.statusMessage = 'Tester selection cancelled.';
    return;
  }

  state.tester = TESTER_OPTIONS[choice].id;
  state.statusMessage = `Tester set to ${state.tester}.`;
}

async function promptProviderSelection(
  rl: ReadlineInterface,
  state: TuiState,
): Promise<void> {
  const choice = await promptSelect(
    rl,
    'Select provider',
    PROVIDER_OPTIONS.map((item) => item.label),
  );

  if (choice == null) {
    state.statusMessage = 'Provider selection cancelled.';
    return;
  }

  state.provider = PROVIDER_OPTIONS[choice].id;
  state.statusMessage = `Provider set to ${state.provider}.`;
}

async function executeOperatorInput(
  rl: ReadlineInterface,
  state: TuiState,
): Promise<void> {
  const scenario = getSelectedScenario(state);
  const runRef = state.runRefs[state.runIndex];
  const artifacts = runRef ? loadArtifactsForRun(runRef, scenario.id) : {};
  const message = state.operatorInput.trim();
  state.operatorHistory.push({ role: 'user', content: message });
  state.operatorInput = '';
  state.operatorComposeMode = false;
  state.statusMessage = 'Waiting for Codex operator response...';
  saveOperatorHistoryForSelection(state);
  renderDashboard(state);

  if (message.startsWith('/')) {
    const response = await handleOperatorCommand(rl, state, message, scenario, artifacts);
    state.operatorHistory.push({ role: 'assistant', content: response });
    saveOperatorHistoryForSelection(state);
    state.activeView = 'operator';
    state.contentScroll = 0;
    return;
  }

  try {
    const response = await runCodexTextTask({
      prompt: buildOperatorPrompt(state.operatorHistory, scenario, state, artifacts),
      model: process.env.NARRE_EVAL_OPERATOR_CODEX_MODEL,
      workingDirectory: packageRoot,
      sessionId: state.operatorSessionId ?? undefined,
    });
    state.operatorSessionId = response.sessionId ?? state.operatorSessionId;
    saveOperatorSessionForSelection(state);
    state.operatorHistory.push({ role: 'assistant', content: response.text.trim() });
    saveOperatorHistoryForSelection(state);
    state.activeView = 'operator';
    state.contentScroll = 0;
    state.statusMessage = 'Codex operator response received.';
  } catch (error) {
    const messageText = `Codex operator failed: ${(error as Error).message}`;
    state.operatorHistory.push({ role: 'assistant', content: messageText });
    saveOperatorHistoryForSelection(state);
    state.statusMessage = messageText;
  }
}

async function handleOperatorCommand(
  rl: ReadlineInterface,
  state: TuiState,
  message: string,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
): Promise<string> {
  const [command, ...rest] = message.trim().split(/\s+/);
  switch (command) {
    case '/help':
      state.statusMessage = 'Operator command help shown.';
      return [
        'Operator local commands:',
        '- /help',
        '- /runs',
        '- /select-run <latest|index|label>',
        '- /generated',
        '- /open-generated <index|name>',
        '- /validate-generated <index|name>',
        '- /candidate-generated <index|name>',
        '- /apply-generated <index|name>',
        '- /apply-candidate',
        '- /rerun',
        '- /view <summary|report|transcript|narre|findings|scenario|operator>',
        '- /tester <id>',
        '- /provider <id>',
        '- /judge on|off',
        '- /new-session',
        '- /draft-scenario-patch [name]',
        '- /draft-scenario-diff [name]',
        '- /draft-harness-patch [name]',
        '- /draft-harness-diff [name]',
        '- /save-note [name]',
        '- /clear',
      ].join('\n');
    case '/runs':
      state.statusMessage = 'Available runs listed.';
      return renderOperatorRunsList(state);
    case '/select-run': {
      const selection = selectOperatorRun(state, rest.join(' '));
      if (!selection.ok) {
        state.statusMessage = selection.message;
        return selection.message;
      }
      state.runIndex = selection.runIndex;
      state.activeView = 'summary';
      state.contentScroll = 0;
      hydrateOperatorHistoryForSelection(state);
      state.statusMessage = selection.message;
      return selection.message;
    }
    case '/generated':
      state.statusMessage = 'Generated operator artifacts listed.';
      return renderOperatorGeneratedArtifactsList(state, scenario.id);
    case '/open-generated': {
      const selected = selectOperatorGeneratedArtifact(state, scenario.id, rest.join(' '));
      if (!selected.ok) {
        state.statusMessage = selected.message;
        return selected.message;
      }
      state.operatorGeneratedSelectionKey = selected.artifact.key;
      state.statusMessage = selected.message;
      return selected.message;
    }
    case '/validate-generated': {
      const selected = selectOperatorGeneratedArtifact(state, scenario.id, rest.join(' '));
      if (!selected.ok) {
        state.statusMessage = selected.message;
        return selected.message;
      }
      const result = await validateOperatorGeneratedArtifact(selected.artifact);
      state.statusMessage = result;
      return result;
    }
    case '/candidate-generated': {
      const selected = selectOperatorGeneratedArtifact(state, scenario.id, rest.join(' '));
      if (!selected.ok) {
        state.statusMessage = selected.message;
        return selected.message;
      }
      state.operatorGeneratedCandidateKey = selected.artifact.key;
      state.operatorGeneratedSelectionKey = selected.artifact.key;
      state.statusMessage = `Marked ${selected.artifact.name} as apply candidate.`;
      return `Marked ${selected.artifact.name} as apply candidate.`;
    }
    case '/apply-generated': {
      const selected = selectOperatorGeneratedArtifact(state, scenario.id, rest.join(' '));
      if (!selected.ok) {
        state.statusMessage = selected.message;
        return selected.message;
      }
      const result = await applyOperatorGeneratedArtifact(selected.artifact);
      state.operatorGeneratedSelectionKey = selected.artifact.key;
      state.operatorGeneratedResultKey = selected.artifact.key;
      state.operatorGeneratedResultMessage = result;
      refreshWorkspaceStatus(state);
      state.statusMessage = result;
      return result;
    }
    case '/apply-candidate': {
      const artifacts = listOperatorGeneratedArtifactsDetailed(state, scenario.id);
      const candidate = artifacts.find((item) => item.key === state.operatorGeneratedCandidateKey);
      if (!candidate) {
        state.statusMessage = 'No apply candidate selected.';
        return 'No apply candidate selected. Use /candidate-generated <index|name> first.';
      }
      const result = await applyOperatorGeneratedArtifact(candidate);
      state.operatorGeneratedSelectionKey = candidate.key;
      state.operatorGeneratedResultKey = candidate.key;
      state.operatorGeneratedResultMessage = result;
      refreshWorkspaceStatus(state);
      state.statusMessage = result;
      return result;
    }
    case '/rerun':
      await runEvalFromTui(rl, state);
      refreshWorkspaceStatus(state);
      state.statusMessage = 'Operator rerun completed.';
      return 'Triggered rerun with the current scenario/provider/tester/judge settings.';
    case '/view': {
      const tab = normalizeOperatorView(rest[0]);
      if (!tab) {
        state.statusMessage = 'Unknown view tab.';
        return 'Unknown view. Use one of: summary, report, transcript, narre, findings, scenario, operator.';
      }
      state.activeView = tab;
      state.contentScroll = 0;
      state.statusMessage = `Switched view to ${tab}.`;
      return `Switched active view to ${tab}.`;
    }
    case '/tester': {
      const tester = normalizeOperatorTester(rest[0]);
      if (!tester) {
        state.statusMessage = 'Unknown tester id.';
        return `Unknown tester. Valid values: ${TESTER_OPTIONS.map((item) => item.id).join(', ')}`;
      }
      state.tester = tester;
      state.statusMessage = `Tester set to ${tester}.`;
      return `Tester changed to ${tester}.`;
    }
    case '/provider': {
      const provider = normalizeOperatorProvider(rest[0]);
      if (!provider) {
        state.statusMessage = 'Unknown provider id.';
        return `Unknown provider. Valid values: ${PROVIDER_OPTIONS.map((item) => item.id).join(', ')}`;
      }
      state.provider = provider;
      state.statusMessage = `Provider set to ${provider}.`;
      return `Provider changed to ${provider}.`;
    }
    case '/judge': {
      const value = rest[0]?.toLowerCase();
      if (value !== 'on' && value !== 'off') {
        state.statusMessage = 'Judge command expects on/off.';
        return 'Usage: /judge on|off';
      }
      state.judge = value === 'on';
      state.statusMessage = `Judge is now ${value}.`;
      return `Judge toggled ${value}.`;
    }
    case '/new-session':
      state.operatorSessionId = null;
      saveOperatorSessionForSelection(state);
      state.statusMessage = 'Started a fresh Codex operator session for the current selection.';
      return 'Cleared the stored Codex thread id. The next operator message will start a fresh session.';
    case '/draft-scenario-patch':
      return draftScenarioPatch(state, scenario, artifacts, rest.join(' '));
    case '/draft-scenario-diff':
      return draftScenarioDiff(state, scenario, artifacts, rest.join(' '));
    case '/draft-harness-patch':
      return draftHarnessPatch(state, scenario, artifacts, rest.join(' '));
    case '/draft-harness-diff':
      return draftHarnessDiff(state, scenario, artifacts, rest.join(' '));
    case '/save-note': {
      const saveResult = saveOperatorNote(state, rest.join(' '));
      state.statusMessage = saveResult.message;
      return saveResult.message;
    }
    case '/clear':
      state.operatorHistory = [];
      state.operatorSessionId = null;
      saveOperatorHistoryForSelection(state);
      saveOperatorSessionForSelection(state);
      state.statusMessage = 'Operator conversation cleared for the current selection.';
      return 'Cleared operator conversation for the current scenario/run selection.';
    default:
      state.statusMessage = 'Unknown operator command.';
      return 'Unknown operator command. Use /help to see local commands.';
  }
}

async function promptSelect(
  rl: ReadlineInterface,
  title: string,
  options: string[],
): Promise<number | null> {
  return promptPauseRawMode(rl, async () => {
    console.clear();
    console.log(chalk.bold(title));
    console.log('');
    options.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
    console.log('');
    const raw = await question(rl, 'Enter number (empty to cancel) > ');
    if (!raw.trim()) {
      return null;
    }
    const index = Number(raw) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= options.length) {
      return null;
    }
    return index;
  });
}

async function promptPauseRawMode<T>(
  rl: ReadlineInterface,
  callback: () => Promise<T>,
): Promise<T> {
  if (input.isTTY) {
    input.setRawMode(false);
  }
  try {
    return await callback();
  } finally {
    if (input.isTTY) {
      input.setRawMode(true);
    }
  }
}

async function question(rl: ReadlineInterface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

async function spawnEvalCli(runSpecPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(buildCommand(), buildCommandArgs([
      'exec',
      'tsx',
      'src/cli.ts',
      '--run-spec',
      runSpecPath,
    ]), {
      cwd: packageRoot,
      stdio: 'inherit',
      windowsHide: false,
      env: {
        ...process.env,
      },
    });

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`eval command exited with code ${code}`));
    });
  });
}

function buildCommand(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'C:\\WINDOWS\\System32\\cmd.exe';
  }
  return 'pnpm';
}

function buildCommandArgs(args: string[]): string[] {
  if (process.platform === 'win32') {
    return ['/d', '/s', '/c', 'pnpm', ...args];
  }
  return args;
}

function normalizeOperatorView(value: string | undefined): ViewTab | null {
  switch ((value ?? '').toLowerCase()) {
    case 'summary':
      return 'summary';
    case 'report':
      return 'report';
    case 'transcript':
      return 'transcript';
    case 'narre':
    case 'narretester':
      return 'narreTester';
    case 'findings':
      return 'findings';
    case 'scenario':
      return 'scenario';
    case 'operator':
      return 'operator';
    default:
      return null;
  }
}

function normalizeOperatorTester(value: string | undefined): EvalTesterId | null {
  return TESTER_OPTIONS.find((item) => item.id === value)?.id ?? null;
}

function normalizeOperatorProvider(value: string | undefined): EvalProviderId | null {
  return PROVIDER_OPTIONS.find((item) => item.id === value)?.id ?? null;
}

function renderOperatorRunsList(state: TuiState): string {
  if (state.runRefs.length === 0) {
    return 'No runs are available for the selected scenario.';
  }

  const lines = ['Available runs:'];
  state.runRefs.forEach((runRef, index) => {
    const marker = index === state.runIndex ? '*' : ' ';
    lines.push(`${marker} ${index + 1}. ${runRef.label}`);
  });
  lines.push('');
  lines.push('Use /select-run <latest|index|label> to switch the active run.');
  return lines.join('\n');
}

function selectOperatorRun(
  state: TuiState,
  rawSelection: string,
): { ok: true; runIndex: number; message: string } | { ok: false; message: string } {
  if (state.runRefs.length === 0) {
    return { ok: false, message: '선택 가능한 run이 없습니다.' };
  }

  const normalized = rawSelection.trim();
  if (!normalized) {
    return { ok: false, message: 'Usage: /select-run <latest|index|label>' };
  }

  const numericIndex = Number(normalized);
  let runIndex = -1;

  if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= state.runRefs.length) {
    runIndex = numericIndex - 1;
  } else {
    runIndex = state.runRefs.findIndex((item) => item.label === normalized);
    if (runIndex < 0 && normalized.toLowerCase() === 'latest') {
      runIndex = state.runRefs.findIndex((item) => item.kind === 'latest');
    }
  }

  if (runIndex < 0) {
    return { ok: false, message: `해당 run을 찾지 못했습니다: ${normalized}` };
  }

  return {
    ok: true,
    runIndex,
    message: `Active run changed to ${state.runRefs[runIndex].label}.`,
  };
}

function saveOperatorNote(
  state: TuiState,
  rawName: string,
): { ok: true; message: string } | { ok: false; message: string } {
  const scenario = state.scenarios[state.scenarioIndex];
  const runRef = state.runRefs[state.runIndex];
  if (!scenario || !runRef) {
    return { ok: false, message: '저장할 run이 선택되지 않았습니다.' };
  }

  const scenarioRunDir = join(runRef.runDir, 'scenarios', scenario.id);
  mkdirSync(scenarioRunDir, { recursive: true });

  const sanitizedBase = sanitizeOperatorNoteName(rawName) || 'operator-note';
  const notePath = join(scenarioRunDir, `${sanitizedBase}.md`);
  const content = renderOperatorNoteMarkdown(state, scenario, runRef);
  writeFileSync(notePath, content, 'utf-8');

  return {
    ok: true,
    message: `Saved operator note to ${notePath}`,
  };
}

function sanitizeOperatorNoteName(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function draftScenarioPatch(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
  rawName: string,
): Promise<string> {
  const bundle = loadScenarioSourceBundle(scenario.id);
  const prompt = buildScenarioPatchPrompt(state, scenario, artifacts, bundle);
  const response = await runCodexTextTask({
    prompt,
    model: process.env.NARRE_EVAL_OPERATOR_CODEX_MODEL,
    workingDirectory: packageRoot,
    sessionId: state.operatorSessionId ?? undefined,
  });
  state.operatorSessionId = response.sessionId ?? state.operatorSessionId;
  saveOperatorSessionForSelection(state);

  const targetDir = join(scenariosDir, scenario.id, 'results', 'latest');
  mkdirSync(targetDir, { recursive: true });
  const fileName = `${sanitizeOperatorNoteName(rawName) || 'operator-scenario-patch'}.md`;
  const targetPath = join(targetDir, fileName);
  writeFileSync(targetPath, response.text, 'utf-8');
  state.statusMessage = `Saved scenario patch draft to ${targetPath}`;
  return `Saved scenario patch draft to ${targetPath}`;
}

async function draftScenarioDiff(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
  rawName: string,
): Promise<string> {
  const bundle = loadScenarioSourceBundle(scenario.id);
  const prompt = buildScenarioDiffPrompt(state, scenario, artifacts, bundle);
  const response = await runCodexTextTask({
    prompt,
    model: process.env.NARRE_EVAL_OPERATOR_CODEX_MODEL,
    workingDirectory: packageRoot,
    sessionId: state.operatorSessionId ?? undefined,
  });
  state.operatorSessionId = response.sessionId ?? state.operatorSessionId;
  saveOperatorSessionForSelection(state);

  const targetDir = join(scenariosDir, scenario.id, 'results', 'latest');
  mkdirSync(targetDir, { recursive: true });
  const fileName = `${sanitizeOperatorNoteName(rawName) || 'operator-scenario-diff'}.patch`;
  const targetPath = join(targetDir, fileName);
  writeFileSync(targetPath, response.text, 'utf-8');
  state.statusMessage = `Saved scenario diff draft to ${targetPath}`;
  return `Saved scenario diff draft to ${targetPath}`;
}

async function draftHarnessPatch(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
  rawName: string,
): Promise<string> {
  const runRef = state.runRefs[state.runIndex];
  if (!runRef) {
    state.statusMessage = 'No selected run for harness patch draft.';
    return 'Harness patch draft requires a selected run.';
  }

  const prompt = buildHarnessPatchPrompt(state, scenario, artifacts);
  const response = await runCodexTextTask({
    prompt,
    model: process.env.NARRE_EVAL_OPERATOR_CODEX_MODEL,
    workingDirectory: packageRoot,
    sessionId: state.operatorSessionId ?? undefined,
  });
  state.operatorSessionId = response.sessionId ?? state.operatorSessionId;
  saveOperatorSessionForSelection(state);

  const targetDir = join(runRef.runDir, 'scenarios', scenario.id);
  mkdirSync(targetDir, { recursive: true });
  const fileName = `${sanitizeOperatorNoteName(rawName) || 'operator-harness-patch'}.md`;
  const targetPath = join(targetDir, fileName);
  writeFileSync(targetPath, response.text, 'utf-8');
  state.statusMessage = `Saved harness patch draft to ${targetPath}`;
  return `Saved harness patch draft to ${targetPath}`;
}

async function draftHarnessDiff(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
  rawName: string,
): Promise<string> {
  const runRef = state.runRefs[state.runIndex];
  if (!runRef) {
    state.statusMessage = 'No selected run for harness diff draft.';
    return 'Harness diff draft requires a selected run.';
  }

  const bundle = loadHarnessSourceBundle();
  const prompt = buildHarnessDiffPrompt(state, scenario, artifacts, bundle);
  const response = await runCodexTextTask({
    prompt,
    model: process.env.NARRE_EVAL_OPERATOR_CODEX_MODEL,
    workingDirectory: packageRoot,
    sessionId: state.operatorSessionId ?? undefined,
  });
  state.operatorSessionId = response.sessionId ?? state.operatorSessionId;
  saveOperatorSessionForSelection(state);

  const targetDir = join(runRef.runDir, 'scenarios', scenario.id);
  mkdirSync(targetDir, { recursive: true });
  const fileName = `${sanitizeOperatorNoteName(rawName) || 'operator-harness-diff'}.patch`;
  const targetPath = join(targetDir, fileName);
  writeFileSync(targetPath, response.text, 'utf-8');
  state.statusMessage = `Saved harness diff draft to ${targetPath}`;
  return `Saved harness diff draft to ${targetPath}`;
}

function renderOperatorNoteMarkdown(
  state: TuiState,
  scenario: TuiScenarioSummary,
  runRef: TuiRunRef,
): string {
  const turns = state.operatorHistory;
  const lines: string[] = [];
  lines.push('# Operator Note');
  lines.push('');
  lines.push(`- scenario: ${scenario.id}`);
  lines.push(`- run: ${runRef.label}`);
  lines.push(`- provider: ${state.provider}`);
  lines.push(`- tester: ${state.tester}`);
  lines.push(`- judge: ${state.judge ? 'on' : 'off'}`);
  lines.push('');
  lines.push('## Conversation');
  lines.push('');

  if (turns.length === 0) {
    lines.push('- (empty)');
  } else {
    for (const turn of turns) {
      lines.push(`### ${turn.role === 'user' ? 'User' : 'Codex'}`);
      lines.push('');
      lines.push(turn.content.trim() || '(empty)');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildOperatorPrompt(
  history: OperatorChatTurn[],
  scenario: TuiScenarioSummary,
  state: TuiState,
  artifacts: LoadedArtifacts,
): string {
  const transcript = artifacts.transcript;
  const latestResultSummary = artifacts.result
    ? [
        `status=${artifacts.result.status}`,
        `verify=${artifacts.result.verifyResults.passed}/${artifacts.result.verifyResults.total}`,
        `judge=${artifacts.result.judgeAvg != null ? artifacts.result.judgeAvg.toFixed(1) : '-'}`,
        `tools=${transcript?.totalToolCalls ?? '-'}`,
        `tester=${transcript?.testerInteractionCount ?? '-'}`,
        `findings=${artifacts.result.analysis.toolUse.findings.map((item) => item.kind).join(', ') || '(none)'}`,
      ].join('\n')
    : 'No selected run artifacts.';

  const verifyNames = scenario.verifyNames.join(', ') || '(none)';
  const rubricNames = scenario.rubricNames.join(', ') || '(none)';
  const reportExcerpt = trimBlock(artifacts.reportMarkdown ?? '', 5000);
  const transcriptExcerpt = trimBlock(
    artifacts.transcript ? renderNarreTesterTranscript(artifacts.transcript) : '',
    5000,
  );
  const historyText = history
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Codex'}: ${turn.content}`)
    .join('\n\n');

  return `You are the Codex operator for narre-eval.

Your role:
- analyze scenarios and harness behavior
- inspect run artifacts
- propose next actions
- help manage eval scenarios and tester strategy

Critical constraints:
- You are not the target Narre agent.
- Do not recommend turning the tester into a Netior power user.
- The tester persona should know its domain but not Netior internal modeling concepts.
- Respond in Korean.
- Be concrete and operational.

Current execution context:
- scenario: ${scenario.id}
- description: ${scenario.description}
- selected run: ${state.runRefs[state.runIndex]?.label ?? 'none'}
- target skill: ${scenario.execution.target_skill ?? '(none)'}
- provider: ${state.provider}
- tester: ${state.tester}
- judge: ${state.judge ? 'on' : 'off'}

Scenario verify items:
${verifyNames}

Scenario rubric items:
${rubricNames}

Selected run summary:
${latestResultSummary}

Selected run report excerpt:
${reportExcerpt || '(none)'}

Selected run Narre-to-tester transcript excerpt:
${transcriptExcerpt || '(none)'}

Conversation history:
${historyText}

Now answer the last User message in Korean.`;
}

function buildScenarioPatchPrompt(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
  bundle: ScenarioSourceBundle,
): string {
  const transcript = artifacts.transcript;
  const findings = artifacts.result?.analysis.toolUse.findings.map((item) => `${item.kind}: ${item.message}`).join('\n')
    || '(none)';

  return `You are preparing a scenario patch draft for narre-eval.

Respond in Korean.
Write a markdown document only.

Goal:
- improve the selected eval scenario itself
- keep the tester persona domain-aware but ignorant of Netior internals
- focus on scenario text, turn design, verify expectations, rubrics, and skill-target fit

Selected scenario:
- id: ${scenario.id}
- description: ${scenario.description}
- target skill: ${scenario.execution.target_skill ?? '(none)'}
- provider: ${state.provider}
- tester: ${state.tester}

Selected run summary:
- status: ${artifacts.result?.status ?? '(none)'}
- verify: ${artifacts.result ? `${artifacts.result.verifyResults.passed}/${artifacts.result.verifyResults.total}` : '(none)'}
- judge: ${artifacts.result?.judgeAvg != null ? artifacts.result.judgeAvg.toFixed(1) : '(none)'}
- tools: ${transcript?.totalToolCalls ?? '(none)'}
- tester interactions: ${transcript?.testerInteractionCount ?? '(none)'}

Analyzer findings:
${findings}

Scenario source files:

## manifest.yaml
${trimBlock(bundle.manifest ?? '(missing)', 8000)}

## turns.yaml
${trimBlock(bundle.turns ?? '(missing)', 8000)}

${bundle.verifyFiles.map((file) => `## ${file.path}\n${trimBlock(file.content, 6000)}`).join('\n\n') || '## verify files\n(missing)'}

${bundle.rubricFiles.map((file) => `## ${file.path}\n${trimBlock(file.content, 6000)}`).join('\n\n') || '## rubric files\n(missing)'}

Selected run report excerpt:
${trimBlock(artifacts.reportMarkdown ?? '(none)', 6000)}

Selected Narre-to-tester transcript excerpt:
${trimBlock(artifacts.transcript ? renderNarreTesterTranscript(artifacts.transcript) : '(none)', 6000)}

Write the patch draft with exactly these sections:
1. # 시나리오 패치 초안
2. ## 핵심 문제
3. ## 수정 대상 파일
4. ## 파일별 수정안
5. ## 기대되는 평가 변화
6. ## 검증 절차

Be concrete. Mention actual file paths and proposed edits.`;
}

function buildScenarioDiffPrompt(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
  bundle: ScenarioSourceBundle,
): string {
  const transcript = artifacts.transcript;
  const findings = artifacts.result?.analysis.toolUse.findings.map((item) => `${item.kind}: ${item.message}`).join('\n')
    || '(none)';

  return `You are preparing an apply-ready scenario diff draft for narre-eval.

Respond in Korean only when writing comments inside the diff.
Your final output must be a unified diff only.
Do not wrap the diff in markdown fences.
Do not include explanatory prose before or after the diff.

Goal:
- improve the selected eval scenario itself
- keep the tester persona domain-aware but ignorant of Netior internals
- focus on scenario text, turn design, verify expectations, rubrics, and skill-target fit

Selected scenario:
- id: ${scenario.id}
- description: ${scenario.description}
- target skill: ${scenario.execution.target_skill ?? '(none)'}
- provider: ${state.provider}
- tester: ${state.tester}

Selected run summary:
- status: ${artifacts.result?.status ?? '(none)'}
- verify: ${artifacts.result ? `${artifacts.result.verifyResults.passed}/${artifacts.result.verifyResults.total}` : '(none)'}
- judge: ${artifacts.result?.judgeAvg != null ? artifacts.result.judgeAvg.toFixed(1) : '(none)'}
- tools: ${transcript?.totalToolCalls ?? '(none)'}
- tester interactions: ${transcript?.testerInteractionCount ?? '(none)'}

Analyzer findings:
${findings}

Selected run report excerpt:
${trimBlock(artifacts.reportMarkdown ?? '(none)', 5000)}

Selected Narre-to-tester transcript excerpt:
${trimBlock(artifacts.transcript ? renderNarreTesterTranscript(artifacts.transcript) : '(none)', 5000)}

Target files and current contents:

--- packages/narre-eval/scenarios/${scenario.id}/manifest.yaml
${bundle.manifest ?? '(missing)'}

--- packages/narre-eval/scenarios/${scenario.id}/turns.yaml
${bundle.turns ?? '(missing)'}

${bundle.verifyFiles.map((file) => `--- packages/narre-eval/scenarios/${scenario.id}/${file.path}\n${file.content}`).join('\n\n') || ''}

${bundle.rubricFiles.map((file) => `--- packages/narre-eval/scenarios/${scenario.id}/${file.path}\n${file.content}`).join('\n\n') || ''}

Output rules:
- Produce a unified diff against the exact paths above.
- Only touch files that materially improve the scenario.
- Keep the diff focused and minimal.
- If no change is needed for a file, omit it from the diff.`;
}

function buildHarnessPatchPrompt(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
): string {
  const transcript = artifacts.transcript;
  const failedChecks = artifacts.result?.verifyResults.results
    .filter((item) => !item.passed)
    .map((item) => `${item.name}${item.detail ? `: ${item.detail}` : ''}`)
    .join('\n') || '(none)';
  const findings = artifacts.result?.analysis.toolUse.findings
    .map((item) => `${item.kind}: ${item.message}`)
    .join('\n') || '(none)';

  return `You are preparing a harness patch draft for narre-eval.

Respond in Korean.
Write a markdown document only.

Goal:
- improve the eval harness or TUI behavior
- focus on runner behavior, tester/judge/operator contract, transcript/report rendering, or action surface
- do not rewrite the product scenario unless required for the harness change

Selected scenario:
- id: ${scenario.id}
- description: ${scenario.description}
- target skill: ${scenario.execution.target_skill ?? '(none)'}

Selected run summary:
- status: ${artifacts.result?.status ?? '(none)'}
- verify: ${artifacts.result ? `${artifacts.result.verifyResults.passed}/${artifacts.result.verifyResults.total}` : '(none)'}
- judge: ${artifacts.result?.judgeAvg != null ? artifacts.result.judgeAvg.toFixed(1) : '(none)'}
- tools: ${transcript?.totalToolCalls ?? '(none)'}
- tester interactions: ${transcript?.testerInteractionCount ?? '(none)'}

Failed verify items:
${failedChecks}

Analyzer findings:
${findings}

Selected run report excerpt:
${trimBlock(artifacts.reportMarkdown ?? '(none)', 7000)}

Selected transcript excerpt:
${trimBlock(artifacts.transcriptMarkdown ?? '(none)', 7000)}

Write the patch draft with exactly these sections:
1. # 하네스 패치 초안
2. ## 핵심 문제
3. ## 수정 대상 코드 파일
4. ## 파일별 수정안
5. ## 예상되는 UX 또는 평가 변화
6. ## 검증 절차

Be concrete. Mention actual code files under packages/narre-eval when possible.`;
}

function buildHarnessDiffPrompt(
  state: TuiState,
  scenario: TuiScenarioSummary,
  artifacts: LoadedArtifacts,
  bundle: HarnessSourceBundle,
): string {
  const transcript = artifacts.transcript;
  const failedChecks = artifacts.result?.verifyResults.results
    .filter((item) => !item.passed)
    .map((item) => `${item.name}${item.detail ? `: ${item.detail}` : ''}`)
    .join('\n') || '(none)';
  const findings = artifacts.result?.analysis.toolUse.findings
    .map((item) => `${item.kind}: ${item.message}`)
    .join('\n') || '(none)';

  return `You are preparing an apply-ready harness diff draft for narre-eval.

Your final output must be a unified diff only.
Do not wrap the diff in markdown fences.
Do not include explanatory prose before or after the diff.
Use Korean only inside code comments if comments are necessary.

Goal:
- improve the eval harness or TUI behavior
- focus on runner behavior, tester/judge/operator contract, transcript/report rendering, or action surface
- do not rewrite the product scenario itself unless unavoidable

Selected scenario:
- id: ${scenario.id}
- description: ${scenario.description}
- target skill: ${scenario.execution.target_skill ?? '(none)'}

Selected run summary:
- status: ${artifacts.result?.status ?? '(none)'}
- verify: ${artifacts.result ? `${artifacts.result.verifyResults.passed}/${artifacts.result.verifyResults.total}` : '(none)'}
- judge: ${artifacts.result?.judgeAvg != null ? artifacts.result.judgeAvg.toFixed(1) : '(none)'}
- tools: ${transcript?.totalToolCalls ?? '(none)'}
- tester interactions: ${transcript?.testerInteractionCount ?? '(none)'}

Failed verify items:
${failedChecks}

Analyzer findings:
${findings}

Selected run report excerpt:
${trimBlock(artifacts.reportMarkdown ?? '(none)', 5000)}

Selected transcript excerpt:
${trimBlock(artifacts.transcriptMarkdown ?? '(none)', 5000)}

Target code files and current contents:

${bundle.files.map((file) => `--- ${file.path}\n${file.content}`).join('\n\n')}

Output rules:
- Produce a unified diff against the exact paths above.
- Keep the diff focused and minimal.
- Only touch files that materially improve the harness or TUI/operator behavior.
- If no change is needed for a file, omit it from the diff.`;
}

function loadArtifactsForRun(runRef: TuiRunRef, scenarioId: string): LoadedArtifacts {
  const scenarioRunDir = join(runRef.runDir, 'scenarios', scenarioId);

  return {
    result: readJsonIfExists<ScenarioResult>(join(scenarioRunDir, 'result.json')),
    reportMarkdown: readTextIfExists(join(scenarioRunDir, 'report.md')),
    transcriptMarkdown: readTextIfExists(join(scenarioRunDir, 'transcript.md')),
    transcript: readJsonIfExists<Transcript>(join(scenarioRunDir, 'transcript.json')),
  };
}

function loadScenarioSourceBundle(scenarioId: string): ScenarioSourceBundle {
  const scenarioDir = join(scenariosDir, scenarioId);
  const manifestPath = join(scenarioDir, 'manifest.yaml');
  const turnsPath = join(scenarioDir, 'turns.yaml');
  const bundle: ScenarioSourceBundle = {
    manifest: readTextIfExists(manifestPath),
    turns: readTextIfExists(turnsPath),
    verifyFiles: [],
    rubricFiles: [],
  };

  const manifest = bundle.manifest ? parse(bundle.manifest) as TuiManifest : undefined;
  for (const ref of manifest?.assets?.verify ?? []) {
    const fullPath = join(scenarioDir, ref);
    const content = readTextIfExists(fullPath);
    if (content) {
      bundle.verifyFiles.push({ path: ref, content });
    }
  }
  for (const ref of manifest?.assets?.rubrics ?? []) {
    const fullPath = join(scenarioDir, ref);
    const content = readTextIfExists(fullPath);
    if (content) {
      bundle.rubricFiles.push({ path: ref, content });
    }
  }

  return bundle;
}

function loadHarnessSourceBundle(): HarnessSourceBundle {
  const workspaceRoot = join(packageRoot, '..', '..');
  const candidatePaths = [
    'packages/narre-eval/src/tui.ts',
    'packages/narre-eval/src/tester-runtime.ts',
    'packages/narre-eval/src/grader.ts',
    'packages/narre-eval/src/analyzer.ts',
    'packages/narre-eval/src/report.ts',
    'packages/narre-eval/src/types.ts',
    'packages/narre-eval/src/execution.ts',
  ];

  const files = candidatePaths.flatMap((relativePath) => {
    const fullPath = join(workspaceRoot, relativePath);
    const content = readTextIfExists(fullPath);
    return content ? [{ path: relativePath, content: trimBlock(content, 9000) }] : [];
  });

  return { files };
}

function listOperatorGeneratedArtifactsDetailed(state: TuiState, scenarioId: string): OperatorGeneratedArtifact[] {
  const entries: OperatorGeneratedArtifact[] = [];
  const runRef = state.runRefs[state.runIndex];

  if (runRef) {
    const runScenarioDir = join(runRef.runDir, 'scenarios', scenarioId);
    entries.push(...listOperatorArtifactFiles(runScenarioDir, 'run'));
  }

  const scenarioLatestDir = join(scenariosDir, scenarioId, 'results', 'latest');
  entries.push(...listOperatorArtifactFiles(scenarioLatestDir, 'scenario'));

  return entries;
}

function listOperatorArtifactFiles(
  dirPath: string,
  scopeLabel: 'run' | 'scenario',
): OperatorGeneratedArtifact[] {
  if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
    return [];
  }

  return readdirSync(dirPath)
    .filter((name) => /^operator-/.test(name))
    .sort((left, right) => left.localeCompare(right))
    .flatMap((name) => {
      const path = join(dirPath, name);
      const content = readTextIfExists(path);
      return content
        ? [{
            key: `${scopeLabel}:${name}`,
            scope: scopeLabel,
            name,
            path,
            content,
          }]
        : [];
    });
}

function hydrateOperatorGeneratedSelection(state: TuiState): void {
  const scenario = state.scenarios[state.scenarioIndex];
  if (!scenario) {
    state.operatorGeneratedSelectionKey = null;
    state.operatorGeneratedCandidateKey = null;
    state.operatorGeneratedResultKey = null;
    state.operatorGeneratedResultMessage = null;
    return;
  }

  const artifacts = listOperatorGeneratedArtifactsDetailed(state, scenario.id);
  if (artifacts.length === 0) {
    state.operatorGeneratedSelectionKey = null;
    state.operatorGeneratedCandidateKey = null;
    state.operatorGeneratedResultKey = null;
    state.operatorGeneratedResultMessage = null;
    return;
  }

  if (!artifacts.some((item) => item.key === state.operatorGeneratedSelectionKey)) {
    state.operatorGeneratedSelectionKey = artifacts[0].key;
  }
  if (state.operatorGeneratedCandidateKey && !artifacts.some((item) => item.key === state.operatorGeneratedCandidateKey)) {
    state.operatorGeneratedCandidateKey = null;
  }
  if (state.operatorGeneratedResultKey && !artifacts.some((item) => item.key === state.operatorGeneratedResultKey)) {
    state.operatorGeneratedResultKey = null;
    state.operatorGeneratedResultMessage = null;
  }
}

function refreshWorkspaceStatus(state: TuiState): void {
  const workspaceRoot = join(packageRoot, '..', '..');
  const result = spawnSync('git', ['status', '--short'], {
    cwd: workspaceRoot,
    windowsHide: true,
    encoding: 'utf-8',
    env: {
      ...process.env,
    },
  });

  if (result.error) {
    state.workspaceStatusLines = [`status unavailable: ${result.error.message}`];
    return;
  }

  if (result.status !== 0) {
    const text = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    state.workspaceStatusLines = [`status unavailable: ${text}`];
    return;
  }

  const lines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  state.workspaceStatusLines = lines.slice(0, 12);
  if (lines.length > 12) {
    state.workspaceStatusLines.push(`... and ${lines.length - 12} more`);
  }
}

function renderOperatorGeneratedArtifactsList(state: TuiState, scenarioId: string): string {
  const artifacts = listOperatorGeneratedArtifactsDetailed(state, scenarioId);
  if (artifacts.length === 0) {
    return 'No generated operator artifacts found for the current selection.';
  }

  return [
    'Generated operator artifacts:',
    ...artifacts.map((item, index) => `${index + 1}. [${item.scope}] ${item.name}`),
  ].join('\n');
}

function selectOperatorGeneratedArtifact(
  state: TuiState,
  scenarioId: string,
  rawSelection: string,
): { ok: true; artifact: OperatorGeneratedArtifact; message: string } | { ok: false; message: string } {
  const artifacts = listOperatorGeneratedArtifactsDetailed(state, scenarioId);
  if (artifacts.length === 0) {
    return { ok: false, message: 'No generated operator artifacts found for the current selection.' };
  }

  const normalized = rawSelection.trim();
  if (!normalized) {
    return { ok: false, message: 'Usage: /open-generated <index|name>' };
  }

  const numericIndex = Number(normalized);
  let artifact: OperatorGeneratedArtifact | undefined;
  if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= artifacts.length) {
    artifact = artifacts[numericIndex - 1];
  } else {
    artifact = artifacts.find((item) => item.name === normalized || item.key === normalized);
  }

  if (!artifact) {
    return { ok: false, message: `Could not find generated artifact: ${normalized}` };
  }

  return {
    ok: true,
    artifact,
    message: `Selected generated artifact ${artifact.name}.`,
  };
}

async function validateOperatorGeneratedArtifact(artifact: OperatorGeneratedArtifact): Promise<string> {
  if (!artifact.name.endsWith('.patch')) {
    return `Validation is only supported for .patch artifacts. Selected: ${artifact.name}`;
  }

  const workspaceRoot = join(packageRoot, '..', '..');
  return new Promise((resolve) => {
    const child = spawn('git', ['apply', '--check', artifact.path], {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      resolve(`Failed to validate ${artifact.name}: ${error.message}`);
    });
    child.once('close', (code) => {
      if (code === 0) {
        resolve(`git apply --check passed for ${artifact.name}`);
        return;
      }
      resolve(`git apply --check failed for ${artifact.name}: ${(stderr || stdout || `exit ${code}`).trim()}`);
    });
  });
}

async function applyOperatorGeneratedArtifact(artifact: OperatorGeneratedArtifact): Promise<string> {
  if (!artifact.name.endsWith('.patch')) {
    return `Apply is only supported for .patch artifacts. Selected: ${artifact.name}`;
  }

  const validation = await validateOperatorGeneratedArtifact(artifact);
  if (!validation.startsWith('git apply --check passed')) {
    return `Apply aborted. ${validation}`;
  }

  const workspaceRoot = join(packageRoot, '..', '..');
  return new Promise((resolve) => {
    const child = spawn('git', ['apply', artifact.path], {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      resolve(`Failed to apply ${artifact.name}: ${error.message}`);
    });
    child.once('close', (code) => {
      if (code === 0) {
        resolve(`Applied ${artifact.name} to the workspace.`);
        return;
      }
      resolve(`Failed to apply ${artifact.name}: ${(stderr || stdout || `exit ${code}`).trim()}`);
    });
  });
}

function hydrateOperatorHistoryForSelection(state: TuiState): void {
  const scenario = state.scenarios[state.scenarioIndex];
  if (!scenario) {
    state.operatorHistory = [];
    state.operatorHistoryScopeKey = null;
    state.operatorSessionId = null;
    return;
  }

  const runRef = state.runRefs[state.runIndex];
  const scopeKey = makeOperatorScopeKey(scenario.id, runRef);
  if (state.operatorHistoryScopeKey === scopeKey) {
    return;
  }

  state.operatorHistory = loadOperatorHistoryForSelection(scenario.id, runRef);
  state.operatorHistoryScopeKey = scopeKey;
  state.operatorSessionId = loadOperatorSessionForSelection(scenario.id, runRef);
}

function makeOperatorScopeKey(scenarioId: string, runRef: TuiRunRef | undefined): string {
  return `${scenarioId}::${runRef?.label ?? 'none'}`;
}

function getOperatorHistoryPath(runRef: TuiRunRef, scenarioId: string): string {
  return join(runRef.runDir, 'scenarios', scenarioId, 'operator-history.json');
}

function loadOperatorHistoryForSelection(
  scenarioId: string,
  runRef: TuiRunRef | undefined,
): OperatorChatTurn[] {
  if (!runRef) {
    return [];
  }

  const historyPath = getOperatorHistoryPath(runRef, scenarioId);
  if (!existsSync(historyPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(historyPath, 'utf-8')) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isOperatorChatTurn);
  } catch {
    return [];
  }
}

function getOperatorSessionPath(runRef: TuiRunRef, scenarioId: string): string {
  return join(runRef.runDir, 'scenarios', scenarioId, 'operator-session.json');
}

function loadOperatorSessionForSelection(
  scenarioId: string,
  runRef: TuiRunRef | undefined,
): string | null {
  if (!runRef) {
    return null;
  }

  const sessionPath = getOperatorSessionPath(runRef, scenarioId);
  if (!existsSync(sessionPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(sessionPath, 'utf-8')) as { sessionId?: unknown };
    return typeof parsed.sessionId === 'string' && parsed.sessionId.trim()
      ? parsed.sessionId.trim()
      : null;
  } catch {
    return null;
  }
}

function saveOperatorHistoryForSelection(state: TuiState): void {
  const scenario = state.scenarios[state.scenarioIndex];
  const runRef = state.runRefs[state.runIndex];
  if (!scenario || !runRef) {
    return;
  }

  const scenarioRunDir = join(runRef.runDir, 'scenarios', scenario.id);
  mkdirSync(scenarioRunDir, { recursive: true });
  writeFileSync(
    join(scenarioRunDir, 'operator-history.json'),
    JSON.stringify(state.operatorHistory, null, 2),
    'utf-8',
  );
}

function saveOperatorSessionForSelection(state: TuiState): void {
  const scenario = state.scenarios[state.scenarioIndex];
  const runRef = state.runRefs[state.runIndex];
  if (!scenario || !runRef) {
    return;
  }

  const scenarioRunDir = join(runRef.runDir, 'scenarios', scenario.id);
  const sessionPath = getOperatorSessionPath(runRef, scenario.id);
  if (!state.operatorSessionId) {
    rmSync(sessionPath, { force: true });
    return;
  }

  mkdirSync(scenarioRunDir, { recursive: true });
  writeFileSync(
    sessionPath,
    JSON.stringify({ sessionId: state.operatorSessionId }, null, 2),
    'utf-8',
  );
}

function readTextIfExists(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  return readFileSync(path, 'utf-8');
}

function readJsonIfExists<T>(path: string): T | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function renderNarreTesterTranscript(transcript: Transcript): string {
  const lines: string[] = [];

  lines.push('# Narre <-> tester transcript');
  lines.push('');
  lines.push(`- turns: ${transcript.turns.length}`);
  lines.push(`- tester interactions: ${transcript.testerInteractionCount}`);
  lines.push('');

  transcript.turns.forEach((turn, index) => {
    const stage = inferTurnStage(turn);
    lines.push(`## Turn ${index + 1}`);
    lines.push('');
    lines.push(`- inferred stage: ${stage}`);
    lines.push('');
    lines.push('### User');
    lines.push('');
    lines.push(turn.user.trim() || '(empty)');
    lines.push('');
    lines.push('### Narre');
    lines.push('');
    lines.push(turn.assistant.trim() || '(empty)');
    lines.push('');
    lines.push('### Tester');
    lines.push('');
    if (turn.testerInteractions.length === 0) {
      lines.push('- none');
    } else {
      turn.testerInteractions.forEach((interaction, interactionIndex) => {
        lines.push(`${interactionIndex + 1}. card=\`${interaction.cardType}\` status=\`${interaction.status}\``);
        if (interaction.decisionSummary) {
          lines.push(`   - decision: ${interaction.decisionSummary}`);
        }
        if (interaction.evaluationNote) {
          lines.push(`   - note: ${interaction.evaluationNote}`);
        }
        if (interaction.response != null) {
          lines.push(`   - response: ${formatUnknown(interaction.response)}`);
        }
      });
    }
    lines.push('');

    const importantTools = turn.toolCalls.filter((tool) => ['ask', 'propose', 'confirm'].includes(tool.tool));
    if (importantTools.length > 0) {
      lines.push('### Bootstrap interaction tools');
      lines.push('');
      importantTools.forEach((tool, toolIndex) => {
        lines.push(`${toolIndex + 1}. \`${tool.tool}\``);
        lines.push(`   - input: ${formatUnknown(tool.input)}`);
        if (tool.result) {
          lines.push(`   - result: ${trimInline(tool.result, 240)}`);
        }
      });
      lines.push('');
    }
  });

  return lines.join('\n');
}

function inferTurnStage(turn: Transcript['turns'][number]): string {
  const tools = turn.toolCalls.map((tool) => tool.tool);
  const cardTypes = turn.testerInteractions.map((item) => item.cardType);

  if (tools.includes('ask') || cardTypes.includes('interview')) {
    return 'ontology interview';
  }
  if (tools.includes('propose') || cardTypes.includes('proposal') || cardTypes.includes('draft')) {
    return 'proposal';
  }
  if (tools.includes('confirm') || cardTypes.includes('permission')) {
    return 'approval';
  }
  if (tools.some(isMutationLikeTool)) {
    return 'execution';
  }
  return 'conversation';
}

function isMutationLikeTool(tool: string): boolean {
  return /^(create|update|delete|remove|add|upsert|reorder|move)_/.test(tool);
}

function listRunRefsForScenario(scenarioId: string): TuiRunRef[] {
  const refs: TuiRunRef[] = [];
  const latestScenarioDir = join(runsDir, 'latest', 'scenarios', scenarioId);

  if (existsSync(join(latestScenarioDir, 'result.json'))) {
    refs.push({
      kind: 'latest',
      label: 'latest',
      runDir: join(runsDir, 'latest'),
    });
  }

  const historyRoot = join(runsDir, 'history');
  if (!existsSync(historyRoot)) {
    return refs;
  }

  const historyEntries = readdirSync(historyRoot)
    .filter((entry) => statSync(join(historyRoot, entry)).isDirectory())
    .sort((left, right) => right.localeCompare(left));

  for (const entry of historyEntries) {
    const runDir = join(historyRoot, entry);
    const scenarioDir = join(runDir, 'scenarios', scenarioId);
    if (!existsSync(join(scenarioDir, 'result.json'))) {
      continue;
    }
    refs.push({
      kind: 'history',
      label: entry,
      runDir,
    });
  }

  return refs;
}

function renderScenarioDetailMarkdown(scenario: TuiScenarioSummary): string {
  return [
    '# Scenario detail',
    '',
    `- id: ${scenario.id}`,
    `- lifecycle: ${scenario.lifecycle}`,
    `- type: ${scenario.type}`,
    `- labels: ${scenario.labels.join(', ') || '(none)'}`,
    `- description: ${scenario.description}`,
    '',
    '## Execution profile',
    '',
    `- target skill: ${scenario.execution.target_skill ?? '(none)'}`,
    `- agent: ${scenario.execution.agent_id}`,
    `- provider: ${scenario.execution.provider}`,
    `- tester: ${scenario.execution.tester}`,
    `- execution mode: ${scenario.execution.execution_mode}`,
    `- analysis targets: ${scenario.execution.analysis_targets.join(', ') || '(none)'}`,
    '',
    '## Verify items',
    '',
    ...(scenario.verifyNames.length > 0 ? scenario.verifyNames.map((item) => `- ${item}`) : ['- none']),
    '',
    '## Rubrics',
    '',
    ...(scenario.rubricNames.length > 0 ? scenario.rubricNames.map((item) => `- ${item}`) : ['- none']),
    '',
  ].join('\n');
}

function renderFindingsMarkdown(result: ScenarioResult, transcript?: Transcript): string {
  const lines: string[] = [];
  const failed = result.verifyResults.results.filter((item) => !item.passed);

  lines.push('# Findings');
  lines.push('');
  lines.push(`- status: ${result.status}`);
  lines.push(`- verify: ${result.verifyResults.passed}/${result.verifyResults.total}`);
  lines.push(`- tools: ${transcript?.totalToolCalls ?? '-'}`);
  lines.push(`- tester interactions: ${transcript?.testerInteractionCount ?? '-'}`);
  lines.push('');
  lines.push('## Tool-use analyzer');
  lines.push('');

  if (result.analysis.toolUse.findings.length === 0) {
    lines.push('- none');
  } else {
    result.analysis.toolUse.findings.forEach((finding, index) => {
      lines.push(`${index + 1}. [${finding.severity}] ${finding.kind}`);
      lines.push(`   - message: ${finding.message}`);
      if (finding.tools && finding.tools.length > 0) {
        lines.push(`   - tools: ${finding.tools.join(', ')}`);
      }
      if (finding.turnIndexes && finding.turnIndexes.length > 0) {
        lines.push(`   - turns: ${finding.turnIndexes.join(', ')}`);
      }
      if (finding.count != null) {
        lines.push(`   - count: ${finding.count}`);
      }
    });
  }

  lines.push('');
  lines.push('## Failed verify items');
  lines.push('');
  if (failed.length === 0) {
    lines.push('- none');
  } else {
    failed.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.name}`);
      if (item.detail) {
        lines.push(`   - detail: ${item.detail}`);
      }
    });
  }
  lines.push('');

  return lines.join('\n');
}

function getSelectedScenario(state: TuiState): TuiScenarioSummary {
  const scenario = state.scenarios[state.scenarioIndex];
  if (!scenario) {
    throw new Error('No scenario selected.');
  }
  return scenario;
}

function loadScenarioSummaries(rootDir: string): TuiScenarioSummary[] {
  const summaries: TuiScenarioSummary[] = [];

  for (const entry of readdirSync(rootDir)) {
    const scenarioDir = join(rootDir, entry);
    if (!statSync(scenarioDir).isDirectory()) {
      continue;
    }

    const manifestPath = join(scenarioDir, 'manifest.yaml');
    const legacyPath = join(scenarioDir, 'scenario.yaml');

    if (existsSync(manifestPath)) {
      summaries.push(loadScenarioSummaryFromManifest(scenarioDir, manifestPath));
      continue;
    }

    if (existsSync(legacyPath)) {
      summaries.push(loadScenarioSummaryFromLegacy(legacyPath));
    }
  }

  return summaries.sort((left, right) => left.id.localeCompare(right.id));
}

function loadScenarioSummaryFromManifest(
  scenarioDir: string,
  manifestPath: string,
): TuiScenarioSummary {
  const manifest = parse(readFileSync(manifestPath, 'utf-8')) as TuiManifest;
  const execution = normalizeScenarioExecution(manifest.execution, manifest.type);

  return {
    id: manifest.id,
    title: manifest.title,
    description: manifest.description,
    type: manifest.type,
    labels: manifest.labels ?? [],
    lifecycle: manifest.lifecycle,
    execution,
    verifyNames: loadVerifyNamesFromRefs(scenarioDir, manifest.assets?.verify ?? []),
    rubricNames: loadRubricNamesFromRefs(scenarioDir, manifest.assets?.rubrics ?? []),
  };
}

function loadScenarioSummaryFromLegacy(legacyPath: string): TuiScenarioSummary {
  const legacy = parse(readFileSync(legacyPath, 'utf-8')) as TuiLegacyScenario;
  const execution = normalizeScenarioExecution(undefined, legacy.type);

  return {
    id: legacy.id,
    description: legacy.description,
    type: legacy.type,
    labels: legacy.tags ?? [],
    lifecycle: 'active',
    execution,
    verifyNames: (legacy.verify ?? []).flatMap((item) => (item.name ? [item.name] : [])),
    rubricNames: (legacy.qualitative ?? []).flatMap((item) => (item.rubric ? [item.rubric] : [])),
  };
}

function loadVerifyNamesFromRefs(scenarioDir: string, refs: string[]): string[] {
  const names: string[] = [];

  for (const ref of refs) {
    const path = join(scenarioDir, ref);
    if (!existsSync(path)) {
      continue;
    }
    const parsed = parse(readFileSync(path, 'utf-8')) as { verify?: Array<{ name?: string }> };
    for (const item of parsed.verify ?? []) {
      if (typeof item.name === 'string' && item.name.trim()) {
        names.push(item.name.trim());
      }
    }
  }

  return names;
}

function loadRubricNamesFromRefs(scenarioDir: string, refs: string[]): string[] {
  const names: string[] = [];

  for (const ref of refs) {
    const path = join(scenarioDir, ref);
    if (!existsSync(path)) {
      continue;
    }
    const parsed = parse(readFileSync(path, 'utf-8')) as { rubrics?: Array<{ rubric?: string }> };
    for (const item of parsed.rubrics ?? []) {
      if (typeof item.rubric === 'string' && item.rubric.trim()) {
        names.push(item.rubric.trim());
      }
    }
  }

  return names;
}

function renderBox(
  title: string,
  lines: string[],
  width: number,
  height: number,
): { top: string; body: string[]; bottom: string } {
  const innerWidth = Math.max(width - 2, 1);
  const bodyHeight = Math.max(height - 2, 0);
  const visibleLines = lines.slice(0, bodyHeight);
  const body: string[] = [];

  for (let index = 0; index < bodyHeight; index += 1) {
    const line = visibleLines[index] ?? '';
    body.push(`|${padRight(stripAnsi(line), innerWidth)}|`);
  }

  return {
    top: `+${padRight(title, innerWidth, '-')}+`,
    body,
    bottom: `+${'-'.repeat(innerWidth)}+`,
  };
}

function formatPaneTitle(title: string, active: boolean): string {
  return active ? `[ACTIVE] ${title}` : ` ${title}`;
}

function padRight(value: string, width: number, fill = ' '): string {
  const truncated = truncateDisplay(value, width);
  const missing = width - getDisplayWidth(truncated);
  return truncated + fill.repeat(Math.max(0, missing));
}

/*
function truncateDisplay(value: string, width: number): string {
  if (width <= 0) {
    return '';
  }
  if (getDisplayWidth(value) <= width) {
    return value;
  }

  let result = '';
  let currentWidth = 0;
  for (const char of value) {
    const charWidth = getCharDisplayWidth(char);
    if (currentWidth + charWidth > width - 1) {
      break;
    }
    result += char;
    currentWidth += charWidth;
  }

  return width === 1 ? '…' : `${result}…`;
}

*/
function truncateDisplay(value: string, width: number): string {
  if (width <= 0) {
    return '';
  }
  if (getDisplayWidth(value) <= width) {
    return value;
  }

  let result = '';
  let currentWidth = 0;
  for (const char of value) {
    const charWidth = getCharDisplayWidth(char);
    if (currentWidth + charWidth > width - 1) {
      break;
    }
    result += char;
    currentWidth += charWidth;
  }

  return width === 1 ? '.' : `${result}...`;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function getDisplayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += getCharDisplayWidth(char);
  }
  return width;
}

function getCharDisplayWidth(char: string): number {
  const codePoint = char.codePointAt(0);
  if (codePoint == null) {
    return 0;
  }
  if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
    return 0;
  }
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2329 && codePoint <= 0x232a) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

function trimBlock(value: string, maxChars: number): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}\n\n...[truncated]`;
}

function trimInline(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}...`;
}

function formatUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return trimInline(value, 400);
  }
  return trimInline(JSON.stringify(value, null, 2), 400);
}

function isOperatorChatTurn(value: unknown): value is OperatorChatTurn {
  return typeof value === 'object'
    && value != null
    && ('role' in value)
    && ('content' in value)
    && ((value as { role: unknown }).role === 'user' || (value as { role: unknown }).role === 'assistant')
    && typeof (value as { content: unknown }).content === 'string';
}

function isPrintableInput(sequence: string, key: Key): boolean {
  if (!sequence) {
    return false;
  }
  if (key.ctrl || key.meta) {
    return false;
  }
  if (sequence === '\r' || sequence === '\n' || sequence === '\t') {
    return false;
  }
  return !/[\u0000-\u001f\u007f]/.test(sequence);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

async function readKey(): Promise<Key | null> {
  if (!input.isTTY) {
    return new Promise((resolve) => {
      const handler = (chunk: Buffer | string) => {
        input.off('data', handler);
        const sequence = chunk.toString()[0] ?? '';
        resolve({
          sequence,
          name: sequence === '\u0003' ? 'c' : sequence,
          ctrl: sequence === '\u0003',
          meta: false,
          shift: false,
        } as Key);
      };
      input.once('data', handler);
    });
  }

  return new Promise((resolve) => {
    const handler = (_str: string, key: Key) => {
      input.off('keypress', handler);
      resolve(key);
    };
    input.on('keypress', handler);
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
