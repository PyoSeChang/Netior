# DESIGN: Narre Eval

## Overview

Narre(Netior AI 어시스턴트)의 시나리오 기반 정량/정성 평가 환경.
실제 agent-server를 end-to-end로 테스트하며, 프레임워크 없이 컨벤션으로 구조를 만든다.

## Principles

| 출처 | 원칙 | 적용 |
|------|------|------|
| Anthropic | 결과 채점, 경로 무시 | tool call 시퀀스 매칭 X, DB 최종 상태만 검증 |
| Anthropic | 결정적 grader 우선 | CRUD → DB assertion, LLM judge는 UX 품질만 |
| autoresearch | 프레임워크 = 컨벤션 | 파일 구조 + 실행 규칙, 외부 의존 없음 |
| autoresearch | read-only 평가 harness | 시나리오 정의 + assertion은 Narre가 수정 불가 |
| autoresearch | git-as-ledger | 매 실행 결과를 results.tsv에 구조화 기록 |
| MCP-Universe | execution-based eval | 실제 MCP 서버 + 실제 DB 상태 검증 |

## Architecture

```
harness.ts                    runner.ts                   grader.ts
────────────                  ─────────                   ─────────
dev DB 초기화 (seed)    →     시나리오 YAML 로드     →    정량: DB 직접 쿼리
netior-mcp spawn (stdio)         POST /chat (SSE)            정성: Claude judge
agent-server spawn             응답 + tool calls 수집      ↓
health check 대기              턴 순차 전송               report.ts
                               transcript 반환             results.tsv 기록
```

### 실행 경로 (실제 Narre e2e)

```
eval runner
  → HTTP POST /chat (SSE) → agent-server :3100
                               → Claude Agent SDK query()
                               → netior-mcp (stdio)
                               → @netior/core → dev DB
```

mock 없음. 실제 Narre가 받는 것과 동일한 요청 경로.

## Package Structure

```
packages/narre-eval/
├── scenarios/
│   ├── 01-init-project.yaml
│   ├── 02-type-crud.yaml
│   └── ...
├── src/
│   ├── runner.ts           # 시나리오 실행, agent-server에 HTTP+SSE 요청
│   ├── harness.ts          # DB 초기화, netior-mcp/agent-server 프로세스 관리
│   ├── grader.ts           # DB assertion + LLM judge
│   └── report.ts           # results.tsv 생성, transcript 저장
├── results/
│   ├── results.tsv         # 구조화된 실행 기록 (git 추적)
│   └── transcripts/        # 실행별 전체 대화 기록 (디버깅용)
└── package.json
```

## Scenario Schema

```yaml
id: init-history-project
description: "빈 프로젝트에 역사 도메인 타입 세팅"
tags: [archetype, init]

# ── DB 초기 상태 ──
seed:
  project:
    name: "조선시대"
    root_dir: "C:/tmp/eval-project"
  archetypes: []
  relation_types: []
  canvas_types: []

# ── 대화 턴 (고정 시퀀스) ──
turns:
  - role: user
    content: "역사 프로젝트야. 인물, 사건, 장소 아크타입이 필요해"
  - role: user
    content: "좋아 만들어줘"

# ── 평가 ──
assertions:
  # 정량: DB 최종 상태
  db:
    - table: archetypes
      condition: "project_id = {{project_id}}"
      expect:
        count_min: 3
        column_includes:
          name: ["인물", "사건", "장소"]

    - table: archetypes
      condition: "project_id = {{project_id}} AND name = '인물'"
      expect:
        count: 1
        not_null: [icon, color]

  # 정량: 응답 텍스트
  response:
    - contains_all: ["인물", "사건", "장소"]
    - no_error: true

  # 정량: 도구 호출 범위 (비정상 탐지용, 경로 강제 아님)
  tool_count:
    min: 1
    max: 20

  # 정성: LLM judge (항목별 1-5점)
  qualitative:
    - rubric: "사용자 요청을 정확히 반영한 타입을 생성했는가"
    - rubric: "생성 결과를 사용자가 확인할 수 있게 보고했는가"
    - rubric: "불필요한 추가 작업 없이 요청만 수행했는가"
```

### Assertion Types

| 종류 | 검증 대상 | 용도 |
|------|-----------|------|
| `db` | 최종 DB 상태 | 생성/수정 결과 확인 |
| `db_absent` | 레코드 부재 | 삭제 검증 |
| `response` | Narre 텍스트 응답 | 키워드 포함, 에러 없음, 언어 확인 |
| `tool_count` | 도구 호출 횟수 범위 | 무한루프/미호출 탐지 (경로 강제 아님) |
| `qualitative` | LLM judge rubric | UX 품질, 자연스러움, 적절성 |

## Report Format

### results.tsv

```tsv
timestamp	scenario_id	db_pass	db_total	response_pass	tool_calls	judge_avg	judge_scores	duration_ms	notes
2026-04-01T14:00	init-history	3	3	2/2	5	4.3	[5,4,4]	12400	
2026-04-01T14:01	type-crud	2	3	1/1	8	3.7	[4,4,3]	18200	db: relation_type color null
```

### Transcript (per run)

```
results/transcripts/2026-04-01T14-00_init-history.json
```

전체 대화 기록 — 각 턴의 user 입력, Narre 응답, tool calls, tool results 포함.
프롬프트 튜닝 시 diff 비교 가능.

## Execution

```bash
# 전체 시나리오 실행
pnpm eval

# 특정 시나리오
pnpm eval -- --scenario init-history

# 태그 필터
pnpm eval -- --tag archetype

# 반복 실행 (pass@k 측정)
pnpm eval -- --repeat 3
```

### 실행 순서

1. harness: dev DB 경로 확인 → 테이블 초기화 → seed 삽입
2. harness: netior-mcp spawn, agent-server spawn, health check
3. runner: 시나리오 로드 → 턴 순차 전송 (HTTP+SSE) → transcript 수집
4. grader: DB assertion (pass/fail) + LLM judge (1-5점)
5. report: results.tsv append + transcript 저장
6. harness: 프로세스 정리

시나리오 간 독립. 매 시나리오 시작 전 DB 초기화.

## Phased Rollout

### Phase 1: Eval 인프라 (MVP)

- 패키지 구조, harness, runner, grader, report 구현
- 2-3개 시나리오로 파이프라인 검증
  - Init (빈 프로젝트 타입 세팅)
  - Type CRUD (생성/수정/삭제)
  - Edge case (종속 삭제, 중복 이름)

### Phase 2: 실사용 시나리오

- 도메인 특화 시나리오 (소설 세계관, 학술 연구 등)
- 예: 세계관 데이터 시딩 → 의도적 오류 삽입 → Narre가 찾아내는지
- 정성 평가 비중 증가, rubric 고도화

## Design Decisions

### 왜 자체 구축인가

- Promptfoo 등 기존 프레임워크는 MCP provider를 지원하지만, Narre의 도메인 특화 시나리오(세계관 오류 탐지 등)에는 커스텀 harness가 필요
- autoresearch의 "프레임워크 없이 컨벤션"이 유지보수와 이해 비용 모두 낮음
- eval runner 자체도 Claude SDK agent로 구축하므로 일관된 스택

### 왜 경로 무시인가

Narre는 같은 결과에 도달하는 tool call 경로가 다양:
- "인물 아크타입 만들어" → `create_archetype` 1회
- "인물, 사건, 장소 만들어" → `create_archetype` 3회, 또는 순서가 다를 수 있음
- 확인 질문 후 만들 수도, 바로 만들 수도 있음

tool call 시퀀스를 strict match하면 false negative가 많아진다. DB 최종 상태가 올바르면 pass.

### 왜 실제 e2e인가

- mock하면 agent-server ↔ netior-mcp 통합, SSE 스트리밍, 프로세스 관리 등을 검증 못함
- Narre의 가치는 "실제로 DB를 바꾸는 것"이므로, 실제 DB 변경을 검증해야 의미 있음
