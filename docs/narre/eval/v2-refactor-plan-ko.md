# Narre Eval V2 Refactor Plan

작성일: 2026-04-17  
상태: Draft  
인코딩: UTF-8

## 1. 문서 목적

이 문서는 `narre-eval`을 다음 목표에 맞게 재설계하기 위한 구체적인 리팩터링 계획을 정리한다.

- `narre-eval`을 재현 가능한 eval 실행 엔진으로 유지한다.
- Codex가 시나리오 생성, 선택, 실행, 평가, 분석, 개선점 도출까지 전체 사이클을 맡을 수 있게 한다.
- `narre-server`의 `codex` provider를 eval에 정식 적용할 수 있게 한다.
- 이후 multi-agent 확장과 richer tool-use 평가를 수용할 수 있게 한다.

이 문서는 구현 순서, CLI 표면, 실행 아키텍처, artifact 계약, Codex loop orchestration까지 포함하는 **실행 계획 문서**다.

## 2. 핵심 결정

### 2.1 `narre-eval`은 skill이 아니라 정식 프로그램이다

`narre-eval`은 Codex skill이나 보조 prompt가 아니라, 명시적인 command surface를 가진 정식 프로그램이어야 한다.

이유는 다음과 같다.

- 실행 계약을 강하게 유지해야 한다.
- 결과 artifact를 구조적으로 남겨야 한다.
- 같은 입력으로 다시 실행 가능한 재현성이 필요하다.
- batch/CI 실행과 interactive 운영을 함께 가져가야 한다.

### 2.2 `narre-eval`은 `narre-server`의 thin client다

`narre-eval`은 `narre-server`를 테스트하는 클라이언트다.  
따라서 아래 책임은 `narre-eval`이 가지지 않는다.

- system prompt 조립
- project schema digest 조립
- current project context 해석

이 책임은 `narre-server`가 가진다.  
`narre-eval`은 `projectId`, 실행 spec, message/mentions, tester response만 다룬다.

### 2.3 기본 실행은 headless다

기본 모드는 실시간 감시가 아니라 headless execution이다.

- 실행 중 사람이 보고 개입하는 UI는 기본 요구사항이 아니다.
- 실행은 멈추지 않고 끝까지 돌아야 한다.
- transcript, tool trace, tester response, errors, judge, analyzer 결과를 모두 artifact로 저장한다.
- Codex가 사후에 요약/분석/개선안을 작성한다.

즉 목표는 실시간 watch가 아니라 **사후 재생 가능한 run artifact**다.

### 2.4 “Codex가 전체 사이클을 맡는다”는 것은 운영자 역할이다

여기서 Codex는 두 역할로 나뉜다.

- `target provider`로서의 Codex
  - Narre의 provider로서 응답을 생성한다.
- `operator`로서의 Codex
  - 어떤 시나리오를 돌릴지, 왜 실패했는지, 다음에 뭘 고쳐야 하는지 결정한다.

이 둘은 반드시 분리해야 한다.

## 3. 현재 기준선

현재 `narre-eval`에는 이미 다음이 있다.

- scenario loader
- seed/setup
- single adapter 기반 실행
- transcript 수집
- deterministic verify
- judge
- baseline comparison
- run artifact 저장

현재 부족한 것은 다음이다.

- Scenario Schema v2
- `agent / provider / tester` 분리
- Codex-operated CLI 모드
- richer tool-use analyzer
- failure classification
- improvement loop output
- target provider로서의 Codex 적용 표면
- operator Codex orchestration

## 4. 목표 아키텍처

목표 구조는 다음 네 층으로 나눈다.

### 4.1 Eval Core

책임:

- 시나리오 로딩
- seed/setup
- 실행 orchestration
- transcript/event/tool trace 수집
- deterministic verify
- judge/analyzer 호출
- artifact 저장
- baseline 비교

특징:

- 재현 가능해야 한다.
- 명시적 run spec으로 동작해야 한다.
- headless batch execution이 기본이다.

### 4.2 Target Agent Runtime

책임:

- 특정 provider 설정으로 `narre-server` 실행
- tester와의 인터랙션 수행
- transcript/events/tool calls를 Eval Core에 전달

이 층의 대상은 현재는 `narre-basic` 하나다.  
다만 나중 multi-agent를 위해 `agent profile` 개념을 먼저 도입한다.

### 4.3 Tester Runtime

책임:

- Narre의 질문, 카드, approval, interview 요청에 응답
- 대화형 인터랙션을 자동 처리
- 응답 전략과 판정을 artifact로 남김

tester는 단순 grading rule이 아니라 **interactive counterpart**다.

### 4.4 Codex Operator Loop

책임:

- 시나리오 탐색/선택
- 시나리오 초안 생성
- run spec 생성
- 실행 명령 생성
- 결과 분석
- 개선안 도출
- harness 개선 작업 큐 생성

중요한 점은 operator loop가 run을 직접 임기응변으로 실행하면 안 된다는 것이다.  
항상 **명시적 run spec**을 만들고, Eval Core가 그 spec을 실행해야 한다.

## 5. 역할 분리

### 5.1 Agent

평가 대상 프로필이다.

초기값:

- `narre-basic`

향후:

- `narre-planner`
- `narre-reviewer`
- `narre-multi-agent`

### 5.2 Provider

모델 실행 계층이다.

예:

- `claude`
- `openai`
- `codex`

### 5.3 Tester

시나리오를 어떻게 굴리고 어떤 인터랙션을 처리하는지 정의한다.

예:

- `basic-turn-runner`
- `conversation-tester`
- `card-responder`
- `approval-sensitive`

### 5.4 Analyzer

실행이 끝난 뒤 transcript/tool trace를 읽고 failure classification, tool-use quality, improvement hints를 만든다.

### 5.5 Operator

Codex를 사용해 scenario/run/analyze/improve 사이클을 운영하는 상위 계층이다.

## 6. CLI 재설계 계획

CLI는 두 층으로 분리한다.

### 6.1 Core Commands

이 계층은 결정적 실행 엔진이다.

- `narre-eval run`
  - 단일 run spec 실행
- `narre-eval batch`
  - scenario 집합 실행
- `narre-eval inspect`
  - run/scenario/artifact 조회
- `narre-eval compare`
  - baseline 비교
- `narre-eval analyze`
  - 기존 run artifact를 다시 분석

이 명령들은 모두 명시적 인자 또는 spec file을 기반으로 실행한다.

### 6.2 Codex Operator Commands

이 계층은 Codex가 전체 사이클을 운영하는 entrypoint다.

- `narre-eval codex`
  - Codex operator 세션 시작
- `narre-eval codex plan`
  - 현 상태를 보고 실행/분석 계획 생성
- `narre-eval codex scenario`
  - 새 scenario 초안 생성 또는 기존 scenario 개선
- `narre-eval codex loop`
  - analyze -> propose -> run -> analyze 반복

핵심은 이 command들도 결국 내부적으로는 `run spec`, `scenario patch`, `analysis artifact`를 생성하고, Core Commands를 호출해야 한다는 점이다.

## 7. Run Spec 도입

재현 가능성을 위해 모든 실행은 최종적으로 `run spec`으로 물질화한다.

예시:

```yaml
run_id: auto
scenario_id: narre-schema-choice-001
agent_id: narre-basic
provider: codex
tester: conversation-tester
execution_mode: single_agent
judge: true
baseline: latest
provider_settings:
  codex:
    model: gpt-5.4
    sandboxMode: workspace-write
    approvalPolicy: on-request
    enableShellTool: false
    enableMultiAgent: false
tester_settings:
  card_response_mode: auto
  approval_policy: conservative
analysis_targets:
  - tool_use
  - schema_choice
  - prompt_compliance
```

중요한 원칙:

- Codex와 대화형으로 시작해도, 실제 실행 전에 항상 spec으로 떨어진다.
- artifact에는 이 spec이 함께 저장된다.
- 재실행은 spec만 있으면 가능해야 한다.

## 8. Scenario Schema v2 계획

현재 manifest 스키마는 `supported_agents`와 `required_capabilities` 수준이다.  
다음 필드를 추가하는 방향으로 v2를 정의한다.

### 8.1 Execution Block

- `agent_id`
- `provider`
- `tester`
- `execution_mode`
- `required_capabilities`
- `analysis_targets`

### 8.2 Provenance Block

- `created_by`
- `source_run`
- `source_issue`
- `generation_mode`
  - `manual`
  - `codex-generated`
  - `codex-refined`

### 8.3 Lifecycle Block

- `draft`
- `active`
- `deprecated`
- `baseline_candidate`

### 8.4 Future Multi-Agent Path

지금은 단일 `agent_id`로 시작한다.  
하지만 아래로 확장 가능해야 한다.

- `agents[]`
- `roles[]`
- role-specific tester policy

즉 v2는 지금은 단일 agent지만, 나중 multi-agent로 갈 migration path를 막지 않아야 한다.

## 9. Tester 확장 계획

현재 `responder.ts`는 카드 응답 훅 정도의 얇은 구조다.  
이를 `tester runtime`으로 승격해야 한다.

### 9.1 목표 책임

- turn 전개 제어
- card 응답
- permission/approval 응답
- interview 응답
- follow-up user turn 생성
- interaction trace 저장

### 9.2 초기 tester 타입

- `basic-turn-runner`
  - 고정 turn sequence
- `conversation-tester`
  - session-resume와 follow-up 처리
- `card-responder`
  - 카드 기반 응답 자동 처리
- `approval-sensitive`
  - destructive confirmation을 엄격하게 검증

### 9.3 Artifact 저장

tester는 다음을 artifact로 남겨야 한다.

- 어떤 이벤트에 응답했는가
- 어떤 기준으로 응답했는가
- 어떤 응답 payload를 보냈는가
- 응답을 자동으로 했는가, 규칙으로 했는가, 사람이 했는가

## 10. Target Provider로서의 Codex 적용 계획

이 항목은 “Narre를 Codex provider로 실행해서 평가한다”는 의미다.

### 10.1 현재 기반

`narre-server`에는 이미 `codex` provider가 있다.

- provider 선택: `NARRE_PROVIDER=codex`
- 모델: `NARRE_CODEX_MODEL`
- runtime settings: `NARRE_CODEX_SETTINGS_JSON`
- 내부적으로 Codex `app-server`를 띄우고 websocket으로 통신한다.

현재 `narre-eval`은 이걸 직접 다루지 않고, `narre-server`를 기본 설정으로 실행한다.

### 10.2 목표

`narre-eval`이 target provider를 명시적으로 선택할 수 있어야 한다.

예:

- `provider=claude`
- `provider=codex`
- `provider=openai`

### 10.3 구현 계획

1. `Scenario Schema v2`와 `run spec`에 `provider`와 `provider_settings`를 추가
2. `NarreServerAdapter.setup(...)`에 provider/env override 주입
3. `narre-server` 실행 시 다음 env를 동적으로 넣을 수 있게 함
   - `NARRE_PROVIDER`
   - `NARRE_CODEX_MODEL`
   - `NARRE_CODEX_SETTINGS_JSON`
4. 결과 artifact에 provider identity와 settings hash를 기록
5. baseline/compare도 provider-aware로 확장

### 10.4 주의점

target provider로서의 Codex와 operator Codex는 구분해야 한다.

- target provider Codex
  - Narre의 응답을 생성하는 모델
- operator Codex
  - eval을 운영하는 조정자

같은 모델일 수는 있지만, **같은 역할이 아니다.**

## 11. Operator로서의 Codex 적용 계획

이 항목은 “Codex가 eval의 전체 운영 루프를 맡는다”는 의미다.

### 11.1 목표 역할

Codex는 다음을 할 수 있어야 한다.

- 현재 scenario inventory를 읽는다
- 실패한 run을 읽는다
- 어떤 시나리오를 다시 돌릴지 선택한다
- 새 scenario 초안을 만든다
- 어떤 agent/provider/tester로 돌릴지 계획한다
- 결과를 읽고 failure classification을 만든다
- harness 개선점을 도출한다

### 11.2 operator mode 원칙

- 자유 대화로 끝나면 안 된다.
- 항상 구조화된 action으로 떨어져야 한다.
- Core Commands를 직접 대체하지 않는다.
- Core Commands 위에서 orchestration만 한다.

즉 operator Codex는 `planner + improver`이며, executor는 Eval Core다.

### 11.3 operator artifact

operator가 남겨야 할 산출물은 다음과 같다.

- `plan.json`
  - 어떤 시나리오를 왜 선택했는지
- `run-spec.yaml`
  - 어떤 실행을 할지
- `analysis.json`
  - 실패 원인 분류
- `improvement-plan.md`
  - 다음 액션
- 필요 시 `scenario-draft/`
  - 새 manifest/turns/verify/rubric 초안

### 11.4 operator mode 구현 방식

초기 단계에서는 별도 TUI가 아니라 CLI command 기반으로 시작한다.

- `narre-eval codex plan`
- `narre-eval codex loop`

이 command는 내부적으로 Codex에 context bundle을 주고, 구조화된 응답을 받는다.

그 다음:

1. run spec 생성
2. `narre-eval run` 호출
3. artifact 수집
4. 다시 Codex에 분석 요청
5. improvement plan 생성

## 12. Codex 재사용 전략

중복 구현을 피하려면, `narre-server`가 이미 가지고 있는 Codex launch 경계를 일부 공용화하는 것이 바람직하다.

현재 `narre-server`의 Codex provider는:

- `codex` 실행 인자 조립
- sandbox/approval/model 설정 반영
- `app-server` 실행
- websocket 연결

을 자체적으로 구현하고 있다.

### 12.1 권장 방향

다음 경계를 공용화 대상으로 본다.

- Codex invocation args builder
- Codex app-server launcher
- Codex session/thread persistence 유틸리티

이 공용화가 필요한 이유:

- target provider Codex
- operator Codex

가 모두 같은 Codex runtime 설정 체계를 써야 하기 때문이다.

### 12.2 권장 모듈화

후보:

- `packages/narre-server/src/providers/openai-family/codex-transport.ts`
  - 현재 구현 원형
- 추출 대상
  - `packages/shared`는 부적절
  - `packages/narre-server` 내부 공용 모듈 또는 신규 `packages/narre-codex-runtime` 검토

초기 단계에서는 `narre-server` 내부 공용 모듈로 먼저 추출하고, 필요 시 별도 패키지로 승격하는 것이 현실적이다.

## 13. Tool-Use Analyzer 계획

현재 tool-use 평가는 count 기반에 가깝다.  
다음 analyzer 계층을 추가한다.

### 13.1 평가 항목

- `discovery_overuse`
- `targeted_lookup_missed`
- `prompt_digest_ignored`
- `wrong_tool_family`
- `redundant_lookup`
- `project_binding_violation`
- `unsafe_mutation_timing`

### 13.2 입력

- transcript
- tool calls
- tool inputs
- tool outputs
- scenario analysis targets
- scenario verify/judge 결과

### 13.3 출력

- analyzer findings
- severity
- evidence
- suggested fix

이 결과는 `analysis.json`과 최종 report에 반영한다.

## 14. Artifact 계약 재설계

run 단위 artifact는 최소 다음을 가져야 한다.

- run metadata
- run spec
- scenario metadata
- target agent/provider/tester identity
- transcript
- tool trace
- tester interaction trace
- verify results
- judge results
- analyzer findings
- improvement hints

이 계약이 있어야 Codex가 사후에 artifact를 읽고 다시 루프를 돌릴 수 있다.

### 14.1 Harness Logging 전략

기본 원칙은 실시간 watch가 아니라 **artifact-first logging**이다.

기본적으로 run마다 다음 로그 산출물을 남긴다.

- `run.json`
  - run metadata, run spec, identity 정보
- `events.ndjson`
  - 실행 중 발생한 모든 이벤트를 시간순으로 기록
- `transcript.json`
  - user / assistant / tester 관점의 정리된 대화 흐름
- `tool-trace.json`
  - tool start/end, input, output, error, duration
- `analysis.json`
  - verify, judge, analyzer findings
- `summary.md`
  - 사람이 빠르게 읽는 요약

`events.ndjson`의 최소 이벤트 타입은 다음을 포함한다.

- `run_started`
- `scenario_started`
- `turn_started`
- `assistant_text_delta`
- `tool_start`
- `tool_end`
- `card_emitted`
- `tester_response`
- `error`
- `scenario_finished`
- `run_finished`

모든 이벤트는 최소 다음 공통 필드를 가진다.

- `timestamp`
- `run_id`
- `scenario_id`
- `session_id`
- `turn_index`
- `agent_id`
- `provider`
- `tester`

핵심은 transcript와 raw event를 분리하는 것이다.

- transcript는 읽기/요약용
- raw event와 tool trace는 analyzer 입력용

### 14.2 Harness Testing 전략

`narre-eval` v2에는 전용 테스트 계층이 필요하다.  
최소 테스트 구조는 다음 순서로 도입한다.

- unit test
  - scenario schema parser
  - run spec parser
  - analyzer rule
  - report writer
- contract test
  - adapter의 SSE parsing
  - tool/card/error 이벤트 처리
  - tester response submit 경로
- integration test
  - fake `narre-server` 또는 stub runtime을 사용한 end-to-end 흐름
  - artifact 생성 확인
- migration test
  - v1 scenario -> v2 loader compatibility
  - previous 결과 비교 호환
- live smoke test
  - 실제 `narre-server`를 띄워 짧은 시나리오 1~2개 실행
  - 기본 CI가 아니라 선택 실행

초기 우선순위는 다음과 같다.

1. parser/report/analyzer unit test
2. SSE adapter contract test
3. fake runtime integration test
4. migration compatibility test
5. live smoke test

## 15. 단계별 구현 계획

### Phase 0. 기반 정리

목표:

- 현재 `narre-eval` core를 깨지 않으면서 확장 지점 확보

작업:

- 기존 CLI command surface 정리
- current artifact format inventory 정리
- current adapter/tester/verify 경계 명확화

산출물:

- current state inventory
- migration notes

검증 기준:

- 현재 artifact 구조를 표로 정리한 문서가 있어야 한다.
- 현재 CLI 인자와 실행 경로가 inventory로 남아 있어야 한다.
- 현재 adapter/tester/verify 경계가 코드 참조와 함께 문서화되어 있어야 한다.
- 수동 smoke:
  - 기존 `narre-eval`이 현재 시나리오를 최소 1개 이상 계속 실행할 수 있어야 한다.

### Phase 1. Scenario Schema v2 + Run Spec

목표:

- 실행 identity를 명시화

작업:

- manifest schema v2 추가
- `agent_id`, `provider`, `tester`, `execution_mode`, `analysis_targets` 추가
- `run spec` 파일 포맷 도입
- loader/CLI에 v1 -> v2 호환 경로 추가

산출물:

- schema v2 loader
- run spec parser
- migration guide

검증 기준:

- unit test:
  - v2 manifest parse 성공
  - invalid manifest validation 실패
  - run spec parse 성공/실패 케이스
- migration test:
  - previous `scenario.yaml` 로딩 유지
  - v1 `manifest.yaml`이 호환 경로로 로드됨
- acceptance:
  - 동일한 run spec으로 두 번 실행했을 때 같은 scenario/agent/provider/tester identity가 artifact에 기록되어야 한다.

### Phase 2. CLI 재구성

목표:

- Core Commands와 Codex Operator Commands 분리

작업:

- `run`, `batch`, `inspect`, `compare`, `analyze` 도입
- 기존 `cli.ts`를 subcommand 구조로 재편
- command별 input/output contract 정리

산출물:

- command router
- command별 handler
- CLI help/docs

검증 기준:

- unit test:
  - command parse
  - option validation
- integration test:
  - `run`, `inspect`, `compare`, `analyze` command가 각기 올바른 handler로 연결됨
- acceptance:
  - 대화형 operator command가 생성한 action이 최종적으로 명시적 run spec 또는 analysis artifact로 물질화되어야 한다.

### Phase 3. Tester Runtime 승격

목표:

- 카드/approval/interview 대응을 first-class tester로 승격

작업:

- tester interface 정의
- 기존 `responder` 훅을 tester runtime으로 이전
- tester trace artifact 추가

산출물:

- tester abstraction
- 기본 tester 구현체
- tester artifact writer

검증 기준:

- contract test:
  - card emit -> tester response -> `/chat/respond` 제출 경로 검증
  - approval/interview 응답 경로 검증
- integration test:
  - tester가 follow-up turn을 생성할 수 있는지 검증
  - tester response가 artifact에 남는지 검증
- acceptance:
  - 기본 scenario 하나에서 tester interaction trace가 `events.ndjson`과 `transcript.json`에 모두 반영되어야 한다.

### Phase 4. Codex Provider 적용

목표:

- Narre target provider로 Codex 실행 가능

작업:

- run spec/provider settings -> `narre-server` env override 연결
- `NarreServerAdapter` provider-aware화
- artifact에 provider settings hash 기록

산출물:

- provider-aware adapter
- codex provider run path
- provider-aware compare/report

검증 기준:

- unit test:
  - provider settings -> env mapping
  - settings hash 생성
- integration test:
  - `provider=claude`, `provider=codex`가 서로 다른 env로 `narre-server`를 실행하는지 검증
- live smoke:
  - 짧은 scenario 하나를 `provider=codex`로 실행
- acceptance:
  - 결과 artifact에 `provider`, `provider_settings_hash`, target/ operator 구분 정보가 남아야 한다.

### Phase 5. Tool-Use Analyzer

목표:

- richer tool evaluation 추가

작업:

- analyzer input schema 정의
- 주요 판정 항목 구현
- report/comparison 연동

산출물:

- analyzer module
- analyzer artifact
- report integration

검증 기준:

- unit test:
  - `discovery_overuse`
  - `targeted_lookup_missed`
  - `prompt_digest_ignored`
  - `project_binding_violation`
  - `unsafe_mutation_timing`
  판정 로직 검증
- fixture test:
  - canned transcript/tool-trace 입력으로 expected finding이 나오는지 검증
- acceptance:
  - analyzer 결과가 `analysis.json`과 최종 summary에 동시에 반영되어야 한다.

### Phase 6. Codex Operator Mode

목표:

- Codex가 전체 사이클을 맡도록 operator mode 도입

작업:

- Codex context bundle 포맷 정의
- `narre-eval codex plan`
- `narre-eval codex loop`
- plan/run/analyze/improve artifact 생성

산출물:

- operator command surface
- operator artifact contract
- Codex orchestration path

검증 기준:

- integration test:
  - `codex plan`이 `plan.json` 생성
  - `codex loop`가 `run-spec.yaml`을 만들고 core command를 호출
- acceptance:
  - operator가 생성한 plan/run/analyze 결과가 각각 artifact로 남아야 한다.
  - operator의 자유 대화 결과가 직접 실행되지 않고 반드시 structured action을 거쳐야 한다.

### Phase 7. Harness Self-Improvement

목표:

- Codex가 harness 자체의 부족함도 제안할 수 있게 함

작업:

- failure classification 강화
- missing-trace / missing-metric / missing-verify 제안 구조 추가
- harness improvement queue 포맷 추가

산출물:

- harness diagnostics
- improvement queue artifact

검증 기준:

- fixture test:
  - missing trace
  - missing metric
  - missing verify
  상황에서 diagnostics가 생성되는지 검증
- acceptance:
  - 실패한 run 하나를 입력했을 때 `improvement queue`에 scenario 문제와 harness 문제를 구분한 항목이 생성되어야 한다.

## 16. 파일 단위 예상 변경 범위

초기 핵심 변경 후보:

- `packages/narre-eval/src/cli.ts`
- `packages/narre-eval/src/types.ts`
- `packages/narre-eval/src/loader.ts`
- `packages/narre-eval/src/runner/session-runner.ts`
- `packages/narre-eval/src/agents/base.ts`
- `packages/narre-eval/src/agents/narre-server.ts`
- `packages/narre-eval/src/grader.ts`
- `packages/narre-eval/src/report.ts`
- 신규
  - `packages/narre-eval/src/run-spec.ts`
  - `packages/narre-eval/src/testers/*`
  - `packages/narre-eval/src/analyzers/*`
  - `packages/narre-eval/src/operator/*`

Codex 공용화 관련 후보:

- `packages/narre-server/src/providers/openai-family/codex-transport.ts`
- 신규 공용 모듈
  - `packages/narre-server/src/codex-runtime/*`
  - 또는 별도 패키지

## 17. 주요 리스크

### 17.1 target Codex와 operator Codex 혼동

가장 큰 리스크다.  
둘을 같은 개념으로 취급하면 artifact와 비교가 오염된다.

대응:

- run spec에 `target provider`
- operator metadata에 `operator provider`

를 별도로 기록한다.

### 17.2 Codex 자유 대화가 실행 계약을 깨는 문제

operator mode가 자유 대화로만 끝나면 재현성을 잃는다.

대응:

- 항상 structured action으로 떨어뜨린다.
- Core Commands를 통해서만 실제 실행한다.

### 17.3 tester logic이 너무 복잡해지는 문제

tester가 rule engine과 mini-agent 사이에서 비대해질 수 있다.

대응:

- 초기에는 제한된 tester 타입만 허용
- tester response trace를 모두 기록

### 17.4 tool-use analyzer의 과도한 추론

분석기가 임의 해석을 많이 하면 신뢰도가 낮아진다.

대응:

- evidence-first findings
- transcript/tool input 기반 판정 우선
- LLM judge와 rule-based analyzer를 분리

## 18. 최종 요약

이번 리팩터링의 핵심은 세 줄로 요약된다.

1. `narre-eval`은 재현 가능한 eval core로 남긴다.
2. Codex는 operator로서 전체 eval cycle을 맡게 한다.
3. target provider로서의 Codex와 operator로서의 Codex를 명확히 분리한다.

즉 우리가 만들려는 것은 단순한 시나리오 러너가 아니라,

- headless로 안정적으로 실행되고
- tester가 인터랙션을 자동 처리하며
- Codex가 시나리오 생성, 실행, 분석, 개선 루프를 운영하는

**`narre-eval v2` 운영 시스템**이다.
