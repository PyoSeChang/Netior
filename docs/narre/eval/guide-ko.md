# narre-eval 가이드

`narre-eval`은 Narre를 시나리오 기반으로 실행하고, 결과물 품질과 tool use를 함께 평가하는 CLI 패키지다.  
이 문서는 **지금 저장소 기준으로 실제로 어떻게 쓰는지**만 정리한다.

배경 설계 문서는 따로 있다.

- [reference-ko.md](reference-ko.md)
- [codex-owned-loop-ko.md](codex-owned-loop-ko.md)
- [v2-refactor-plan-ko.md](v2-refactor-plan-ko.md)
- [tui-spec-ko.md](tui-spec-ko.md)

## 1. 현재 상태

지금 `narre-eval`은 다음을 지원한다.

- 시나리오 로딩
- seed 기반 프로젝트/DB 초기화
- `narre-server` 실행 및 대화 수행
- transcript 수집
- deterministic verify
- LLM judge
- tester 자동응답
- tool-use analyzer
- run artifact 저장

아직 없는 것:

- `narre-eval chat`
- `narre-eval codex`
- interactive TUI
- multi-agent execution

즉 **현재는 명령형 CLI**다.

## 2. 패키지 위치

- 패키지: [packages/narre-eval](../../../packages/narre-eval)
- 엔트리: [src/cli.ts](../../../packages/narre-eval/src/cli.ts)
- 시나리오: [packages/narre-eval/scenarios](../../../packages/narre-eval/scenarios)
- 결과물: [packages/narre-eval/runs](../../../packages/narre-eval/runs)

## 3. 기본 명령

개발용 실행:

```powershell
pnpm --filter @netior/narre-eval eval:dev --scenario init-project --no-judge
```

빌드 후 실행:

```powershell
pnpm --filter @netior/narre-eval build
pnpm --filter @netior/narre-eval eval --scenario init-project --no-judge
```

타입 확인:

```powershell
pnpm --filter @netior/narre-eval typecheck
```

## 4. CLI 옵션

현재 지원 옵션:

- `--scenario <id>`: 특정 시나리오 하나만 실행
- `--tag <tag>`: 특정 태그가 붙은 시나리오만 실행
- `--repeat <n>`: 동일 세트를 여러 번 반복
- `--no-judge`: LLM judge 비활성화
- `--port <n>`: `narre-server` 포트 지정
- `--baseline <id|latest>`: 이전 run과 비교
- `--run-spec <path>`: run spec YAML 파일 적용

예시:

```powershell
pnpm --filter @netior/narre-eval eval:dev --tag fantasy --no-judge
pnpm --filter @netior/narre-eval eval:dev --scenario fantasy-character-orm --repeat 3 --no-judge
pnpm --filter @netior/narre-eval eval:dev --scenario type-update --baseline latest
```

## 5. Provider 설정

`narre-eval`은 내부적으로 `narre-server`를 띄우고, target provider를 환경변수로 넘긴다.

### Claude

```powershell
$env:NARRE_PROVIDER='claude'
$env:ANTHROPIC_API_KEY='...'
pnpm --filter @netior/narre-eval eval:dev --scenario init-project
```

### OpenAI

```powershell
$env:NARRE_PROVIDER='openai'
$env:OPENAI_API_KEY='...'
pnpm --filter @netior/narre-eval eval:dev --scenario init-project --no-judge
```

### Codex

```powershell
$env:NARRE_PROVIDER='codex'
pnpm --filter @netior/narre-eval eval:dev --scenario fantasy-character-orm --no-judge
```

Codex는 추가로 다음 환경변수를 쓸 수 있다.

- `NARRE_CODEX_MODEL`
- `NARRE_CODEX_SETTINGS_JSON`

주의:

- judge를 켜면 현재 judge는 `Anthropic` SDK를 사용한다.
- 즉 target provider가 `codex`여도 judge를 켜면 `ANTHROPIC_API_KEY`가 필요하다.
- judge 없이 target provider만 보고 싶으면 `--no-judge`를 쓰는 편이 안전하다.

## 6. Run Spec

`run spec`은 특정 run에서 시나리오 실행 설정을 덮어쓰는 YAML 파일이다.

지원 필드:

- `run_id`
- `scenario_id`
- `tag`
- `repeat`
- `judge`
- `port`
- `baseline`
- `agent_id`
- `provider`
- `tester`
- `execution_mode`
- `analysis_targets`
- `provider_settings`
- `tester_settings`

예시:

```yaml
run_id: auto
scenario_id: fantasy-character-orm
provider: codex
tester: conversation-tester
judge: false
provider_settings:
  model: gpt-5.4-mini
```

실행:

```powershell
pnpm --filter @netior/narre-eval eval:dev --run-spec .\my-run-spec.yaml
```

## 7. 시나리오 구조

각 시나리오는 보통 이런 구조를 가진다.

```text
scenarios/<scenario-id>/
  manifest.yaml
  turns.yaml
  seed.ts
  verify/
    checks.yaml
  rubrics/
    quality.yaml
```

필수 파일:

- `manifest.yaml`
- `turns.yaml`
- `seed.ts`
- `verify/checks.yaml`

선택 파일:

- `responder.ts`
- `rubrics/quality.yaml`
- `fixtures/`

## 8. 시나리오 타입

현재는 두 가지가 있다.

- `single-turn`
- `conversation`

### single-turn

- 각 turn을 독립적으로 보냄
- 세션 이어붙이기 없음
- 간단한 schema 작업에 적합

### conversation

- sessionId를 이어서 보냄
- 확인/승인 흐름 검증에 적합
- destructive action 전 확인 같은 시나리오에 적합

## 9. 현재 들어 있는 시나리오

기존 시나리오:

- `init-project`
- `type-update`
- `cascade-delete`

이번에 추가된 판타지 worldbuilding 시나리오:

- `fantasy-world-bootstrap`
- `fantasy-character-orm`
- `fantasy-quest-orm`

### fantasy-world-bootstrap

목적:

- 판타지 세계관 프로젝트를 처음 시작하면서
- 핵심 schema과 relation type을 한 번에 세팅하는지 평가

핵심 검증:

- `Character`, `Faction`, `Region`, `City`, `Artifact`, `Event`
- `allied_with`, `rules`, `located_in`, `possesses`

### fantasy-character-orm

목적:

- `Character`, `City`에 ORM식 `schema_ref` 필드를 추가하는지 평가

핵심 검증:

- `Character.faction -> Faction`
- `Character.home_region -> Region`
- `Character.current_city -> City`
- `Character.related_characters -> Character`
- `City.region -> Region`

### fantasy-quest-orm

목적:

- `Quest` schema을 만들고
- reference field와 workflow field를 함께 설계하는지 평가

핵심 검증:

- `giver -> Character`
- `target_region -> Region`
- `required_artifacts -> Artifact`
- `status`, `priority`는 `select`

## 10. Verify 항목

현재 `verify/checks.yaml`에서 지원하는 주요 항목:

- `db`
- `db_absent`
- `db_row_match`
- `side_effect`
- `tool`
- `tool_absent_in_turn`
- `response`
- `analysis.tool_use`

### db

DB row 개수나 특정 컬럼 값 포함 여부를 본다.

```yaml
- name: "Quest schema exists"
  db:
    table: schemas
    expect:
      column_includes:
        name: ["Quest"]
```

### db_absent

특정 row가 없어야 할 때 쓴다.

### db_row_match

특정 row가 존재하고, 추가 컬럼까지 맞는지 본다.

### side_effect

의도하지 않은 row 증가/감소가 없는지 본다.

### tool

특정 tool이 몇 번 호출됐는지 본다.

### tool_absent_in_turn

특정 turn에서 tool이 호출되면 안 될 때 쓴다.

### response

응답 텍스트에 특정 문자열이 있는지, 에러가 없는지 본다.

### analysis.tool_use

analyzer가 어떤 finding을 내야 하는지 검증한다.

예:

```yaml
- name: "analysis: project binding violation absent"
  analysis:
    tool_use:
      findings_absent: [project_binding_violation]
      summary:
        project_binding_violation_count:
          count: 0
```

## 11. Tester

현재 `narre-eval`에는 자동 tester runtime이 있다.

위치:

- [tester-runtime.ts](../../../packages/narre-eval/src/tester-runtime.ts)

역할:

- 카드 수신
- scenario `responder`가 있으면 우선 사용
- 없으면 기본 tester 정책으로 자동 응답

현재 기본 응답 정책:

- `draft`: confirm
- `proposal`: confirm rows
- `permission`: 기본 action 선택
- `approval-sensitive` tester면 non-danger 또는 deny 쪽 우선
- `interview`: 첫 옵션 선택
- `summary`: 응답 없음

tester trace는 artifact에 남는다.

## 12. Analyzer

위치:

- [analyzer.ts](../../../packages/narre-eval/src/analyzer.ts)

현재 rule:

- `prompt_digest_redundant_lookup`
- `broad_discovery_overuse`
- `redundant_repeated_lookup`
- `project_binding_violation`
- `tool_budget_overrun`

현재는 rule-based다.  
즉 LLM이 아니라 transcript/tool trace를 보고 deterministic하게 판정한다.

## 13. 결과물 위치

run 결과는 여기 저장된다.

- [packages/narre-eval/runs](../../../packages/narre-eval/runs)

각 run 디렉터리 구조:

```text
runs/<timestamp>_<runId>/
  run.json
  run-spec.json
  scenarios/
    <scenarioId>/
      result.json
      transcript.json
      tester-trace.json
      analysis.json
```

### run.json

run 전체 메타데이터:

- `runId`
- 시작/종료 시각
- agent 정보
- run spec
- scenario execution 목록

### result.json

시나리오 단위 결과:

- status
- verifyResults
- judgeScores
- metrics
- analysis

### transcript.json

대화와 tool call trace의 원문

### tester-trace.json

tester가 어떤 카드에 어떤 응답을 했는지 기록

### analysis.json

tool-use analyzer 결과만 별도로 저장

## 14. 무엇을 확인해야 하나

실행 후 최소한 이 5개를 보면 된다.

1. `status`
2. `verifyResults`
3. `analysis.findings`
4. `project_binding_violation_count`
5. `transcript`

### 정상 run에서 보통 기대하는 것

- `status = pass`
- `verifyResults` 전부 통과
- `analysis.findings`가 너무 많지 않음
- `project_binding_violation_count = 0`
- 응답에 요청한 schema/field 이름이 정확히 들어감

### 실패했을 때 흔한 원인

- field 이름을 멋대로 바꿈
- `schema_ref` 대신 `relation`으로 만듦
- discovery tool을 너무 많이 씀
- 확인 전 mutation
- `project_id`를 직접 tool input에 넣음

## 15. 실제 실행 예시

판타지 시나리오 전체:

```powershell
pnpm --filter @netior/narre-eval eval:dev --tag fantasy --no-judge
```

하나만:

```powershell
pnpm --filter @netior/narre-eval eval:dev --scenario fantasy-world-bootstrap --no-judge
pnpm --filter @netior/narre-eval eval:dev --scenario fantasy-character-orm --no-judge
pnpm --filter @netior/narre-eval eval:dev --scenario fantasy-quest-orm --no-judge
```

baseline 비교:

```powershell
pnpm --filter @netior/narre-eval eval:dev --scenario fantasy-character-orm --baseline latest --no-judge
```

반복 실행:

```powershell
pnpm --filter @netior/narre-eval eval:dev --scenario fantasy-character-orm --repeat 3 --no-judge
```

## 16. 새 시나리오 추가 방법

가장 쉬운 방법은 기존 시나리오를 하나 복사해서 바꾸는 것이다.

절차:

1. `packages/narre-eval/scenarios/<new-id>/` 디렉터리 생성
2. `manifest.yaml` 작성
3. `turns.yaml` 작성
4. `seed.ts` 작성
5. `verify/checks.yaml` 작성
6. 필요하면 `rubrics/quality.yaml` 작성
7. `pnpm --filter @netior/narre-eval typecheck`
8. `eval:dev --scenario <new-id> --no-judge`

### seed.ts 작성 원칙

- 반드시 `ctx.createProject()`를 호출해야 한다
- 필요한 schema/relation type/concept만 seed한다
- 가능한 한 최소 fixture만 만든다

### verify/checks.yaml 작성 원칙

- 결과 검증은 DB 기준으로 쓴다
- 응답 검증은 최소한의 문자열만 본다
- tool count는 너무 빡빡하게 잡지 않는다
- tool-use rule 검증이 필요하면 `analysis.tool_use`를 쓴다

## 17. PowerShell 팁

Windows PowerShell에서는 환경변수 설정을 이렇게 한다.

```powershell
$env:NARRE_PROVIDER='codex'
$env:ANTHROPIC_API_KEY='...'
$env:OPENAI_API_KEY='...'
```

명령 체이닝에서 `&&`가 안 되는 환경이 있을 수 있으니, 필요하면 한 줄씩 따로 실행하는 편이 낫다.

## 18. 현재 제한

지금 기준 제한은 이렇다.

- interactive chat 모드 없음
- multi-agent 실행 없음
- judge는 Anthropic 고정
- analyzer rule은 아직 1차 버전
- scenario 실행 결과는 provider 특성에 따라 흔들릴 수 있음

즉 지금 `narre-eval`은 **정식 운영 CLI의 초기 버전**이고, 아직 “대화형 운영 셸”까지는 아니다.

## 19. 추천 사용 순서

처음 쓰는 경우:

1. `typecheck`
2. `fantasy-world-bootstrap --no-judge`
3. `fantasy-character-orm --no-judge`
4. `fantasy-quest-orm --no-judge`
5. 결과물에서 `result.json`, `analysis.json`, `transcript.json` 확인

그 다음:

1. provider를 `codex`로 바꿔 보기
2. baseline 비교 켜기
3. 새 시나리오 추가

## 20. 한 줄 요약

`narre-eval`은 지금 기준으로 **시나리오를 seed하고, `narre-server`를 target provider로 실행하고, transcript/tester/tool-use까지 artifact로 남기는 명령형 eval CLI**다.
