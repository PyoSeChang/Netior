# Narre Eval Codex-Owned Loop Requirements

작성일: 2026-04-17  
상태: Draft  
인코딩: UTF-8

## 1. 문서 목적

이 문서는 `narre-eval`을 단순 시나리오 실행기가 아니라, **Codex가 시나리오 생성부터 실행, 평가, 분석, 개선안 도출까지 전체 사이클을 맡을 수 있는 평가 운영 시스템**으로 확장하기 위해 필요한 조건을 정리한다.

핵심 질문은 다음과 같다.

- Codex가 eval의 전체 사이클을 맡으려면 어떤 구조가 필요하나
- 현재 `narre-eval`에서 무엇이 이미 있고 무엇이 부족한가
- 어떤 책임은 `narre-eval`에 있어야 하고, 어떤 책임은 `narre-server`에 있어야 하나
- 앞으로 `provider`, `tester`, `agent profile`, `tool-use analyzer`, `multi-agent`를 어떻게 수용해야 하나

## 2. 전제

### 2.1 `narre-eval`은 thin client여야 한다

`narre-eval`은 `narre-server`의 테스트 클라이언트다.  
따라서 다음 책임은 `narre-eval`이 가지면 안 된다.

- 시스템 프롬프트 조립
- 프로젝트 스키마 digest 조립
- 현재 프로젝트 문맥의 별도 해석

이 책임은 `narre-server`가 가져야 한다.  
`narre-eval`은 `projectId`, `message`, `mentions`, 실행 설정만 전달하고, `narre-server`를 black-box 대상으로 평가해야 한다.

### 2.2 Codex가 맡는 것은 단일 실행이 아니라 운영 루프다

여기서 말하는 “Codex가 전체 사이클을 맡는다”는 뜻은 단순히 eval을 실행하는 것이 아니다.

- 시나리오를 만들고
- 실행 대상을 선택하고
- 결과를 읽고
- 실패 원인을 분류하고
- 다음 시나리오 또는 harness 개선점을 제안하고
- 다시 실행하는

폐쇄 루프를 만들겠다는 뜻이다.

## 3. 목표 상태

Codex가 전체 사이클을 맡는 목표 상태는 다음과 같다.

1. Codex가 시나리오를 생성하거나 기존 시나리오를 수정할 수 있다.
2. Codex가 어떤 agent profile, provider, tester로 실행할지 선택할 수 있다.
3. Codex가 run artifact를 읽고 실패 원인을 분류할 수 있다.
4. Codex가 tool-use 품질까지 평가할 수 있다.
5. Codex가 harness의 부족한 점까지 식별하고 다음 개선 작업 큐를 만들 수 있다.

즉 최종 목표는 `eval runner`가 아니라 **`Codex-operated eval ops loop`**다.

## 4. 필수 구성요소

### 4.1 Scenario Schema v2

현재 시나리오 스키마는 `manifest + turns + seed + verify + rubrics` 중심이다.  
이 구조만으로는 Codex가 실행 전략과 분석 목표를 이해하기 어렵다.

최소한 다음 필드가 추가되어야 한다.

- `agent_id`
  - 현재 기본값은 `narre-basic`
- `provider`
  - 예: `claude`, `codex`, `openai`
- `tester`
  - 예: `basic-turn-runner`, `card-responder`, `approval-sensitive`
- `execution_mode`
  - 현재는 `single_agent`
  - 이후 `multi_agent` 확장 대비
- `required_capabilities`
  - 예: `tool_call_trace`, `card_response`, `session_resume`
- `analysis_targets`
  - 이 시나리오가 무엇을 중점 평가하는지
  - 예: `schema_choice`, `tool_budget`, `prompt_compliance`
- `scenario_author`
  - 누가 만들었는지
- `source_run`
  - 어떤 실패나 관찰에서 파생되었는지

즉 Scenario Schema v2는 단순 test case 정의가 아니라, **Codex가 운영 가능한 평가 단위의 메타데이터**를 포함해야 한다.

### 4.2 Agent / Provider / Tester 분리

현재는 이 세 층이 사실상 분리되어 있지 않다.  
Codex가 전체 사이클을 맡으려면 아래 세 층을 분리해야 한다.

- `agent`
  - 평가 대상 프로필
  - 예: `narre-basic`
- `provider`
  - 실제 모델 실행층
  - 예: `claude`, `codex`, `openai`
- `tester`
  - 시나리오를 어떻게 굴리고 어떤 신호를 수집하는가
  - 예: single-turn, conversation, card-response, approval flow

이 분리가 필요한 이유는 명확하다.

- 실패가 agent profile 문제인지
- provider 문제인지
- tester 구현 문제인지

를 분리해서 볼 수 있어야 하기 때문이다.

### 4.3 Structured Run Artifact

Codex가 결과를 읽고 다음 액션을 만들려면, 결과물이 기계가 읽기 좋은 구조여야 한다.

최소 산출물은 다음을 포함해야 한다.

- scenario identity
- scenario version
- agent identity
- provider identity
- tester identity
- execution mode
- transcript
- tool trace
- verify 결과
- judge 결과
- derived metrics
- failure classification
- improvement hints

핵심은 transcript만 남기는 것으로 충분하지 않다는 점이다.  
Codex는 단순 대화 로그가 아니라 **분석 가능한 artifact bundle**을 필요로 한다.

### 4.4 Tool-Use Evaluation Layer

앞으로의 eval은 정답 여부만 보는 것이 아니라, **어떻게 tool을 사용했는가**를 평가해야 한다.

최소한 다음 항목을 볼 수 있어야 한다.

- broad discovery 남발 여부
- targeted lookup으로 충분했는지
- prompt digest를 무시하고 재조회했는지
- 잘못된 tool family를 선택했는지
- 같은 조회를 반복했는지
- destructive action 전에 확인을 했는지
- current project binding을 무시하고 raw `project_id`를 직접 넣었는지

이 평가는 단순 `tool count`만으로는 부족하다.  
따라서 별도 `tool-use analyzer` 계층이 필요하다.

### 4.5 Improvement Loop Output

Codex가 전체 사이클을 맡으려면, run 결과가 “성공/실패”로 끝나면 안 된다.  
최소한 아래 출력이 자동으로 생성되어야 한다.

- 실패 원인 분류
- scenario 결함인지
- agent/prompt/tool-surface 결함인지
- harness 결함인지
- 다음 액션 후보

즉 eval run의 결과는 리포트가 아니라 **개선 작업 큐의 입력**이어야 한다.

### 4.6 Scenario Lifecycle Model

Codex가 시나리오를 생성하고 관리하려면 lifecycle이 필요하다.

최소 상태는 다음 정도가 적절하다.

- `draft`
- `active`
- `deprecated`
- `baseline_candidate`

추가로 provenance도 필요하다.

- 누가 만들었는가
- 어떤 이슈에서 나왔는가
- 어떤 run 결과에서 파생되었는가

즉 시나리오는 파일 묶음이 아니라 **운영 대상 자산**이 되어야 한다.

### 4.7 Harness Introspection

Codex가 harness 자체를 개선하려면, harness도 평가 대상으로 보여야 한다.

예를 들어 Codex는 다음을 알 수 있어야 한다.

- 어떤 trace가 부족했는가
- 어떤 metric이 빠져 있는가
- 어떤 verify 타입이 새로 필요했는가
- 어떤 scenario schema 필드가 부족했는가

이게 없으면 Codex는 agent만 고치고 harness는 개선하지 못한다.

## 5. 최소 운영 루프

Codex-owned loop의 최소 흐름은 다음과 같다.

1. 시나리오 선택 또는 생성
2. seed/setup
3. target agent 실행
4. transcript/tool trace 수집
5. deterministic verify
6. qualitative judge
7. tool-use analyzer
8. 실패 원인 분류
9. 개선안 도출
10. 다음 시나리오 또는 harness 작업 큐 생성

즉 `runner -> grader`로 끝나는 것이 아니라, **`runner -> grader -> analyzer -> improver`**까지가 한 사이클이다.

## 6. Scenario Schema v2 초안

예시는 다음과 같은 방향이 적절하다.

```yaml
id: narre-schema-choice-001
title: choose field over edge for typed ownership
description: evaluate whether Narre models ownership as a typed schema relation instead of a graph edge
scenario_version: 2.0.0
schema_version: 2
lifecycle: active
labels:
  - schema
  - tool-use
  - ownership

execution:
  agent_id: narre-basic
  provider: claude
  tester: basic-turn-runner
  execution_mode: single_agent
  required_capabilities:
    - tool_call_trace
    - session_resume
  analysis_targets:
    - schema_choice
    - targeted_lookup
    - prompt_compliance

turn_plan:
  file: turns.yaml

entrypoints:
  seed: seed.ts

assets:
  verify:
    - verify/checks.yaml
  rubrics:
    - rubrics/quality.yaml

provenance:
  created_by:
    id: codex
    name: Codex
    source: eval-loop
  source_run: run_20260417_001
```

이 스키마에서 중요한 점은 다음 두 가지다.

- `agent_id`는 지금은 단일 값이지만, 나중에 `agents[]`로 확장될 수 있어야 한다.
- `analysis_targets`는 Codex가 이 시나리오의 의도를 빠르게 읽게 해준다.

## 7. Multi-Agent 대비

현재는 `narre-basic` 하나로 시작하면 된다.  
하지만 schema와 runtime은 처음부터 multi-agent 확장을 막지 않도록 설계해야 한다.

지금 단계에서 필요한 최소 대비는 다음이다.

- `agent_id`를 명시 필드로 둔다.
- `execution_mode`를 둔다.
- 결과 artifact에 `agent_id`, `provider`, `tester`를 명확히 남긴다.

나중에는 아래로 자연스럽게 확장될 수 있어야 한다.

- `agents[]`
- `planner`
- `operator`
- `reviewer`

즉 지금은 단일 agent지만, 구조적으로는 **multi-agent migration path**를 열어둬야 한다.

## 8. Tool-Use Analyzer 요구사항

Tool-use analyzer는 별도 계층으로 두는 것이 맞다.  
최소한 아래 판정이 가능해야 한다.

- `discovery_overuse`
  - broad discovery tool 남용
- `targeted_lookup_missed`
  - 더 좁은 조회로 충분했는데 못함
- `prompt_digest_ignored`
  - 이미 주어진 정보 재조회
- `wrong_tool_family`
  - schema 문제에 graph tool을 쓰는 등 잘못된 계열 선택
- `redundant_lookup`
  - 동일 조회 반복
- `project_binding_violation`
  - current project binding 대신 raw `project_id` 직접 사용
- `unsafe_mutation_timing`
  - destructive action 전에 확인 누락

즉 도구 평가는 “몇 번 썼나”가 아니라 **“올바른 방식으로 썼나”**가 중심이어야 한다.

## 9. 현재 harness 기준으로 이미 있는 것

현재 `narre-eval`에는 이미 다음이 있다.

- scenario loader
- seed/setup
- adapter 실행
- transcript 수집
- deterministic verify
- judge rubric
- baseline comparison

즉 기본 runner로서의 골격은 이미 있다.

## 10. 현재 harness 기준으로 부족한 것

현재 `narre-eval`에 부족한 것은 주로 다음이다.

- scenario schema v2
- agent/provider/tester 분리
- tool-use analyzer
- improvement loop output
- lifecycle/provenance 강화
- harness introspection
- multi-agent 대비 실행 모델

따라서 다음 리팩터링은 “기능 몇 개 추가”가 아니라, **평가 운영 구조로의 재설계**에 가깝다.

## 11. 리팩터링 우선순위

### Phase 1. Scenario Schema v2

- `agent_id`
- `provider`
- `tester`
- `execution_mode`
- `analysis_targets`
- provenance 확장

### Phase 2. Runtime Model 분리

- agent abstraction 강화
- provider 분리
- tester first-class화
- 결과 artifact identity 강화

### Phase 3. Tool-Use Evaluation

- tool trace analyzer 추가
- tool policy 위반 판정 추가
- prompt compliance 항목 추가

### Phase 4. Improvement Loop

- failure classification
- next action generation
- scenario/harness improvement queue 산출

## 12. 결론

Codex가 전체 eval cycle을 맡기 위해 필요한 것은 단순한 자동 실행기가 아니다.  
필요한 것은 다음 네 가지다.

- 표준화된 시나리오 스키마
- 분리된 실행 모델 (`agent / provider / tester`)
- 구조화된 run artifact
- 분석에서 개선안까지 이어지는 운영 루프

현재 `narre-eval`은 이 중에서 **실행과 기본 검증**은 갖고 있다.  
앞으로 필요한 것은 그 위에 **schema v2, tool-use analyzer, tester model, improvement loop**를 얹어 `Codex-operated eval ops system`으로 만드는 일이다.
