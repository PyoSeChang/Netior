import { getDatabase } from '@netior/core';
import Anthropic from '@anthropic-ai/sdk';
import type {
  VerifyItem,
  VerifyResult,
  QualitativeItem,
  Transcript,
  JudgeScore,
  ScenarioResult,
  ScenarioStatus,
  AgentInfo,
  MetricValue,
  ScenarioVersionInfo,
  ProvenanceInfo,
} from './types.js';

/** Bump when verifier types, grading logic, or metric definitions change. */
export const GRADING_VERSION = '2.0.0';

/** Bump when judge prompt template, score scale, or aggregation changes. */
export const JUDGE_VERSION = '1.0.0';

export interface GradeContext {
  runId: string;
  agent: AgentInfo;
  durationMs: number;
  versionInfo: ScenarioVersionInfo | null;
  executedBy: ProvenanceInfo;
}

const UNSUPPORTED: MetricValue = { value: null, source: 'unsupported', confidence: 'none' };

export function buildMetrics(transcript: Transcript, durationMs: number): Record<string, MetricValue> {
  const allToolCalls = transcript.turns.flatMap((t) => t.toolCalls);
  const allErrors = transcript.turns.flatMap((t) => t.errors);
  const uniqueTools = new Set(allToolCalls.map((tc) => tc.tool));

  return {
    turn_count: { value: transcript.turns.length, source: 'runner', confidence: 'exact' },
    tool_call_count: { value: transcript.totalToolCalls, source: 'runner', confidence: 'exact' },
    unique_tools_used: { value: uniqueTools.size, source: 'runner', confidence: 'exact' },
    latency_ms: { value: durationMs, source: 'runner', confidence: 'exact' },
    error_count: { value: allErrors.length, source: 'runner', confidence: 'exact' },
    card_response_count: { value: transcript.cardResponseCount, source: 'runner', confidence: 'exact' },
    session_resume_count: { value: transcript.sessionResumeCount, source: 'runner', confidence: 'exact' },
    token_input: UNSUPPORTED,
    token_output: UNSUPPORTED,
    token_total: UNSUPPORTED,
  };
}

/** Metric set for error results where execution failed. error_count = 1. */
export function errorMetrics(): Record<string, MetricValue> {
  return zeroMetrics(1);
}

/** Metric set for skipped results where nothing ran. All counts zero. */
export function skippedMetrics(): Record<string, MetricValue> {
  return zeroMetrics(0);
}

function zeroMetrics(errorCount: number): Record<string, MetricValue> {
  return {
    turn_count: { value: 0, source: 'runner', confidence: 'exact' },
    tool_call_count: { value: 0, source: 'runner', confidence: 'exact' },
    unique_tools_used: { value: 0, source: 'runner', confidence: 'exact' },
    latency_ms: { value: 0, source: 'runner', confidence: 'exact' },
    error_count: { value: errorCount, source: 'runner', confidence: 'exact' },
    card_response_count: { value: 0, source: 'runner', confidence: 'exact' },
    session_resume_count: { value: 0, source: 'runner', confidence: 'exact' },
    token_input: UNSUPPORTED,
    token_output: UNSUPPORTED,
    token_total: UNSUPPORTED,
  };
}

/**
 * Derive scenario status from verification results.
 *
 * `status` reflects the **verification outcome**, not execution cleanliness.
 * A scenario with SSE errors or card-response failures can still be `pass`
 * if all verify checks pass. Execution errors are tracked separately via
 * `errors[]` on each turn and the `error_count` metric.
 *
 * - `error`: top-level exception prevented grading entirely
 * - `pass`: all verify checks passed (or no checks defined)
 * - `fail`: at least one verify check failed
 */
function deriveStatus(
  verifyResults: VerifyResult[],
  error?: string,
): ScenarioStatus {
  if (error) return 'error';
  if (verifyResults.length === 0) return 'pass';
  return verifyResults.every((r) => r.passed) ? 'pass' : 'fail';
}

export async function gradeScenario(
  scenarioId: string,
  transcript: Transcript,
  verify: VerifyItem[],
  qualitative: QualitativeItem[],
  projectId: string,
  runJudge: boolean,
  ctx: GradeContext,
): Promise<ScenarioResult> {
  const verifyResults = gradeVerify(verify, projectId, transcript);

  let judgeScores: JudgeScore[] = [];
  let judgeAvg: number | null = null;

  if (runJudge && qualitative.length > 0) {
    judgeScores = await runLlmJudge(transcript, qualitative.map((q) => q.rubric));
    judgeAvg = judgeScores.reduce((sum, s) => sum + s.score, 0) / judgeScores.length;
  }

  const status = deriveStatus(verifyResults);
  const metrics = buildMetrics(transcript, ctx.durationMs);

  return {
    runId: ctx.runId,
    scenarioId,
    timestamp: new Date().toISOString(),
    status,
    agent: ctx.agent,
    scenarioAuthor: ctx.versionInfo?.created_by ?? null,
    executedBy: ctx.executedBy,
    scenarioVersion: ctx.versionInfo?.scenario_version ?? null,
    schemaVersion: ctx.versionInfo?.schema_version ?? null,
    gradingVersion: GRADING_VERSION,
    verifyResults: {
      passed: verifyResults.filter((r) => r.passed).length,
      total: verifyResults.length,
      results: verifyResults,
    },
    judgeScores,
    judgeAvg,
    durationMs: ctx.durationMs,
    metrics,
    transcript,
  };
}

// ── Verify ──

function gradeVerify(
  items: VerifyItem[],
  projectId: string,
  transcript: Transcript,
): VerifyResult[] {
  const results: VerifyResult[] = [];

  for (const item of items) {
    if (item.db) {
      results.push(...gradeDb(item.name, item.db, projectId));
    }
    if (item.db_absent) {
      results.push(gradeDbAbsent(item.name, item.db_absent, projectId));
    }
    if (item.db_row_match) {
      results.push(gradeDbRowMatch(item.name, item.db_row_match, projectId));
    }
    if (item.side_effect) {
      results.push(gradeSideEffect(item.name, item.side_effect, projectId));
    }
    if (item.tool) {
      results.push(gradeTool(item.name, item.tool, transcript));
      if (item.tool.sequence) {
        results.push(gradeToolSequence(item.name, item.tool.sequence, transcript));
      }
    }
    if (item.tool_absent_in_turn) {
      results.push(gradeToolAbsentInTurn(item.name, item.tool_absent_in_turn, transcript));
    }
    if (item.response) {
      results.push(...gradeResponse(item.name, item.response, transcript));
    }
  }

  return results;
}

function gradeDb(
  name: string,
  spec: NonNullable<VerifyItem['db']>,
  projectId: string,
): VerifyResult[] {
  const db = getDatabase();
  const results: VerifyResult[] = [];

  const condition = spec.condition
    ? spec.condition.replace(/\{\{project_id\}\}/g, projectId)
    : `project_id = '${projectId}'`;

  const rows = db
    .prepare(`SELECT * FROM ${spec.table} WHERE ${condition}`)
    .all() as Record<string, unknown>[];

  if (spec.expect.count !== undefined) {
    results.push({
      name,
      passed: rows.length === spec.expect.count,
      detail: `expected ${spec.expect.count}, got ${rows.length}`,
    });
  }

  if (spec.expect.count_min !== undefined) {
    results.push({
      name,
      passed: rows.length >= spec.expect.count_min,
      detail: `expected >= ${spec.expect.count_min}, got ${rows.length}`,
    });
  }

  if (spec.expect.count_max !== undefined) {
    results.push({
      name,
      passed: rows.length <= spec.expect.count_max,
      detail: `expected <= ${spec.expect.count_max}, got ${rows.length}`,
    });
  }

  if (spec.expect.column_includes) {
    for (const [col, expectedValues] of Object.entries(spec.expect.column_includes)) {
      const actualValues = rows.map((r) => String(r[col]));
      for (const expected of expectedValues) {
        const found = actualValues.includes(expected);
        results.push({
          name: `${name} (${col}="${expected}")`,
          passed: found,
          detail: found ? 'found' : `not found in [${actualValues.join(', ')}]`,
        });
      }
    }
  }

  if (spec.expect.not_null) {
    for (const col of spec.expect.not_null) {
      const allNotNull = rows.every((r) => r[col] != null);
      results.push({
        name: `${name} (${col} not null)`,
        passed: allNotNull,
        detail: allNotNull ? 'all not null' : 'some null values found',
      });
    }
  }

  return results;
}

function gradeDbAbsent(
  name: string,
  spec: NonNullable<VerifyItem['db_absent']>,
  projectId: string,
): VerifyResult {
  const db = getDatabase();

  const condition = spec.condition
    ? `${spec.condition} AND project_id = '${projectId}'`
    : `project_id = '${projectId}'`;

  const row = db
    .prepare(`SELECT COUNT(*) as cnt FROM ${spec.table} WHERE ${condition}`)
    .get() as { cnt: number };

  return {
    name,
    passed: row.cnt === 0,
    detail: row.cnt === 0 ? 'absent (correct)' : `found ${row.cnt} rows`,
  };
}

function gradeTool(
  name: string,
  spec: NonNullable<VerifyItem['tool']>,
  transcript: Transcript,
): VerifyResult {
  const allToolCalls = transcript.turns.flatMap((t) => t.toolCalls);
  const matchingCalls = allToolCalls.filter((tc) => tc.tool === spec.name);
  const count = matchingCalls.length;

  const minOk = spec.expect.count_min === undefined || count >= spec.expect.count_min;
  const maxOk = spec.expect.count_max === undefined || count <= spec.expect.count_max;

  const range = `${spec.expect.count_min ?? 0}-${spec.expect.count_max ?? '∞'}`;

  return {
    name,
    passed: minOk && maxOk,
    detail: `${spec.name} called ${count} times (range: ${range})`,
  };
}

function gradeResponse(
  name: string,
  spec: NonNullable<VerifyItem['response']>,
  transcript: Transcript,
): VerifyResult[] {
  const results: VerifyResult[] = [];
  const fullResponse = transcript.turns.map((t) => t.assistant).join('\n');

  if (spec.contains_all) {
    for (const keyword of spec.contains_all) {
      const found = fullResponse.includes(keyword);
      results.push({
        name: `${name} ("${keyword}")`,
        passed: found,
        detail: found ? 'found' : 'not found in response',
      });
    }
  }

  if (spec.contains_any) {
    const found = spec.contains_any.some((kw) => fullResponse.includes(kw));
    results.push({
      name,
      passed: found,
      detail: found ? 'found' : `none of [${spec.contains_any.join(', ')}] found`,
    });
  }

  if (spec.no_error) {
    const hasError = fullResponse.includes('[ERROR:');
    results.push({
      name,
      passed: !hasError,
      detail: hasError ? 'error found in response' : 'no errors',
    });
  }

  return results;
}

// ── Row Match ──

function gradeDbRowMatch(
  name: string,
  spec: NonNullable<VerifyItem['db_row_match']>,
  projectId: string,
): VerifyResult {
  const db = getDatabase();

  const matchEntries = Object.entries(spec.match);
  const whereClauses = matchEntries.map(([col]) => `${col} = ?`);
  whereClauses.push('project_id = ?');
  const params = [...matchEntries.map(([, val]) => val), projectId];

  const row = db
    .prepare(`SELECT * FROM ${spec.table} WHERE ${whereClauses.join(' AND ')}`)
    .get(...params) as Record<string, unknown> | undefined;

  if (!row) {
    const matchDesc = matchEntries.map(([c, v]) => `${c}="${v}"`).join(', ');
    return {
      name,
      passed: false,
      detail: `row not found in ${spec.table} where ${matchDesc}`,
    };
  }

  if (spec.expect_columns) {
    for (const [col, expected] of Object.entries(spec.expect_columns)) {
      const actual = row[col];
      // Explicit null comparison: both sides normalized
      const actualIsNull = actual === null || actual === undefined;
      const expectedIsNull = expected === null;

      if (expectedIsNull) {
        if (!actualIsNull) {
          return { name, passed: false, detail: `${col}: expected null, got "${actual}"` };
        }
      } else {
        if (actualIsNull || String(actual) !== String(expected)) {
          const actualStr = actualIsNull ? 'null' : String(actual);
          return { name, passed: false, detail: `${col}: expected "${expected}", got "${actualStr}"` };
        }
      }
    }
  }

  return { name, passed: true, detail: 'row found with expected values' };
}

// ── Side-Effect Invariants ──

function gradeSideEffect(
  name: string,
  spec: NonNullable<VerifyItem['side_effect']>,
  projectId: string,
): VerifyResult {
  const db = getDatabase();

  const condition = spec.condition
    ? spec.condition.replace(/\{\{project_id\}\}/g, projectId)
    : `project_id = '${projectId}'`;

  const row = db
    .prepare(`SELECT COUNT(*) as cnt FROM ${spec.table} WHERE ${condition}`)
    .get() as { cnt: number };

  const passed = row.cnt === spec.expect_count;
  return {
    name,
    passed,
    detail: passed
      ? `${spec.table} count unchanged (${spec.expect_count})`
      : `expected ${spec.expect_count} rows in ${spec.table}, got ${row.cnt}`,
  };
}

// ── Tool Sequence ──

function gradeToolSequence(
  name: string,
  sequence: string[],
  transcript: Transcript,
): VerifyResult {
  const allToolCalls = transcript.turns.flatMap((t) => t.toolCalls);
  const callNames = allToolCalls.map((tc) => tc.tool);

  // Check that each tool in sequence appears after the previous one
  let searchFrom = 0;
  const matched: string[] = [];

  for (const expected of sequence) {
    const idx = callNames.indexOf(expected, searchFrom);
    if (idx === -1) {
      return {
        name: `${name} (sequence)`,
        passed: false,
        detail: `expected "${expected}" after [${matched.join(' → ')}], ` +
          `but not found in remaining calls: [${callNames.slice(searchFrom).join(', ')}]`,
      };
    }
    matched.push(expected);
    searchFrom = idx + 1;
  }

  return {
    name: `${name} (sequence)`,
    passed: true,
    detail: `tool order verified: ${matched.join(' → ')}`,
  };
}

// ── Tool Absent In Turn ──

function gradeToolAbsentInTurn(
  name: string,
  spec: NonNullable<VerifyItem['tool_absent_in_turn']>,
  transcript: Transcript,
): VerifyResult {
  if (spec.turn >= transcript.turns.length) {
    return {
      name,
      passed: true,
      detail: `turn ${spec.turn} does not exist (${transcript.turns.length} turns total), trivially passed`,
    };
  }

  const turnCalls = transcript.turns[spec.turn].toolCalls;
  const found = turnCalls.find((tc) => tc.tool === spec.tool);

  if (found) {
    return {
      name,
      passed: false,
      detail: `"${spec.tool}" was called in turn ${spec.turn}, but should not have been`,
    };
  }

  return {
    name,
    passed: true,
    detail: `"${spec.tool}" correctly absent from turn ${spec.turn}`,
  };
}

// ── LLM Judge ──

async function runLlmJudge(transcript: Transcript, rubrics: string[]): Promise<JudgeScore[]> {
  const client = new Anthropic();

  const transcriptText = transcript.turns
    .map((t, i) => {
      const tools = t.toolCalls.length > 0
        ? `\n[Tools used: ${t.toolCalls.map((tc) => tc.tool).join(', ')}]`
        : '';
      return `Turn ${i + 1}:\nUser: ${t.user}\nAssistant: ${t.assistant}${tools}`;
    })
    .join('\n\n');

  const rubricText = rubrics
    .map((r, i) => `${i + 1}. ${r}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are evaluating an AI assistant's conversation quality.

## Transcript
${transcriptText}

## Evaluation Criteria
Rate each criterion on a scale of 1-5 (1=poor, 5=excellent).
Respond in JSON format: [{"rubric": "...", "score": N, "justification": "..."}]

Criteria:
${rubricText}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return rubrics.map((r) => ({ rubric: r, score: 0, justification: 'Failed to parse judge response', judge_version: JUDGE_VERSION }));
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ rubric: string; score: number; justification: string }>;
    return parsed.map((s) => ({ ...s, judge_version: JUDGE_VERSION }));
  } catch {
    return rubrics.map((r) => ({ rubric: r, score: 0, justification: 'Failed to parse judge JSON', judge_version: JUDGE_VERSION }));
  }
}
