---
name: narre-eval
description: "Evaluate Narre AI assistant quality via scenario-based testing. TRIGGER when: user says '/narre-eval', 'eval narre', 'narre 평가', 'narre 테스트', or asks to test/evaluate Narre's tool calling, conversation quality, or type system management capabilities. Runs real e2e scenarios against narre-server, grades DB outcomes + conversation quality."
---

# Narre Eval

Scenario-based evaluation of Narre (Netior's AI assistant). Run real conversations against narre-server and grade results by checking DB state and conversation quality.

## Architecture

```
packages/narre-eval/
  scenarios/
    {scenario-name}/
      scenario.yaml        # 정의: id, type, turns, verify, qualitative
      seed.ts              # DB + 파일시스템 초기화 스크립트
      responder.ts         # (conversation만) UI 카드 자동 응답 전략
      fixtures/            # (선택) 시드용 파일들
      results/
        results.tsv        # 실행 히스토리
        transcripts/       # 개별 실행 상세 JSON
  src/
    cli.ts                 # 진입점
    types.ts               # EvalScenario, VerifyItem, SeedContext 등
    loader.ts              # 폴더 기반 시나리오 로딩
    harness.ts             # DB 초기화, tempDir 관리, narre-server 프로세스
    runner.ts              # 시나리오 실행 (single-turn / conversation)
    grader.ts              # verify 채점 + LLM judge
    report.ts              # 시나리오별 결과 저장 + 콘솔 요약
```

## Scenario Types

| Type | 설명 | 턴 | UI 카드 응답 |
|------|------|------|------------|
| `single-turn` | 고정 턴 순차 전송 | YAML에 정의 | 불필요 |
| `conversation` | Narre 카드에 동적 응답 | YAML 첫 턴 + responder.ts | responder.ts 필수 |

## Scenario Format

### scenario.yaml

```yaml
id: init-project
description: "빈 프로젝트에 역사 도메인 타입 세팅 요청"
type: single-turn
tags: [archetype, init]

turns:
  - role: user
    content: "역사 프로젝트야. 인물, 사건, 장소 아크타입이 필요해."

verify:
  - name: "요청한 3개 아크타입이 생성됨"
    db:
      table: archetypes
      expect:
        count_min: 3
        column_includes:
          name: ["인물", "사건", "장소"]

  - name: "에러 없음"
    response:
      no_error: true

  - name: "propose 도구 사용"
    tool:
      name: propose
      expect:
        count_min: 1

qualitative:
  - rubric: "사용자 요청을 정확히 수행했는가"
```

### verify 항목 종류

| 필드 | 검증 대상 |
|------|----------|
| `db` | DB 테이블 조회 (count, column_includes, not_null) |
| `db_absent` | 레코드 부재 확인 |
| `tool` | 특정 도구 호출 횟수 |
| `response` | 응답 텍스트 (contains_all, contains_any, no_error) |

모든 verify에 `name` 필수 — 리포트에 의도가 표시됨.

### seed.ts

```typescript
import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  const project = ctx.createProject({ name: '조선시대', root_dir: ctx.tempDir });
  ctx.createArchetype({ project_id: project.id, name: '인물', icon: 'user', color: '#4A90D9' });
}
```

SeedContext 제공: `createProject`, `createArchetype`, `createRelationType`, `createCanvasType`, `createConcept`, `createModule`, `addModuleDirectory`, `copyFixtures()`.

### responder.ts (conversation만)

```typescript
import type { NarreCard, ResponderContext } from '../../src/types.js';

export default function respond(card: NarreCard, ctx: ResponderContext): unknown {
  switch (card.type) {
    case 'proposal': return { action: 'confirm', rows: card.rows };
    case 'interview': return { selected: [card.options[0].label] };
    case 'permission': return { action: card.actions[0].key };
  }
}
```

## Workflow

### 자동 실행 (CLI)

```bash
# 전체 실행
pnpm --filter @netior/narre-eval eval:dev

# 특정 시나리오
pnpm --filter @netior/narre-eval eval:dev -- --scenario init-project

# 태그 필터
pnpm --filter @netior/narre-eval eval:dev -- --tag archetype

# LLM judge 비활성화
pnpm --filter @netior/narre-eval eval:dev -- --no-judge

# 반복 실행
pnpm --filter @netior/narre-eval eval:dev -- --repeat 3
```

### 수동 실행 (skill에서)

1. 하네스 스크립트로 환경 준비:
```bash
npx tsx .claude/skills/narre-eval/scripts/harness.ts setup
npx tsx .claude/skills/narre-eval/scripts/harness.ts start-server
```

2. curl로 직접 대화:
```bash
curl -X POST http://localhost:3199/chat \
  -H "Content-Type: application/json" \
  -d '{"projectId": "<ID>", "message": "...", "projectMetadata": {...}}' \
  --no-buffer
```

3. MCP 도구로 DB 상태 확인 (`list_archetypes` 등)

4. 정리:
```bash
npx tsx .claude/skills/narre-eval/scripts/harness.ts teardown
```

## Output Format

콘솔:
```
[OK]  init-project
  [PASS] 요청한 3개 아크타입이 생성됨
  [PASS] 에러 없음
  [3/5] 사용자 요청을 정확히 수행했는가
```

파일: `scenarios/{name}/results/results.tsv` + `transcripts/{timestamp}.json`

## Available Scenarios

| ID | Type | 설명 |
|----|------|------|
| init-project | single-turn | 빈 프로젝트에 아크타입 생성 |
| type-update | single-turn | 기존 아크타입 이름 변경 |
| cascade-delete | single-turn | 종속 데이터 있는 아크타입 삭제 경고 |

## Key Files

- CLI: `packages/narre-eval/src/cli.ts`
- Types: `packages/narre-eval/src/types.ts`
- Scenarios: `packages/narre-eval/scenarios/`
- Harness script: `.claude/skills/narre-eval/scripts/harness.ts`
