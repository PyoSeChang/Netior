import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import type { ScenarioResult, RunMetadata, ToolCallRecord, TurnTranscript } from './types.js';

const TSV_HEADER = 'timestamp\tscenario_id\tstatus\tverify_pass\tverify_total\ttool_calls\tjudge_avg\tjudge_scores\tduration_ms\tnotes';
const REPORT_FALLBACK_MARKDOWN = '# 보고서 없음\n\nLLM 보고서가 생성되지 않았습니다.\n';

export function recordResult(scenarioDir: string, result: ScenarioResult): void {
  const resultsDir = join(scenarioDir, 'results');
  const tsvPath = join(resultsDir, 'results.tsv');
  const latestDir = join(resultsDir, 'latest');
  const transcriptDir = join(resultsDir, 'transcripts');
  const reportDir = join(resultsDir, 'reports');

  mkdirSync(latestDir, { recursive: true });
  mkdirSync(transcriptDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });

  if (!existsSync(tsvPath)) {
    writeFileSync(tsvPath, TSV_HEADER + '\n', 'utf-8');
  }

  const failedChecks = result.verifyResults.results
    .filter((item) => !item.passed)
    .map((item) => item.name);
  const notes = result.error
    ? `error: ${result.error}`
    : failedChecks.length > 0
      ? failedChecks.join('; ')
      : '';

  const judgeScoresStr = result.judgeScores.length > 0
    ? `[${result.judgeScores.map((score) => score.score).join(',')}]`
    : '';

  appendFileSync(
    tsvPath,
    [
      result.timestamp,
      result.scenarioId,
      result.status,
      result.verifyResults.passed,
      result.verifyResults.total,
      result.transcript.totalToolCalls,
      result.judgeAvg?.toFixed(1) ?? '',
      judgeScoresStr,
      result.durationMs,
      notes,
    ].join('\t') + '\n',
    'utf-8',
  );

  const ts = result.timestamp.replace(/[:.]/g, '-');
  const transcriptPath = join(transcriptDir, `${ts}_${result.scenarioId}.json`);
  const reportPath = join(reportDir, `${ts}_${result.scenarioId}.md`);
  const reportMarkdown = result.judgeReportMarkdown ?? REPORT_FALLBACK_MARKDOWN;
  const prettyTranscriptMarkdown = renderPrettyTranscriptMarkdown(result);

  writeFileSync(transcriptPath, JSON.stringify(result, null, 2), 'utf-8');
  writeFileSync(reportPath, reportMarkdown, 'utf-8');
  writeScenarioLatestArtifacts(latestDir, result, reportMarkdown, prettyTranscriptMarkdown);
}

export function recordRunResult(
  packageRoot: string,
  runMeta: RunMetadata,
  results: ScenarioResult[],
): void {
  migrateLegacyRunDirs(packageRoot);

  const ts = runMeta.startedAt.replace(/[:.]/g, '-').slice(0, 19);
  const runDirName = `${ts}_${runMeta.runId}`;
  const latestRunDir = join(packageRoot, 'runs', 'latest');
  const historyRunDir = join(packageRoot, 'runs', 'history', runDirName);

  rmSync(latestRunDir, { recursive: true, force: true });
  writeRunArtifacts(historyRunDir, runMeta, results);
  writeRunArtifacts(latestRunDir, runMeta, results);
}

function migrateLegacyRunDirs(packageRoot: string): void {
  const runsDir = join(packageRoot, 'runs');
  const historyDir = join(runsDir, 'history');

  mkdirSync(historyDir, { recursive: true });

  if (!existsSync(runsDir)) {
    return;
  }

  for (const entry of readdirSync(runsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === 'history' || entry.name === 'latest') {
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}T/.test(entry.name)) {
      continue;
    }

    const sourcePath = join(runsDir, entry.name);
    const targetPath = join(historyDir, entry.name);
    if (existsSync(targetPath)) {
      continue;
    }

    renameSync(sourcePath, targetPath);
  }
}

function writeRunArtifacts(
  runDir: string,
  runMeta: RunMetadata,
  results: ScenarioResult[],
): void {
  mkdirSync(runDir, { recursive: true });

  writeFileSync(join(runDir, 'run.json'), JSON.stringify(runMeta, null, 2), 'utf-8');

  if (runMeta.runSpec) {
    writeFileSync(join(runDir, 'run-spec.json'), JSON.stringify(runMeta.runSpec, null, 2), 'utf-8');
  }

  for (const result of results) {
    const scenarioDir = join(runDir, 'scenarios', result.scenarioId);
    const reportMarkdown = result.judgeReportMarkdown ?? REPORT_FALLBACK_MARKDOWN;
    const prettyTranscriptMarkdown = renderPrettyTranscriptMarkdown(result);
    const { transcript, analysis, ...resultWithoutTranscript } = result;

    mkdirSync(scenarioDir, { recursive: true });

    writeFileSync(
      join(scenarioDir, 'result.json'),
      JSON.stringify({ ...resultWithoutTranscript, analysis }, null, 2),
      'utf-8',
    );
    writeFileSync(join(scenarioDir, 'transcript.json'), JSON.stringify(transcript, null, 2), 'utf-8');
    writeFileSync(
      join(scenarioDir, 'tester-trace.json'),
      JSON.stringify(transcript.testerInteractions, null, 2),
      'utf-8',
    );
    writeFileSync(join(scenarioDir, 'analysis.json'), JSON.stringify(analysis, null, 2), 'utf-8');
    writeFileSync(join(scenarioDir, 'report.md'), reportMarkdown, 'utf-8');
    writeFileSync(join(scenarioDir, 'transcript.md'), prettyTranscriptMarkdown, 'utf-8');
  }
}

function writeScenarioLatestArtifacts(
  latestDir: string,
  result: ScenarioResult,
  reportMarkdown: string,
  prettyTranscriptMarkdown: string,
): void {
  writeFileSync(join(latestDir, 'result.json'), JSON.stringify(result, null, 2), 'utf-8');
  writeFileSync(join(latestDir, 'transcript.json'), JSON.stringify(result.transcript, null, 2), 'utf-8');
  writeFileSync(join(latestDir, 'tester-trace.json'), JSON.stringify(result.transcript.testerInteractions, null, 2), 'utf-8');
  writeFileSync(join(latestDir, 'analysis.json'), JSON.stringify(result.analysis, null, 2), 'utf-8');
  writeFileSync(join(latestDir, 'report.md'), reportMarkdown, 'utf-8');
  writeFileSync(join(latestDir, 'transcript.md'), prettyTranscriptMarkdown, 'utf-8');
}

export function printSummary(results: ScenarioResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('  EVAL RESULTS');
  console.log('='.repeat(60));

  let totalPass = 0;
  let totalTotal = 0;

  for (const result of results) {
    const verifyStatus = result.verifyResults.total > 0
      ? `${result.verifyResults.passed}/${result.verifyResults.total}`
      : '-';
    const judgeStr = result.judgeAvg != null ? result.judgeAvg.toFixed(1) : '-';
    const toolStr = `${result.transcript.totalToolCalls} tools`;
    const testerStr = `${result.transcript.testerInteractionCount} tester`;
    const analysisStr = `${result.analysis.toolUse.findings.length} findings`;
    const timeStr = `${(result.durationMs / 1000).toFixed(1)}s`;
    const iconMap = { pass: '[OK]', fail: '[FAIL]', error: '[ERR]', skipped: '[SKIP]' } as const;
    const icon = iconMap[result.status];

    console.log(`\n  ${icon} ${result.scenarioId}`);
    console.log(`      Exec: ${result.execution.agent_id} / ${result.execution.provider} / ${result.execution.tester}`);

    if (result.status === 'skipped') {
      console.log(`      Reason: ${result.skipReason}`);
    } else {
      console.log(`      Verify: ${verifyStatus}  Judge: ${judgeStr}  ${toolStr}  ${testerStr}  ${analysisStr}  ${timeStr}`);
    }

    if (result.status === 'fail') {
      const failed = result.verifyResults.results.filter((item) => !item.passed);
      for (const check of failed) {
        console.log(`      - ${check.name}: ${check.detail}`);
      }
    }

    if (result.judgeScores.length > 0) {
      for (const score of result.judgeScores) {
        console.log(`      - [${score.score}/5] ${score.rubric}`);
      }
    }

    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }

    if (result.analysis.toolUse.findings.length > 0) {
      for (const finding of result.analysis.toolUse.findings) {
        console.log(`      - [${finding.severity}] ${finding.kind}: ${finding.message}`);
      }
    }

    if (result.comparison) {
      const arrow = result.comparison.statusChanged
        ? `${result.comparison.previousStatus} -> ${result.comparison.currentStatus}`
        : `${result.comparison.currentStatus} (unchanged)`;
      console.log(`      Baseline: ${arrow}  verify delta: ${result.comparison.verifyPassedDelta >= 0 ? '+' : ''}${result.comparison.verifyPassedDelta}`);
    }

    totalPass += result.verifyResults.passed;
    totalTotal += result.verifyResults.total;
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`  Total: Verify ${totalPass}/${totalTotal}  Scenarios ${results.length}`);
  console.log('='.repeat(60) + '\n');
}

export function renderPrettyTranscriptMarkdown(result: ScenarioResult): string {
  const lines: string[] = [];
  const createdItems = collectCreatedItems(result);

  lines.push('# 실행 대화 기록');
  lines.push('');
  lines.push(`- 시나리오: ${result.scenarioId}`);
  lines.push(`- 상태: ${result.status}`);
  lines.push(`- 실행 프로필: ${result.execution.agent_id} / ${result.execution.provider} / ${result.execution.tester}`);
  lines.push(`- 총 도구 호출 수: ${result.transcript.totalToolCalls}`);
  lines.push(`- 총 tester 상호작용 수: ${result.transcript.testerInteractionCount}`);
  lines.push('');

  if (createdItems.length > 0) {
    lines.push('## 생성 또는 변경 추정 항목');
    lines.push('');
    for (const item of createdItems) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  if (result.transcript.turns.length === 0) {
    lines.push('## Turn 없음');
    lines.push('');
    lines.push('- 기록된 대화가 없습니다.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Turn별 기록');
  lines.push('');
  result.transcript.turns.forEach((turn, index) => {
    lines.push(`### Turn ${index + 1}`);
    lines.push('');
    lines.push('#### 사용자');
    lines.push('');
    lines.push(turn.user.trim() || '(비어 있음)');
    lines.push('');

    lines.push('#### Narre 응답');
    lines.push('');
    lines.push(turn.assistant.trim() || '(비어 있음)');
    lines.push('');

    lines.push('#### 도구 호출');
    lines.push('');
    if (turn.toolCalls.length === 0) {
      lines.push('- 없음');
    } else {
      turn.toolCalls.forEach((toolCall, toolIndex) => {
        lines.push(`${toolIndex + 1}. \`${toolCall.tool}\``);
        lines.push(`   - 입력: ${formatToolInput(toolCall.input)}`);
        if (toolCall.result) {
          lines.push(`   - 결과: ${shortenText(toolCall.result)}`);
        }
      });
    }
    lines.push('');

    lines.push('#### Tester 상호작용');
    lines.push('');
    if (turn.testerInteractions.length === 0) {
      lines.push('- 없음');
    } else {
      turn.testerInteractions.forEach((interaction, interactionIndex) => {
        lines.push(`${interactionIndex + 1}. 카드 유형: \`${interaction.cardType}\` / 상태: \`${interaction.status}\` / 소스: \`${interaction.source}\``);
        if (interaction.decisionSummary) {
          lines.push(`   - 판단: ${interaction.decisionSummary}`);
        }
        if (interaction.evaluationNote) {
          lines.push(`   - 관찰: ${interaction.evaluationNote}`);
        }
      });
    }
    lines.push('');

    if (turn.errors.length > 0) {
      lines.push('#### 에러');
      lines.push('');
      for (const error of turn.errors) {
        lines.push(`- ${error}`);
      }
      lines.push('');
    }
  });

  return lines.join('\n');
}

function collectCreatedItems(result: ScenarioResult): string[] {
  return result.transcript.turns.flatMap((turn) => (
    turn.toolCalls
      .map((toolCall) => summarizeCreatedItem(toolCall))
      .filter((item): item is string => item !== null)
  ));
}

function summarizeCreatedItem(toolCall: ToolCallRecord): string | null {
  const suffix = toolCall.tool.split('.').pop() ?? toolCall.tool;

  switch (suffix) {
    case 'create_network':
      return `네트워크: ${stringValue(toolCall.input.name)}`;
    case 'create_schema':
      return `아키타입: ${stringValue(toolCall.input.name)}`;
    case 'create_relation_type':
      return `릴레이션 타입: ${stringValue(toolCall.input.name)}`;
    case 'create_schema_field':
      return `필드: ${stringValue(toolCall.input.name)} (${stringValue(toolCall.input.field_type)})`;
    case 'create_concept':
      return `컨셉: ${stringValue(toolCall.input.title)}`;
    case 'create_network_node':
      return `네트워크 노드: object_id=${stringValue(toolCall.input.object_id)}`;
    default:
      return null;
  }
}

function formatToolInput(input: Record<string, unknown>): string {
  const parts = Object.entries(input)
    .slice(0, 6)
    .map(([key, value]) => `${key}=${stringValue(value)}`);
  return parts.length > 0 ? parts.join(', ') : '(입력 없음)';
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringValue(item)).join('|');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return '(none)';
}

function shortenText(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}
