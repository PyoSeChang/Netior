import { getDatabase } from '@netior/core';
import Anthropic from '@anthropic-ai/sdk';
import type {
  Assertions,
  Transcript,
  AssertionResult,
  JudgeScore,
  ScenarioResult,
  DbAssertion,
  DbAbsentAssertion,
  ResponseAssertion,
} from './types.js';

export function gradeScenario(
  scenarioId: string,
  transcript: Transcript,
  assertions: Assertions,
  projectId: string,
  durationMs: number,
  runJudge: boolean,
): Promise<ScenarioResult> {
  const dbResults = gradeDb(assertions.db ?? [], projectId);
  const dbAbsentResults = gradeDbAbsent(assertions.db_absent ?? [], projectId);
  const allDbResults = [...dbResults, ...dbAbsentResults];

  const responseResults = gradeResponse(assertions.response ?? [], transcript);
  const toolCountResult = gradeToolCount(assertions.tool_count, transcript.totalToolCalls);

  return (async () => {
    let judgeScores: JudgeScore[] = [];
    let judgeAvg: number | null = null;

    if (runJudge && assertions.qualitative && assertions.qualitative.length > 0) {
      judgeScores = await runLlmJudge(transcript, assertions.qualitative.map((q) => q.rubric));
      judgeAvg = judgeScores.reduce((sum, s) => sum + s.score, 0) / judgeScores.length;
    }

    return {
      scenarioId,
      timestamp: new Date().toISOString(),
      dbAssertions: {
        passed: allDbResults.filter((r) => r.passed).length,
        total: allDbResults.length,
        results: allDbResults,
      },
      responseAssertions: {
        passed: responseResults.filter((r) => r.passed).length,
        total: responseResults.length,
        results: responseResults,
      },
      toolCountCheck: toolCountResult,
      judgeScores,
      judgeAvg,
      durationMs,
      transcript,
    };
  })();
}

// ── DB Assertions ──

function gradeDb(assertions: DbAssertion[], projectId: string): AssertionResult[] {
  const db = getDatabase();
  const results: AssertionResult[] = [];

  for (const assertion of assertions) {
    const condition = assertion.condition
      ? assertion.condition.replace(/\{\{project_id\}\}/g, projectId)
      : `project_id = '${projectId}'`;

    const rows = db
      .prepare(`SELECT * FROM ${assertion.table} WHERE ${condition}`)
      .all() as Record<string, unknown>[];

    // count check
    if (assertion.expect.count !== undefined) {
      results.push({
        name: `db:${assertion.table}:count=${assertion.expect.count}`,
        passed: rows.length === assertion.expect.count,
        detail: `expected ${assertion.expect.count}, got ${rows.length}`,
      });
    }

    if (assertion.expect.count_min !== undefined) {
      results.push({
        name: `db:${assertion.table}:count_min=${assertion.expect.count_min}`,
        passed: rows.length >= assertion.expect.count_min,
        detail: `expected >= ${assertion.expect.count_min}, got ${rows.length}`,
      });
    }

    if (assertion.expect.count_max !== undefined) {
      results.push({
        name: `db:${assertion.table}:count_max=${assertion.expect.count_max}`,
        passed: rows.length <= assertion.expect.count_max,
        detail: `expected <= ${assertion.expect.count_max}, got ${rows.length}`,
      });
    }

    // column_includes check
    if (assertion.expect.column_includes) {
      for (const [col, expectedValues] of Object.entries(assertion.expect.column_includes)) {
        const actualValues = rows.map((r) => String(r[col]));
        for (const expected of expectedValues) {
          const found = actualValues.includes(expected);
          results.push({
            name: `db:${assertion.table}:${col} includes "${expected}"`,
            passed: found,
            detail: found ? 'found' : `not found in [${actualValues.join(', ')}]`,
          });
        }
      }
    }

    // not_null check
    if (assertion.expect.not_null) {
      for (const col of assertion.expect.not_null) {
        const allNotNull = rows.every((r) => r[col] != null);
        results.push({
          name: `db:${assertion.table}:${col} not null`,
          passed: allNotNull,
          detail: allNotNull ? 'all not null' : 'some null values found',
        });
      }
    }
  }

  return results;
}

function gradeDbAbsent(assertions: DbAbsentAssertion[], projectId: string): AssertionResult[] {
  const db = getDatabase();
  const results: AssertionResult[] = [];

  for (const assertion of assertions) {
    const condition = assertion.condition
      ? `${assertion.condition} AND project_id = '${projectId}'`
      : `project_id = '${projectId}'`;

    const rows = db
      .prepare(`SELECT COUNT(*) as cnt FROM ${assertion.table} WHERE ${condition}`)
      .get() as { cnt: number };

    results.push({
      name: `db_absent:${assertion.table}:${assertion.condition ?? 'all'}`,
      passed: rows.cnt === 0,
      detail: rows.cnt === 0 ? 'absent (correct)' : `found ${rows.cnt} rows`,
    });
  }

  return results;
}

// ── Response Assertions ──

function gradeResponse(assertions: ResponseAssertion[], transcript: Transcript): AssertionResult[] {
  const results: AssertionResult[] = [];
  const lastTurn = transcript.turns[transcript.turns.length - 1];
  if (!lastTurn) return results;

  const fullResponse = transcript.turns.map((t) => t.assistant).join('\n');

  for (const assertion of assertions) {
    if (assertion.contains_all) {
      for (const keyword of assertion.contains_all) {
        const found = fullResponse.includes(keyword);
        results.push({
          name: `response:contains "${keyword}"`,
          passed: found,
          detail: found ? 'found' : 'not found in response',
        });
      }
    }

    if (assertion.contains_any) {
      const found = assertion.contains_any.some((kw) => fullResponse.includes(kw));
      results.push({
        name: `response:contains_any [${assertion.contains_any.join(', ')}]`,
        passed: found,
        detail: found ? 'found' : 'none found in response',
      });
    }

    if (assertion.no_error) {
      const hasError = fullResponse.includes('[ERROR:');
      results.push({
        name: 'response:no_error',
        passed: !hasError,
        detail: hasError ? 'error found in response' : 'no errors',
      });
    }
  }

  return results;
}

// ── Tool Count ──

function gradeToolCount(
  spec: { min?: number; max?: number } | undefined,
  totalToolCalls: number,
): AssertionResult | null {
  if (!spec) return null;

  const minOk = spec.min === undefined || totalToolCalls >= spec.min;
  const maxOk = spec.max === undefined || totalToolCalls <= spec.max;

  return {
    name: `tool_count: ${totalToolCalls} (range: ${spec.min ?? 0}-${spec.max ?? '∞'})`,
    passed: minOk && maxOk,
    detail: `${totalToolCalls} tool calls`,
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

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return rubrics.map((r) => ({ rubric: r, score: 0, justification: 'Failed to parse judge response' }));
  }

  try {
    return JSON.parse(jsonMatch[0]) as JudgeScore[];
  } catch {
    return rubrics.map((r) => ({ rubric: r, score: 0, justification: 'Failed to parse judge JSON' }));
  }
}
