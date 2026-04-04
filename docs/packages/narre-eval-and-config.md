# narre-eval 패키지 및 루트 설정 문서

---

# Part 1: narre-eval

## 1. 패키지 개요

`@netior/narre-eval`은 Narre AI 어시스턴트의 품질을 시나리오 기반으로 평가하는 프레임워크다. 시나리오 번들(manifest + turns + verify + rubrics)을 로드하고, `EvalAgentAdapter`를 통해 agent runtime을 기동한 뒤, DB 상태 검증 + 도구 호출 검증 + LLM 기반 정성 평가를 수행한다.

**핵심 흐름:**
1. 시나리오 폴더에서 `manifest.yaml` (또는 레거시 `scenario.yaml`) + `seed.ts`를 로드
2. 격리된 시나리오별 DB (`{tempDir}/{scenarioId}.db`)에 시드 데이터 삽입
3. `EvalAgentAdapter`를 통해 agent runtime 기동 (현재: `NarreServerAdapter` → narre-server HTTP/SSE)
4. 시나리오의 턴(사용자 메시지)을 session-runner가 전송, 응답 수집
5. 정량 검증 (DB 상태, 도구 호출/순서, 응답 내용, side-effect, row match) + 정성 평가 (LLM Judge)
6. 결과를 시나리오별 `results/` + run-level `runs/` 디렉토리에 이중 기록
7. 이전 run과 베이스라인 비교

**패키지 구성:**
- `private: true` (배포 대상 아님)
- 빌드: tsup (ESM only, `cli.ts` 단일 엔트리)
- 의존: `@netior/core`, `@netior/shared`, `@anthropic-ai/sdk`, `yaml`

---

## 2. 아키텍처

```
cli.ts
  ├── loader.ts           → 시나리오 번들 로드 (manifest.yaml / legacy)
  ├── harness.ts          → DB 초기화, 시드 실행, tempDir 관리
  ├── agents/
  │   ├── base.ts         → EvalAgentAdapter 인터페이스
  │   └── narre-server.ts → NarreServerAdapter (서버 lifecycle, SSE 파싱, 카드 응답)
  ├── runner/
  │   └── session-runner.ts → 시나리오 실행 (single-turn / conversation)
  ├── grader.ts           → 정량 검증 + LLM Judge + 메트릭 수집
  ├── comparator.ts       → 베이스라인 비교
  └── report.ts           → 결과 기록 (TSV + JSON + runs/)
```

**책임 분리:**
- **harness**: DB/시드만 담당. 서버 관리는 adapter가 담당.
- **adapter**: agent runtime lifecycle + SSE 파싱 + 카드 응답 제출. 인라인 `onCard` 콜백으로 스트림 도중 카드 처리.
- **session-runner**: adapter를 소비. single-turn vs conversation 분기, sessionId 관리, transcript 조립.
- **grader**: adapter-agnostic. transcript를 입력받아 검증 + 메트릭 계산.

---

## 3. Types (`src/types.ts`)

### ScenarioType / ScenarioLifecycle

```typescript
type ScenarioType = 'single-turn' | 'conversation';
type ScenarioLifecycle = 'draft' | 'active' | 'deprecated';
```

- `single-turn`: 사전 정의된 턴을 순서대로 전송. 세션 재사용 없음.
- `conversation`: 세션 연속성 유지. 첫 turn에서 sessionId 확보 후 이후 turn에 재사용. responder 선택적.

### ScenarioManifest

`manifest.yaml`의 파싱 결과. 시나리오 번들의 entrypoint.

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | 시나리오 고유 ID |
| `title` | `string` | 사람 읽기용 제목 |
| `description` | `string` | 시나리오 목적 설명 |
| `scenario_version` | `string` | 시나리오 의미적 버전 |
| `schema_version` | `number` | manifest 구조 버전 |
| `type` | `ScenarioType` | 실행 모드 |
| `lifecycle` | `ScenarioLifecycle` | 활성 상태 |
| `labels` | `string[]` | 검색/필터링용 태그 |
| `execution` | `{ supported_agents, required_capabilities }` | 호환성 제약 |
| `turn_plan` | `{ file: string }` | turns.yaml 경로 |
| `entrypoints` | `{ seed, responder? }` | 시드/응답자 스크립트 경로 |
| `assets` | `{ fixtures?, expectations?, verify?, rubrics?, goldens? }` | 자산 파일 참조 |

### ScenarioVersionInfo

manifest에서 추출되어 결과에 전달되는 버전 메타데이터. 레거시 시나리오는 `null`.

```typescript
interface ScenarioVersionInfo {
  scenario_version: string;
  schema_version: number;
  supported_agents: string[];
  required_capabilities: string[];
}
```

### EvalScenario

loader가 manifest (또는 레거시 scenario.yaml) + seed.ts + responder.ts에서 조합하는 런타임 시나리오 객체.

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | 시나리오 고유 ID |
| `description` | `string` | 시나리오 설명 |
| `type` | `ScenarioType` | `single-turn` 또는 `conversation` |
| `tags` | `string[]` | 필터링용 태그 |
| `turns` | `Turn[]` | 사용자 발화 목록 |
| `verify` | `VerifyItem[]` | 정량 검증 항목 |
| `qualitative` | `QualitativeItem[]` | LLM Judge 평가 기준 |
| `scenarioDir` | `string` | 시나리오 폴더 절대 경로 |
| `seed` | `(ctx: SeedContext) => Promise<void>` | 시드 함수 |
| `responder?` | `(card, ctx) => unknown` | UI 카드 자동 응답 함수 (선택적) |
| `versionInfo` | `ScenarioVersionInfo \| null` | manifest 메타데이터. 레거시는 `null` |

### VerifyItem — 정량 검증 단위

하나의 `VerifyItem`에 여러 검증 유형을 동시에 포함할 수 있다.

| 필드 | 설명 |
|------|------|
| `name` | 검증 항목 이름 (결과 리포트에 표시) |
| `db` | DB 행 존재/개수 검증. `table`, `condition`, `expect` (count, count_min, count_max, column_includes, not_null) |
| `db_absent` | DB 행 부재 검증. `table`, `condition` |
| `db_row_match` | 특정 컬럼값으로 행 찾기 + 추가 컬럼 검증. `table`, `match`, `expect_columns` |
| `side_effect` | 테이블 행 수 불변 검증 (의도하지 않은 변경 감지). `table`, `condition`, `expect_count` |
| `tool` | 도구 호출 횟수 검증. `name`, `expect` (count_min, count_max). 선택적 `sequence` (호출 순서 검증) |
| `tool_absent_in_turn` | 특정 turn에서 도구 미호출 검증 (0-indexed). `tool`, `turn` |
| `response` | 응답 텍스트 검증. `contains_all`, `contains_any`, `no_error` |

**db_row_match**: 보이는 컬럼값으로 매칭. rename과 delete+recreate를 구분하지 못함 (이름이 db_identity가 아닌 이유).

**tool_absent_in_turn**: cascade-delete처럼 "확인 전에 삭제하지 않았는가"를 검증하는 데 사용.

### Transcript & TurnTranscript

```typescript
interface Transcript {
  scenarioId: string;
  sessionId: string | null;
  turns: TurnTranscript[];
  totalToolCalls: number;
  cardResponseCount: number;    // 성공한 카드 응답 수
  sessionResumeCount: number;   // sessionId를 재사용한 turn 수
}

interface TurnTranscript {
  user: string;
  assistant: string;
  toolCalls: ToolCallRecord[];
  events: NarreStreamEvent[];
  errors: string[];             // SSE 에러 + 카드 응답 실패
}
```

### MetricValue

모든 메트릭은 값뿐 아니라 출처와 신뢰도를 함께 기록한다.

```typescript
interface MetricValue {
  value: number | null;
  source: 'runner' | 'agent_usage' | 'derived' | 'unsupported';
  confidence: 'exact' | 'estimated' | 'none';
}
```

### AgentInfo

```typescript
interface AgentInfo {
  id: string;
  name: string;
  version?: string;
  runtime: string;
  adapter_version?: string;
}
```

### ScenarioResult

```typescript
interface ScenarioResult {
  runId: string;
  scenarioId: string;
  timestamp: string;
  status: 'pass' | 'fail' | 'error' | 'skipped';
  agent: AgentInfo;
  scenarioVersion: string | null;   // manifest에서. 레거시는 null
  schemaVersion: number | null;
  gradingVersion: string;           // GRADING_VERSION 상수
  verifyResults: { passed: number; total: number; results: VerifyResult[] };
  judgeScores: JudgeScore[];
  judgeAvg: number | null;
  durationMs: number;
  metrics: Record<string, MetricValue>;
  transcript: Transcript;
  comparison?: ComparisonResult;    // 베이스라인 비교 결과
  error?: string;
  skipReason?: string;              // status=skipped일 때 사유
}
```

**status 의미**: 검증 결과를 반영. 실행 중 에러 (SSE 에러, 카드 실패)가 있어도 verify가 모두 통과하면 `pass`. 실행 에러는 `errors[]`와 `error_count` 메트릭으로 추적.

### ComparisonResult

```typescript
interface ComparisonResult {
  baselineRunId: string;
  previousStatus: ScenarioStatus;
  currentStatus: ScenarioStatus;
  statusChanged: boolean;
  verifyPassedDelta: number;
  judgeAvgDelta: number | null;     // 양쪽 모두 judge가 있을 때만
  metricDeltas: Record<string, number | null>;  // 양쪽 모두 numeric일 때만
}
```

### EvalOptions — CLI 옵션

```typescript
interface EvalOptions {
  scenario?: string;
  tag?: string;
  repeat: number;
  judge: boolean;
  port: number;
  baseline?: string;   // run ID substring 또는 'latest'
}
```

---

## 4. Agent Adapter (`src/agents/`)

### EvalAgentAdapter 인터페이스 (`base.ts`)

```typescript
interface EvalAgentAdapter {
  readonly agentId: string;
  readonly agentName: string;
  readonly runtimeType: 'http' | 'cli' | 'sdk';
  readonly capabilities: string[];

  getAgentInfo(): AgentInfo;
  setup(ctx: EvalRunContext): Promise<void>;
  sendTurn(input: SendTurnInput): Promise<AdapterTurnResult>;
  teardown(): Promise<void>;
}
```

- `startSession()` 없음 — 세션 생성은 `sendTurn()`에서 sessionId=null일 때 암묵적으로 발생.
- 카드 응답은 `sendTurn()`의 `onCard` 콜백으로 SSE 스트림 도중 인라인 처리.

### NarreServerAdapter (`narre-server.ts`)

| 메서드 | 역할 |
|--------|------|
| `setup()` | narre-server spawn, PID 파일 기록, health check 대기 |
| `sendTurn()` | POST `/chat`, SSE 파싱, 인라인 카드 응답 (`onCard` → POST `/chat/respond`) |
| `teardown()` | 자기가 띄운 프로세스만 kill, PID 파일 제거 |

**프로세스 소유권**: PID 파일에 `{ pid, runId, port, startedAt }` 기록. 다른 프로세스를 절대 kill하지 않음. 기존 서버가 살아 있으면 health probe 후 에러 (사용자에게 수동 정리 요청).

---

## 5. Session Runner (`src/runner/session-runner.ts`)

### `runScenario(adapter, scenario, projectId)` → `Transcript`

시나리오 타입에 따라 분기:
- `single-turn`: 각 turn을 독립적으로 전송. sessionId 재사용 없음.
- `conversation`: 첫 turn에서 sessionId 확보, 이후 turn에 재사용. responder가 있으면 `onCard` 콜백 구성.

`buildProjectMetadata()`로 narre-server용 메타데이터 구성 (`@netior/core` 직접 사용 — narre-server 전용, 향후 adapter별 분리 가능).

---

## 6. CLI (`src/cli.ts`)

### 사용법

```bash
pnpm --filter @netior/narre-eval build
pnpm --filter @netior/narre-eval eval

# tsx로 직접 실행 (개발용)
pnpm eval

# 옵션
node dist/cli.js --scenario init-project
node dist/cli.js --tag archetype
node dist/cli.js --repeat 3
node dist/cli.js --no-judge
node dist/cli.js --port 3200
node dist/cli.js --baseline latest
node dist/cli.js --baseline a3f2
```

### 옵션 정리

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--scenario <id>` | (전체) | 특정 시나리오 ID만 실행 |
| `--tag <tag>` | (전체) | 특정 태그 필터 |
| `--repeat <n>` | `1` | 반복 실행 횟수 |
| `--no-judge` | `false` | LLM Judge 비활성화 |
| `--port <n>` | `3199` | narre-server 포트 |
| `--baseline <id>` | `latest` | 비교 대상 run ID substring |

### 실행 흐름

1. runId 생성
2. `loadScenarios()`로 시나리오 로드 + 필터 적용
3. `NarreServerAdapter` 생성
4. 베이스라인 run 디렉토리 탐색
5. `repeat` 횟수만큼 루프:
   - 각 시나리오별:
     a. **호환성 검사**: `supported_agents` / `required_capabilities` 확인. 비호환 시 `skipped`
     b. `setupScenario()` — 시나리오별 DB 초기화 + 시드 실행
     c. `adapter.setup()` — narre-server 기동
     d. `runScenario(adapter, scenario, projectId)` — 턴 전송 + 응답 수집
     e. `gradeScenario()` — 검증 + 채점 + 메트릭 수집
     f. 베이스라인 비교 (이전 run 결과와 delta 계산)
     g. `recordResult()` — 시나리오별 결과 기록
     h. finally: `adapter.teardown()` + `teardownScenario()`
6. `recordRunResult()` — run-level 결과 기록
7. `printSummary()` — 콘솔 출력

### 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 필수 | narre-server + LLM Judge에 사용 |

---

## 7. Harness (`src/harness.ts`)

DB 초기화와 시드 실행만 담당. 서버 관리는 adapter로 이관됨.

### `setupScenario(scenarioDir, seedFn, scenarioId)` → `SetupResult`

1. 고유 임시 디렉토리 생성 (`narre-eval-{scenarioId}-{uuid}` — repeat 격리)
2. 시나리오별 DB 경로: `{tempDir}/{scenarioId}.db`
3. `initDatabase(dbPath)` — 마이그레이션 포함 DB 초기화
4. `SeedContext` 객체 구성 — `@netior/core`의 create 함수들을 래핑
5. `seedFn(ctx)` 실행
6. `{ projectId, tempDir, dbPath }` 반환

### `teardownScenario(tempDir)`

1. DB 연결 종료 (`closeDatabase()`)
2. 임시 디렉토리 삭제

---

## 8. Loader (`src/loader.ts`)

### 이중 모드

```
scenarios/
  init-project/
    manifest.yaml  ← 있으면 번들 로더
    turns.yaml
    seed.ts
    verify/checks.yaml
    rubrics/quality.yaml
  legacy-scenario/
    scenario.yaml  ← manifest 없으면 레거시 로더
    seed.ts
```

**번들 로더** (`loadFromManifest`):
1. `manifest.yaml` 파싱 → `ScenarioManifest`
2. `turn_plan.file` → `turns.yaml` 로드
3. `assets.verify` → `verify/*.yaml` 로드 (여러 파일 합산)
4. `assets.rubrics` → `rubrics/*.yaml` 로드
5. `entrypoints.seed` → dynamic import
6. `entrypoints.responder` → dynamic import (선택적)
7. `versionInfo` 구성 (scenario_version, schema_version, supported_agents, required_capabilities)

**레거시 로더** (`loadFromLegacy`):
1. `scenario.yaml` 파싱 (turns, verify, qualitative 인라인)
2. `seed.ts`, `responder.ts` dynamic import
3. `versionInfo: null`

---

## 9. Grader (`src/grader.ts`)

### 버전 상수

```typescript
const GRADING_VERSION = '2.0.0';  // 검증 유형/로직/메트릭 변경 시 bump
const JUDGE_VERSION = '1.0.0';    // judge prompt/scale/aggregation 변경 시 bump
```

### `gradeScenario(...)` → `ScenarioResult`

1. `gradeVerify()` — 정량 검증 실행
2. `runLlmJudge()` — 정성 평가 (옵션 활성화 시)
3. `deriveStatus()` — 검증 결과에서 status 도출
4. `buildMetrics()` — universal metrics 계산
5. 결과 조합

### 정량 검증 유형

| 함수 | 검증 | 실패 메시지 예시 |
|------|------|------------------|
| `gradeDb` | 행 수, 컬럼 포함, not null | `expected 3, got 2` |
| `gradeDbAbsent` | 행 부재 | `found 1 rows` |
| `gradeDbRowMatch` | 컬럼값으로 행 찾기 + 추가 컬럼 | `color: expected "#E74C3C", got "#000"` |
| `gradeSideEffect` | 테이블 행 수 불변 | `expected 3 rows in archetypes, got 4` |
| `gradeTool` | 도구 호출 횟수 범위 | `delete_archetype called 0 times (range: 1-∞)` |
| `gradeToolSequence` | 도구 호출 순서 | `expected "delete" after [list], but not found` |
| `gradeToolAbsentInTurn` | 특정 turn에서 도구 미호출 | `"delete_archetype" was called in turn 0, but should not have been` |
| `gradeResponse` | 응답 텍스트 포함/에러 | `not found in response` |

`gradeDbRowMatch`는 파라미터 바인딩 사용 (SQL injection 방지). null 비교는 명시적 처리.

### Universal Metrics

| 메트릭 | source | 설명 |
|--------|--------|------|
| `turn_count` | runner | 실행된 user turn 수 |
| `tool_call_count` | runner | 전체 도구 호출 수 |
| `unique_tools_used` | runner | 고유 도구 이름 수 |
| `latency_ms` | runner | 시나리오 전체 소요시간 |
| `error_count` | runner | turn errors + SSE errors 합계 |
| `card_response_count` | runner | 성공한 카드 응답 수 |
| `session_resume_count` | runner | sessionId 재사용 turn 수 |
| `token_input` | unsupported | (현재 미지원) |
| `token_output` | unsupported | (현재 미지원) |
| `token_total` | unsupported | (현재 미지원) |

**error/skipped 결과**: `errorMetrics()` (error_count=1), `skippedMetrics()` (error_count=0). 동일한 메트릭 키 세트.

### 정성 평가 (LLM Judge)

- 모델: `claude-sonnet-4-20250514`
- 각 rubric에 대해 1-5점 채점 + 근거 요청
- 모든 `JudgeScore`에 `judge_version` 포함

---

## 10. Comparator (`src/comparator.ts`)

### `findBaselineRunDir(runsDir, currentRunId, baselineArg?)` → `string | null`

- `'latest'` 또는 생략: 현재 run을 제외한 가장 최근 run 디렉토리
- 그 외: run ID substring으로 매칭, 복수 매칭 시 가장 최근 선택 (역시간순 정렬로 결정론적)
- 현재 run 자신은 `!e.includes(currentRunId)` 필터로 제외

### `compareResults(current, baseline)` → `ComparisonResult`

- `statusChanged`: 이전/현재 status 비교
- `verifyPassedDelta`: passed 수 차이
- `judgeAvgDelta`: 양쪽 모두 judge가 있을 때만 numeric, 아니면 null
- `metricDeltas`: 양쪽 모두 값이 있을 때만 numeric, 아니면 null

---

## 11. Report (`src/report.ts`)

### 이중 기록

**시나리오별 (레거시)**: `scenarios/{id}/results/`
```
results.tsv           # 누적 (append). 컬럼: timestamp, scenario_id, status, verify_pass, ...
transcripts/
  {timestamp}_{id}.json
```

**run-level**: `runs/{timestamp}_{runId}/`
```
run.json              # RunMetadata (runId, startedAt, finishedAt, agent, scenarioIds)
scenarios/
  {scenarioId}/
    result.json       # ScenarioResult (transcript 제외)
    transcript.json   # Transcript만 별도
```

`runs/` 위치는 의도적으로 `packages/narre-eval/runs/` (패키지 로컬).

### `printSummary(results)`

```
============================================================
  EVAL RESULTS
============================================================

  [OK] init-project
      Verify: 4/4  Judge: 4.5  6 tools  3.2s
      Baseline: pass (unchanged)  verify delta: +0

  [FAIL] cascade-delete
      Verify: 2/3  Judge: 3.0  4 tools  2.1s
      - 종속 Concept은 유지됨: expected 1, got 0

  [SKIP] codex-only-scenario
      Reason: agent "narre-server" not in supported_agents [codex]

  [ERR] type-update
      Error: narre-server health check timed out

------------------------------------------------------------
  Total: Verify 6/7  Scenarios 4
============================================================
```

---

## 12. Scenarios

### 시나리오 번들 구조

```
scenarios/{id}/
  manifest.yaml       # 시나리오 정체성, 버전, 호환성, 자산 참조
  turns.yaml           # 사용자 발화 정의
  seed.ts              # 시드 데이터 생성
  responder.ts         # UI 카드 자동 응답 (선택적)
  verify/
    checks.yaml        # 정량 검증 항목
  rubrics/
    quality.yaml       # LLM Judge 기준
  fixtures/            # 입력 파일 (선택적)
```

### 12-1. init-project

**목적:** 빈 프로젝트에 역사 도메인 타입을 설정할 수 있는지 평가.

**타입:** `single-turn` | **시드:** 프로젝트 `조선시대` (아크타입 없음)

**발화:** `"역사 프로젝트야. 인물, 사건, 장소 아크타입이 필요해. 만들어줘."`

**검증:** 아크타입 3개 생성 (name 포함), 응답에 이름 포함, 에러 없음, create_archetype 3-20회

**태그:** `archetype`, `init`

### 12-2. type-update

**목적:** 기존 아크타입의 이름 변경이 가능한지 평가.

**타입:** `single-turn` | **시드:** 프로젝트 `조선시대` + 아크타입 3개 (인물, 사건, 장소)

**발화:** `"사건 아크타입을 문헌으로 이름 바꿔줘"`

**검증:**
- 기존: 아크타입 이름 변경됨, 사건 부재, 응답에 문헌 포함, 에러 없음
- 강화: 문헌 row의 color가 `#E74C3C` 유지 (db_row_match), 아크타입 총 3개 유지 (side_effect), 개념 0개 유지 (side_effect), list → update 순서 (tool.sequence)

**태그:** `archetype`, `update`

### 12-3. cascade-delete

**목적:** 종속 데이터가 있는 아크타입 삭제 시 경고 및 확인 절차를 수행하는지 평가.

**타입:** `conversation` | **시드:** 프로젝트 `조선시대` + 아크타입 `인물` + 개념 `세종대왕`

**발화:**
1. `"인물 아크타입을 삭제해줘"` (요청)
2. `"응, 삭제해"` (확인)

**검증:**
- 기존: 인물 아크타입 삭제됨, 세종대왕 개념 유지, 에러 없음
- 강화: 세종대왕의 archetype_id가 null (db_row_match), 개념 총 1개 유지 (side_effect), list → delete 순서 (tool.sequence), **turn 0에서 delete_archetype 미호출** (tool_absent_in_turn — 확인 전 삭제 방지)

**태그:** `archetype`, `delete`, `cascade`

---

# Part 2: 빌드/설정

## 1. 모노레포 설정

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```

### turbo.json — 파이프라인

| 태스크 | `dependsOn` | 캐시 | 설명 |
|--------|-------------|------|------|
| `build` | `^build` | O | `dist/**` 출력 |
| `dev` | 없음 | X | persistent 모드 |
| `lint` | `^build` | O | |
| `typecheck` | `^build` | O | |
| `test` | `^build` | O | |
| `clean` | 없음 | X | |

빌드 순서: `shared` → `core` → `mcp`, `narre-server`, `desktop-app`, `narre-eval`

---

## 2. 루트 package.json

| 스크립트 | 설명 |
|----------|------|
| `build` | 전체 패키지 빌드 |
| `dev:desktop` | Electron 앱 개발 실행 |
| `typecheck` | 전체 타입 검사 |
| `test` | 전체 테스트 |
| `eval` | narre-eval 실행 (tsx) |

---

## 3. narre-eval 빌드 설정 (`tsup.config.ts`)

```typescript
export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['better-sqlite3', '@netior/core', '@netior/shared', '@anthropic-ai/sdk'],
});
```

---

## 4. Claude Code 설정 (`.claude/settings.json`)

| 훅 이벤트 | 명령어 | 설명 |
|-----------|--------|------|
| `SessionStart` | `node .claude/hooks/validate-versions.mjs` | 세션 시작 시 `versions.md` 동기화. impact/contracts 포함 |
