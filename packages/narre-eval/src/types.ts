import type {
  NarreCard,
  NarreMention,
  NarreStreamEvent,
  Project,
  ProjectCreate,
  Archetype,
  ArchetypeCreate,
  RelationType,
  RelationTypeCreate,
  Concept,
  ConceptCreate,
  FileEntity,
  FileEntityCreate,
  Module,
  ModuleCreate,
} from '@netior/shared/types';

// ── Scenario Definition ──

export type ScenarioType = 'single-turn' | 'conversation';
export type ScenarioLifecycle = 'draft' | 'active' | 'deprecated';

// ── Scenario Bundle (manifest.yaml) ──

export interface ScenarioManifest {
  id: string;
  title: string;
  description: string;
  scenario_version: string;
  schema_version: number;
  type: ScenarioType;
  lifecycle: ScenarioLifecycle;
  labels: string[];
  execution: {
    supported_agents: string[];
    required_capabilities: string[];
  };
  turn_plan: { file: string };
  entrypoints: { seed: string; responder?: string };
  assets: {
    fixtures?: string[];
    expectations?: string[];
    verify?: string[];
    rubrics?: string[];
    goldens?: string[];
  };
  provenance?: {
    created_by?: ProvenanceInfo;
  };
}

/** Manifest metadata carried through to results. Null for legacy-loaded scenarios. */
export interface ScenarioVersionInfo {
  scenario_version: string;
  schema_version: number;
  supported_agents: string[];
  required_capabilities: string[];
  created_by: ProvenanceInfo | null;
}

export interface ProvenanceInfo {
  id: string;
  name: string;
  source: string;
}

export interface EvalScenario {
  id: string;
  description: string;
  type: ScenarioType;
  tags: string[];
  turns: Turn[];
  verify: VerifyItem[];
  qualitative: QualitativeItem[];
  /** Injected by loader */
  scenarioDir: string;
  /** Injected by loader from seed.ts */
  seed: (ctx: SeedContext) => Promise<void>;
  /** Injected by loader from responder.ts (conversation only) */
  responder?: (card: NarreCard, ctx: ResponderContext) => unknown;
  /** Present when loaded from manifest.yaml, null for legacy scenario.yaml */
  versionInfo: ScenarioVersionInfo | null;
}

export interface Turn {
  role: 'user';
  content: string;
  mentions?: NarreMention[];
}

// ── Verify ──

export interface VerifyItem {
  name: string;
  db?: {
    table: string;
    condition?: string;
    expect: {
      count?: number;
      count_min?: number;
      count_max?: number;
      column_includes?: Record<string, string[]>;
      not_null?: string[];
    };
  };
  db_absent?: {
    table: string;
    condition?: string;
  };
  /**
   * Verify a row exists matching the given column values.
   * Named `db_row_match` (not `db_identity`) because it matches by visible
   * column values, not by stable row ID — it cannot distinguish a renamed
   * row from a delete+recreate with the same values.
   */
  db_row_match?: {
    table: string;
    match: Record<string, string | number>;
    /** Additional column values to assert on the matched row. */
    expect_columns?: Record<string, string | number | null>;
  };
  /** Verify a table's row count is unchanged, proving no unintended side-effects. */
  side_effect?: {
    table: string;
    condition?: string;
    /** Expected count — typically set to the count after seed, before agent runs. */
    expect_count: number;
  };
  tool?: {
    name: string;
    expect: {
      count_min?: number;
      count_max?: number;
    };
    /**
     * Verify tool call ordering across the full transcript.
     * Checks that these tools appear in this order (not necessarily consecutive).
     */
    sequence?: string[];
  };
  /**
   * Verify a tool was NOT called in a specific turn (0-indexed).
   * Used to prove destructive actions don't happen before confirmation.
   */
  tool_absent_in_turn?: {
    tool: string;
    turn: number;
  };
  response?: {
    contains_all?: string[];
    contains_any?: string[];
    no_error?: boolean;
  };
}

export interface VerifyResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface QualitativeItem {
  rubric: string;
}

// ── Seed Context ──

export interface SeedContext {
  tempDir: string;
  scenarioDir: string;
  createProject(data: ProjectCreate): Promise<Project>;
  createArchetype(data: ArchetypeCreate): Promise<Archetype>;
  createRelationType(data: RelationTypeCreate): Promise<RelationType>;
  createConcept(data: ConceptCreate): Promise<Concept>;
  createFileEntity(data: FileEntityCreate): Promise<FileEntity>;
  createModule(data: ModuleCreate): Promise<Module>;
  copyFixtures(): Promise<void>;
  setTemplateVars(vars: Record<string, string>): void;
}

// ── Responder Context ──

export interface ResponderContext {
  cardIndex: number;
  previousCards: NarreCard[];
}

// ── Transcript ──

export interface TurnTranscript {
  user: string;
  assistant: string;
  toolCalls: ToolCallRecord[];
  events: NarreStreamEvent[];
  errors: string[];
}

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  result?: string;
}

export interface Transcript {
  scenarioId: string;
  sessionId: string | null;
  turns: TurnTranscript[];
  totalToolCalls: number;
  cardResponseCount: number;
  sessionResumeCount: number;
}

// ── Metrics ──

export type MetricSource = 'runner' | 'agent_usage' | 'derived' | 'unsupported';
export type MetricConfidence = 'exact' | 'estimated' | 'none';

export interface MetricValue {
  value: number | null;
  source: MetricSource;
  confidence: MetricConfidence;
}

export interface AgentInfo {
  id: string;
  name: string;
  version?: string;
  runtime: string;
  adapter_version?: string;
}

// ── Results ──

export type ScenarioStatus = 'pass' | 'fail' | 'error' | 'skipped';

export interface JudgeScore {
  rubric: string;
  score: number;
  justification: string;
  judge_version: string;
}

export interface ComparisonResult {
  baselineRunId: string;
  previousStatus: ScenarioStatus;
  currentStatus: ScenarioStatus;
  statusChanged: boolean;
  verifyPassedDelta: number;
  judgeAvgDelta: number | null;
  metricDeltas: Record<string, number | null>;
}

export interface ScenarioResult {
  runId: string;
  scenarioId: string;
  timestamp: string;
  status: ScenarioStatus;
  agent: AgentInfo;
  scenarioAuthor: ProvenanceInfo | null;
  executedBy: ProvenanceInfo;
  scenarioVersion: string | null;
  schemaVersion: number | null;
  gradingVersion: string;
  verifyResults: { passed: number; total: number; results: VerifyResult[] };
  judgeScores: JudgeScore[];
  judgeAvg: number | null;
  durationMs: number;
  metrics: Record<string, MetricValue>;
  transcript: Transcript;
  comparison?: ComparisonResult;
  error?: string;
  skipReason?: string;
}

export interface RunMetadata {
  runId: string;
  startedAt: string;
  finishedAt: string;
  agent: AgentInfo;
  executedBy: ProvenanceInfo;
  scenarioIds: string[];
}

// ── CLI Options ──

export interface EvalOptions {
  scenario?: string;
  tag?: string;
  repeat: number;
  judge: boolean;
  port: number;
  /** Run ID substring to compare against. 'latest' (default) uses most recent run. */
  baseline?: string;
}
