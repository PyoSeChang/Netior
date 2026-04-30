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
  ToolUseAnalysis,
  ScenarioExecutionConfig,
  ScenarioVersionInfo,
  ProvenanceInfo,
} from './types.js';
import { evalQuery } from './netior-service-client.js';
import { analyzeScenario, buildAnalysisMetrics } from './analyzer.js';
import { runCodexStructuredTask } from './codex-exec.js';

/** Bump when verifier types, grading logic, or metric definitions change. */
export const GRADING_VERSION = '2.0.0';

/** Bump when judge prompt template, score scale, or aggregation changes. */
export const JUDGE_VERSION = '2.0.0';

const DEFAULT_JUDGE_PROVIDER = 'codex';
const DEFAULT_CLAUDE_JUDGE_MODEL = 'claude-sonnet-4-20250514';

export interface GradeContext {
  runId: string;
  agent: AgentInfo;
  execution: ScenarioExecutionConfig;
  durationMs: number;
  versionInfo: ScenarioVersionInfo | null;
  executedBy: ProvenanceInfo;
  scenarioDescription: string;
  scenarioType: string;
  scenarioTags: string[];
  scenarioResponsibilitySurfaces: string[];
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
    tester_interaction_count: { value: transcript.testerInteractionCount, source: 'runner', confidence: 'exact' },
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
    tester_interaction_count: { value: 0, source: 'runner', confidence: 'exact' },
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
  serviceUrl: string,
  runJudge: boolean,
  ctx: GradeContext,
): Promise<ScenarioResult> {
  let judgeScores: JudgeScore[] = [];
  let judgeAvg: number | null = null;
  let judgeReportMarkdown: string | null = null;

  const analysis = analyzeScenario(transcript, ctx.execution);
  const verifyResults = await gradeVerify(verify, projectId, transcript, serviceUrl, analysis.toolUse);

  if (runJudge && qualitative.length > 0) {
    const judgeResult = await runLlmJudge(
      transcript,
      qualitative.map((q) => q.rubric),
      ctx,
      verifyResults,
      analysis.toolUse,
    );
    judgeScores = judgeResult.scores;
    judgeAvg = judgeScores.length > 0
      ? judgeScores.reduce((sum, s) => sum + s.score, 0) / judgeScores.length
      : null;
    judgeReportMarkdown = judgeResult.reportMarkdown;
  }
  const status = deriveStatus(verifyResults);
  const metrics = {
    ...buildMetrics(transcript, ctx.durationMs),
    ...buildAnalysisMetrics(analysis),
  };

  return {
    runId: ctx.runId,
    scenarioId,
    timestamp: new Date().toISOString(),
    status,
    agent: ctx.agent,
    execution: ctx.execution,
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
    judgeReportMarkdown,
    durationMs: ctx.durationMs,
    metrics,
    analysis,
    transcript,
  };
}

// ── Verify ──

async function gradeVerify(
  items: VerifyItem[],
  projectId: string,
  transcript: Transcript,
  serviceUrl: string,
  toolUseAnalysis: ToolUseAnalysis,
): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];

  for (const item of items) {
    if (item.db) {
      results.push(...await gradeDb(item.name, item.db, projectId, serviceUrl));
    }
    if (item.db_absent) {
      results.push(await gradeDbAbsent(item.name, item.db_absent, projectId, serviceUrl));
    }
    if (item.db_row_match) {
      results.push(await gradeDbRowMatch(item.name, item.db_row_match, projectId, serviceUrl));
    }
    if (item.side_effect) {
      results.push(await gradeSideEffect(item.name, item.side_effect, projectId, serviceUrl));
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
    if (item.analysis?.tool_use) {
      results.push(...gradeToolUseAnalysis(item.name, item.analysis.tool_use, toolUseAnalysis));
    }
  }

  return results;
}

async function gradeDb(
  name: string,
  spec: NonNullable<VerifyItem['db']>,
  projectId: string,
  serviceUrl: string,
): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];

  const condition = spec.condition
    ? spec.condition.replace(/\{\{project_id\}\}/g, projectId)
    : `project_id = '${projectId}'`;

  const rows = await evalQuery<Record<string, unknown>>(
    serviceUrl,
    `SELECT * FROM ${spec.table} WHERE ${condition}`,
  );

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

async function gradeDbAbsent(
  name: string,
  spec: NonNullable<VerifyItem['db_absent']>,
  projectId: string,
  serviceUrl: string,
): Promise<VerifyResult> {
  const condition = spec.condition
    ? `${spec.condition} AND project_id = '${projectId}'`
    : `project_id = '${projectId}'`;

  const [row] = await evalQuery<{ cnt: number }>(
    serviceUrl,
    `SELECT COUNT(*) as cnt FROM ${spec.table} WHERE ${condition}`,
  );

  return {
    name,
    passed: (row?.cnt ?? 0) === 0,
    detail: (row?.cnt ?? 0) === 0 ? 'absent (correct)' : `found ${row?.cnt ?? 0} rows`,
  };
}

function gradeToolUseAnalysis(
  name: string,
  spec: NonNullable<NonNullable<VerifyItem['analysis']>['tool_use']>,
  analysis: ToolUseAnalysis,
): VerifyResult[] {
  const results: VerifyResult[] = [];

  const findingsByKind = new Set(analysis.findings.map((finding) => finding.kind));

  for (const expectedKind of spec.findings_present ?? []) {
    const present = findingsByKind.has(expectedKind);
    results.push({
      name: `${name} (finding present: ${expectedKind})`,
      passed: present,
      detail: present ? 'present' : 'not present',
    });
  }

  for (const forbiddenKind of spec.findings_absent ?? []) {
    const present = findingsByKind.has(forbiddenKind);
    results.push({
      name: `${name} (finding absent: ${forbiddenKind})`,
      passed: !present,
      detail: present ? 'unexpected finding present' : 'absent',
    });
  }

  const summary = spec.summary;
  if (!summary) {
    return results;
  }

  const summaryValues: Record<string, number | boolean> = {
    total_calls: analysis.summary.totalCalls,
    unique_tool_count: analysis.summary.uniqueToolCount,
    discovery_call_count: analysis.summary.discoveryCallCount,
    prompt_redundant_lookup_count: analysis.summary.promptRedundantLookupCount,
    repeated_lookup_group_count: analysis.summary.repeatedLookupGroupCount,
    project_binding_violation_count: analysis.summary.projectBindingViolationCount,
    finding_count: analysis.findings.length,
    over_budget: analysis.summary.overBudget,
  };

  const countKeys = [
    'total_calls',
    'unique_tool_count',
    'discovery_call_count',
    'prompt_redundant_lookup_count',
    'repeated_lookup_group_count',
    'project_binding_violation_count',
    'finding_count',
  ] as const;

  for (const key of countKeys) {
    const expectation = summary[key];
    if (!expectation) {
      continue;
    }

    const actual = Number(summaryValues[key]);
    if (expectation.count !== undefined) {
      results.push({
        name: `${name} (${key} == ${expectation.count})`,
        passed: actual === expectation.count,
        detail: `expected ${expectation.count}, got ${actual}`,
      });
    }

    if (expectation.min !== undefined) {
      results.push({
        name: `${name} (${key} >= ${expectation.min})`,
        passed: actual >= expectation.min,
        detail: `expected >= ${expectation.min}, got ${actual}`,
      });
    }

    if (expectation.max !== undefined) {
      results.push({
        name: `${name} (${key} <= ${expectation.max})`,
        passed: actual <= expectation.max,
        detail: `expected <= ${expectation.max}, got ${actual}`,
      });
    }
  }

  if (summary.over_budget !== undefined) {
    const actual = Boolean(summaryValues.over_budget);
    results.push({
      name: `${name} (over_budget == ${summary.over_budget})`,
      passed: actual === summary.over_budget,
      detail: `expected ${summary.over_budget}, got ${actual}`,
    });
  }

  return results;
}

function gradeTool(
  name: string,
  spec: NonNullable<VerifyItem['tool']>,
  transcript: Transcript,
): VerifyResult {
  const allToolCalls = transcript.turns.flatMap((t) => t.toolCalls);
  const matchingCalls = allToolCalls.filter((tc) => toolNameMatches(tc.tool, spec.name));
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

async function gradeDbRowMatch(
  name: string,
  spec: NonNullable<VerifyItem['db_row_match']>,
  projectId: string,
  serviceUrl: string,
): Promise<VerifyResult> {
  const matchEntries = Object.entries(spec.match);
  const whereClauses = matchEntries.map(([col]) => `${col} = ?`);
  whereClauses.push('project_id = ?');
  const params = [...matchEntries.map(([, val]) => val), projectId];

  const [row] = await evalQuery<Record<string, unknown>>(
    serviceUrl,
    `SELECT * FROM ${spec.table} WHERE ${whereClauses.join(' AND ')}`,
    params,
  );

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

async function gradeSideEffect(
  name: string,
  spec: NonNullable<VerifyItem['side_effect']>,
  projectId: string,
  serviceUrl: string,
): Promise<VerifyResult> {
  const condition = spec.condition
    ? spec.condition.replace(/\{\{project_id\}\}/g, projectId)
    : `project_id = '${projectId}'`;

  const [row] = await evalQuery<{ cnt: number }>(
    serviceUrl,
    `SELECT COUNT(*) as cnt FROM ${spec.table} WHERE ${condition}`,
  );

  const count = row?.cnt ?? 0;
  const passed = count === spec.expect_count;
  return {
    name,
    passed,
    detail: passed
      ? `${spec.table} count unchanged (${spec.expect_count})`
      : `expected ${spec.expect_count} rows in ${spec.table}, got ${count}`,
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
    const idx = callNames.findIndex((toolName, index) => index >= searchFrom && toolNameMatches(toolName, expected));
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
  const found = turnCalls.find((tc) => toolNameMatches(tc.tool, spec.tool));

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

function toolNameMatches(actual: string, expected: string): boolean {
  if (actual === expected) {
    return true;
  }

  const actualSuffix = actual.split('.').pop() ?? actual;
  const expectedSuffix = expected.split('.').pop() ?? expected;
  return actualSuffix === expectedSuffix;
}

// ── LLM Judge ──

interface JudgeRunResult {
  scores: JudgeScore[];
  reportMarkdown: string | null;
}

async function runLlmJudge(
  transcript: Transcript,
  rubrics: string[],
  ctx: GradeContext,
  verifyResults: VerifyResult[],
  toolUseAnalysis: ToolUseAnalysis,
): Promise<JudgeRunResult> {
  const transcriptText = transcript.turns
    .map((t, i) => {
      const tools = t.toolCalls.length > 0
        ? `\nTools:\n${t.toolCalls.map((tc, toolIndex) => `  ${toolIndex + 1}. ${summarizeToolForJudge(tc.tool, tc.input)}`).join('\n')}`
        : '\nTools: none';
      const testerInteractions = t.testerInteractions.length > 0
        ? `\nTester interactions:\n${t.testerInteractions.map((interaction, interactionIndex) => (
          `  ${interactionIndex + 1}. ${interaction.cardType} / ${interaction.status} / ${interaction.source}`
        )).join('\n')}`
        : '\nTester interactions: none';
      return `Turn ${i + 1}:\nUser: ${t.user}\nAssistant: ${t.assistant}${tools}${testerInteractions}`;
    })
    .join('\n\n');

  const rubricText = rubrics
    .map((r, i) => `${i + 1}. ${r}`)
    .join('\n');

  const scenarioContext = buildJudgeScenarioContext(ctx, transcript);
  const verifySummary = buildJudgeVerifySummary(verifyResults);
  const toolAnalysisSummary = buildJudgeToolAnalysisSummary(toolUseAnalysis);
  const testerContext = buildJudgeTesterContext(transcript);

  const prompt = `You are evaluating an AI assistant's performance in Netior.

## Product Context
Netior is a graph-based desktop app for modeling typed objects such as schemas, relation types, concepts, files, networks, and their relationships.
In these eval scenarios, the assistant is usually asked to inspect or mutate project schema and graph state through tools.
The important product assumption is that the user usually knows their domain better than Netior internals, but does not necessarily know how networks, models, ORM-style schema_ref fields, or node placement should be designed.
Narre is expected to infer and lead those structural choices from the domain brief instead of pushing internal Netior design back to the user.
Judge whether the assistant handled the user's request well in that context.

## Scenario Context
${scenarioContext}

## Program Summary
${verifySummary}

## Tool-Use Analysis
${toolAnalysisSummary}

## Tester Context
${testerContext}

## Transcript
${transcriptText}

## Evaluation Criteria
Rate each criterion on a scale of 1-5 (1=poor, 5=excellent).
Base your judgment only on the provided execution context. Do not use tools.
Return only JSON that matches the requested schema.

For bootstrap scenarios:
- do not reward schema volume by itself
- penalize jumping into bulk structural mutation before interview/proposal checkpoints
- evaluate whether Narre kept the user in domain language while taking Netior-internal responsibility itself
- treat ontology interview, proposal quality, and starter graph usefulness as core success criteria

If scenario_kind is "fixed":
- prioritize correctness, side-effect safety, and concise execution
- do not penalize the assistant just for not running extra interview or proposal steps

If scenario_kind is "interpretive":
- prioritize interview quality, ontology reading, proposal quality, and structural ownership
- penalize weak interpretation, weak proposal checkpoints, and empty schema-heavy bootstraps

Criteria:
${rubricText}

## Output Language
Write the markdown report in Korean.

In "report_markdown", write a single integrated markdown report for a human reviewer.
Do not split it into workflow/judge sub-documents.
Ignore any garbled Korean text that may appear in older prompts or transcripts.

Use exactly these Korean sections:
- # 실행 평가 보고서
- ## 전체 판정
- ## 시나리오 목표
- ## 사용자 요청
- ## Narre의 해석
- ## 실행 흐름 요약
- ## 생성 또는 변경된 항목
- ## Tester 관찰
- ## 잘한 점
- ## 아쉬운 점 및 리스크
- ## 최종 평가

Authoritative Korean section list, overriding any malformed section text above:
- # 실행 평가 보고서
- ## 전체 판정
- ## 시나리오 목표
- ## 사용자 요청
- ## Narre의 해석
- ## 실행 흐름 요약
- ## 생성 또는 변경된 항목
- ## Tester 관찰
- ## 잘한 점
- ## 한계와 리스크
- ## 최종 평가

Report requirements:
- 자연스럽고 구체적인 한국어로 작성할 것
- 프로그램 요약, tester 관찰, transcript를 모두 반영할 것
- 단순 점수 나열이 아니라 왜 그런 평가를 내렸는지 서술할 것
- 실제 tool 이름과 생성/변경 결과를 요약할 것
- Narre가 먼저 ontology를 잘 읽었는지, 즉 entity kinds, relation kinds, artifact kinds, workflow structure를 적절히 인터뷰하고 추론했는지 평가할 것
- Narre가 네트워크 분기, model 사용, ORM-style field 설계, node 배치 책임을 얼마나 잘 떠맡았는지 평가할 것
- Narre가 Netior 내부 설계를 사용자에게 과도하게 떠넘겼는지도 평가할 것
- reviewer가 이 문서 하나만 읽고 무엇이 일어났는지 이해할 수 있게 작성할 것
- 특히 이 시나리오가 특정 skill을 검증한다면, 그 skill의 핵심 책임을 실제로 잘 수행했는지 평가할 것

Additional Korean report requirements, overriding any malformed requirement text above:
- 자연스럽고 구체적인 한국어로 작성할 것
- 프로그램 요약, tester 관찰, transcript를 모두 반영할 것
- 단순 점수 나열이 아니라 실행 흐름과 판단 근거를 설명할 것
- 실제 tool 이름과 생성/변경 결과를 요약할 것
- Narre가 먼저 ontology를 잘 읽었는지 평가할 것: entity kinds, relation kinds, artifact kinds, workflow structure를 적절히 인터뷰하고 추론했는지 확인할 것
- bootstrap 시나리오에서는 두 번 이상의 짧은 ontology 인터뷰가 있었는지 확인할 것
- Narre가 네트워크 분기, model 사용, ORM-style field 설계, node 배치 책임을 사용자에게 넘기지 않고 스스로 추론했는지 평가할 것
- Narre가 Netior 내부 설계를 사용자에게 과도하게 떠넘겼는지 평가할 것
- reviewer가 이 문서 하나만 읽고 무엇이 일어났는지 이해할 수 있게 작성할 것
- 특정 skill을 검증하는 시나리오라면 그 skill의 핵심 책임이 실제로 수행됐는지 평가할 것
`;
  try {
    const provider = resolveJudgeProvider();
    if (provider === 'claude') {
      return await runClaudeJudge(prompt, rubrics);
    }
    return await runCodexJudge(prompt, rubrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown judge failure';
    return {
      scores: rubrics.map((rubric) => ({
        rubric,
        score: 0,
        justification: `Judge failed: ${message}`,
        judge_version: JUDGE_VERSION,
      })),
      reportMarkdown: `# Judge Failure\n\nJudge failed: ${message}\n`,
    };
  }
}

async function runClaudeJudge(prompt: string, rubrics: string[]): Promise<JudgeRunResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: process.env.NARRE_EVAL_JUDGE_CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_JUDGE_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${prompt}

Return JSON in this shape:
{
  "scores": [{"rubric": "...", "score": N, "justification": "..."}],
  "report_markdown": "# ... markdown report ..."
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseJudgeResponse(text, rubrics);
}

async function runCodexJudge(prompt: string, rubrics: string[]): Promise<JudgeRunResult> {
  const model = process.env.NARRE_EVAL_JUDGE_CODEX_MODEL?.trim() || process.env.NARRE_CODEX_MODEL?.trim();
  const parsed = await runCodexStructuredTask<{
    scores?: Array<{ rubric: string; score: number; justification: string }>;
    report_markdown?: string;
  }>({
    prompt,
    schema: buildJudgeOutputSchema(),
    model,
    workingDirectory: process.cwd(),
  });

  return {
    scores: (Array.isArray(parsed.scores) ? parsed.scores : []).map((score) => ({
      ...score,
      judge_version: JUDGE_VERSION,
    })),
    reportMarkdown: typeof parsed.report_markdown === 'string'
      ? parsed.report_markdown
      : '# Judge Report Missing\n\nJudge did not return a markdown report.\n',
  };
}

function buildJudgeOutputSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['scores', 'report_markdown'],
    properties: {
      scores: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['rubric', 'score', 'justification'],
          properties: {
            rubric: { type: 'string' },
            score: { type: 'number' },
            justification: { type: 'string' },
          },
        },
      },
      report_markdown: { type: 'string' },
    },
  };
}

function parseJudgeResponse(text: string, rubrics: string[]): JudgeRunResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      scores: rubrics.map((rubric) => ({
        rubric,
        score: 0,
        justification: 'Failed to parse judge response',
        judge_version: JUDGE_VERSION,
      })),
      reportMarkdown: '# Judge Parse Failure\n\nFailed to parse judge response.\n',
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      scores?: Array<{ rubric: string; score: number; justification: string }>;
      report_markdown?: string;
    };

    return {
      scores: (Array.isArray(parsed.scores) ? parsed.scores : []).map((score) => ({
        ...score,
        judge_version: JUDGE_VERSION,
      })),
      reportMarkdown: typeof parsed.report_markdown === 'string'
        ? parsed.report_markdown
        : '# Judge Report Missing\n\nJudge did not return a markdown report.\n',
    };
  } catch {
    return {
      scores: rubrics.map((rubric) => ({
        rubric,
        score: 0,
        justification: 'Failed to parse judge JSON',
        judge_version: JUDGE_VERSION,
      })),
      reportMarkdown: '# Judge Parse Failure\n\nFailed to parse judge JSON.\n',
    };
  }
}

function resolveJudgeProvider(): 'claude' | 'codex' {
  const explicit = process.env.NARRE_EVAL_JUDGE_PROVIDER?.trim().toLowerCase();
  if (explicit === 'claude') {
    return 'claude';
  }
  if (explicit === 'codex') {
    return 'codex';
  }
  return DEFAULT_JUDGE_PROVIDER;
}

function buildJudgeScenarioContext(ctx: GradeContext, transcript: Transcript): string {
  const createdItems = transcript.turns.flatMap((turn) => (
    turn.toolCalls
      .map((toolCall) => summarizeCreatedItemForJudge(toolCall.tool, toolCall.input))
      .filter((item): item is string => item !== null)
  ));

  const lines = [
    `scenario_id: ${transcript.scenarioId}`,
    `scenario_type: ${ctx.scenarioType}`,
    `scenario_description: ${ctx.scenarioDescription}`,
    `scenario_tags: ${ctx.scenarioTags.length > 0 ? ctx.scenarioTags.join(', ') : '(none)'}`,
    `scenario_kind: ${ctx.execution.scenario_kind}`,
    `responsibility_surfaces: ${ctx.scenarioResponsibilitySurfaces.length > 0 ? ctx.scenarioResponsibilitySurfaces.join(', ') : '(none)'}`,
    `target_skill: ${ctx.versionInfo?.target_skill ?? '(none)'}`,
    `execution_profile: ${ctx.execution.agent_id} / ${ctx.execution.provider} / ${ctx.execution.tester}`,
    `turn_count: ${transcript.turns.length}`,
    `tool_call_count: ${transcript.totalToolCalls}`,
    `tester_interaction_count: ${transcript.testerInteractionCount}`,
    `created_or_changed_items: ${createdItems.length > 0 ? createdItems.join('; ') : '(unknown)'}`,
  ];

  return lines.join('\n');
}

function buildJudgeVerifySummary(verifyResults: VerifyResult[]): string {
  const failed = verifyResults.filter((result) => !result.passed);
  if (failed.length === 0) {
    return 'All deterministic verify checks passed.';
  }

  const lines = [
    `Failed verify checks: ${failed.length}`,
    ...failed.map((result, index) => `${index + 1}. ${result.name}${result.detail ? ` - ${result.detail}` : ''}`),
  ];
  return lines.join('\n');
}

function buildJudgeToolAnalysisSummary(toolUseAnalysis: ToolUseAnalysis): string {
  const lines = [
    `total_calls: ${toolUseAnalysis.summary.totalCalls}`,
    `unique_tool_count: ${toolUseAnalysis.summary.uniqueToolCount}`,
    `discovery_call_count: ${toolUseAnalysis.summary.discoveryCallCount}`,
    `project_binding_violation_count: ${toolUseAnalysis.summary.projectBindingViolationCount}`,
    `over_budget: ${toolUseAnalysis.summary.overBudget}`,
  ];

  if (toolUseAnalysis.findings.length > 0) {
    lines.push('findings:');
    lines.push(...toolUseAnalysis.findings.map((finding, index) => (
      `${index + 1}. [${finding.severity}] ${finding.kind} - ${finding.message}`
    )));
  } else {
    lines.push('findings: none');
  }

  return lines.join('\n');
}

function buildJudgeTesterContext(transcript: Transcript): string {
  const interactionsWithNotes = transcript.testerInteractions.filter((interaction) => (
    interaction.decisionSummary || interaction.evaluationNote
  ));

  if (interactionsWithNotes.length === 0) {
    return 'No tester observations were recorded.';
  }

  return interactionsWithNotes
    .map((interaction, index) => {
      const parts = [
        `${index + 1}. turn=${interaction.turnIndex + 1} card=${interaction.cardType} status=${interaction.status}`,
      ];

      if (interaction.decisionSummary) {
        parts.push(`decision=${interaction.decisionSummary}`);
      }
      if (interaction.evaluationNote) {
        parts.push(`note=${interaction.evaluationNote}`);
      }

      return parts.join(' | ');
    })
    .join('\n');
}

function summarizeToolForJudge(tool: string, input: Record<string, unknown>): string {
  const suffix = tool.split('.').pop() ?? tool;

  switch (suffix) {
    case 'create_schema':
      return `${tool} name=${stringValueForJudge(input.name)}`;
    case 'create_relation_type':
      return `${tool} name=${stringValueForJudge(input.name)}`;
    case 'create_schema_field':
      return `${tool} name=${stringValueForJudge(input.name)} type=${stringValueForJudge(input.field_type)} target=${stringValueForJudge(input.ref_schema_id)}`;
    case 'update_schema':
      return `${tool} schema_id=${stringValueForJudge(input.schema_id)} name=${stringValueForJudge(input.name)}`;
    case 'delete_schema':
      return `${tool} schema_id=${stringValueForJudge(input.schema_id)}`;
    default:
      return `${tool} ${formatJudgeInputSummary(input)}`.trim();
  }
}

function summarizeCreatedItemForJudge(tool: string, input: Record<string, unknown>): string | null {
  const suffix = tool.split('.').pop() ?? tool;

  switch (suffix) {
    case 'create_schema':
      return `schema:${stringValueForJudge(input.name)}`;
    case 'create_relation_type':
      return `relation_type:${stringValueForJudge(input.name)}`;
    case 'create_schema_field':
      return `field:${stringValueForJudge(input.name)}`;
    case 'create_concept':
      return `concept:${stringValueForJudge(input.title)}`;
    case 'create_network':
      return `network:${stringValueForJudge(input.name)}`;
    default:
      return null;
  }
}

function formatJudgeInputSummary(input: Record<string, unknown>): string {
  const parts = Object.entries(input)
    .slice(0, 4)
    .map(([key, value]) => `${key}=${stringValueForJudge(value)}`);
  return parts.join(' ');
}

function stringValueForJudge(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringValueForJudge(item)).join('|');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return '(none)';
}
