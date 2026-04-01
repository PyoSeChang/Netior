import type { NarreMention, NarreStreamEvent } from '@netior/shared/types';

// ── Scenario Definition ──

export interface EvalScenario {
  id: string;
  description: string;
  tags: string[];
  seed: SeedConfig;
  turns: Turn[];
  assertions: Assertions;
}

export interface SeedConfig {
  project: { name: string; root_dir: string };
  archetypes?: Array<{ name: string; icon?: string; color?: string; node_shape?: string }>;
  relation_types?: Array<{ name: string; directed?: boolean; line_style?: string; color?: string }>;
  canvas_types?: Array<{ name: string; description?: string }>;
  concepts?: Array<{ title: string; archetype_name?: string; color?: string; icon?: string }>;
}

export interface Turn {
  role: 'user';
  content: string;
  mentions?: NarreMention[];
}

// ── Assertions ──

export interface Assertions {
  db?: DbAssertion[];
  db_absent?: DbAbsentAssertion[];
  response?: ResponseAssertion[];
  tool_count?: { min?: number; max?: number };
  qualitative?: QualitativeAssertion[];
}

export interface DbAssertion {
  table: string;
  condition?: string;
  expect: {
    count?: number;
    count_min?: number;
    count_max?: number;
    column_includes?: Record<string, string[]>;
    not_null?: string[];
  };
}

export interface DbAbsentAssertion {
  table: string;
  condition?: string;
}

export interface ResponseAssertion {
  contains_all?: string[];
  contains_any?: string[];
  no_error?: boolean;
}

export interface QualitativeAssertion {
  rubric: string;
  scale?: [number, number]; // default [1, 5]
}

// ── Transcript ──

export interface TurnTranscript {
  user: string;
  assistant: string;
  toolCalls: ToolCallRecord[];
  events: NarreStreamEvent[];
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
}

// ── Results ──

export interface AssertionResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface JudgeScore {
  rubric: string;
  score: number;
  justification: string;
}

export interface ScenarioResult {
  scenarioId: string;
  timestamp: string;
  dbAssertions: { passed: number; total: number; results: AssertionResult[] };
  responseAssertions: { passed: number; total: number; results: AssertionResult[] };
  toolCountCheck: AssertionResult | null;
  judgeScores: JudgeScore[];
  judgeAvg: number | null;
  durationMs: number;
  transcript: Transcript;
  error?: string;
}

// ── CLI Options ──

export interface EvalOptions {
  scenario?: string;
  tag?: string;
  repeat: number;
  judge: boolean;
  port: number;
}
