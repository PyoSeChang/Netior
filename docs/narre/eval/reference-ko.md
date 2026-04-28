# narre-eval 상세 문서

작성일: 2026-04-18  
상태: Draft  
대상: `packages/narre-eval`

## 1. 문서 목적

이 문서는 `narre-eval` 패키지가 현재 무엇인지, 어떤 책임을 가지는지, 내부 구조가 어떻게 나뉘는지, 어떤 산출물을 남기는지, 앞으로 무엇을 더 바꿔야 하는지를 **패키지 관점**에서 정리한다.

기존 가이드 문서가 실행 방법 중심이었다면, 이 문서는 다음을 더 자세히 다룬다.

- `narre-eval`의 위치와 책임
- 실행 흐름과 내부 모듈 구조
- scenario / tester / judge / analyzer 모델
- artifact 구조
- 현재 한계와 다음 설계 방향

관련 문서:

- [guide-ko.md](guide-ko.md)
- [codex-owned-loop-ko.md](codex-owned-loop-ko.md)
- [v2-refactor-plan-ko.md](v2-refactor-plan-ko.md)

## 2. narre-eval의 위치

`narre-eval`은 Narre를 평가하기 위한 **headless eval engine**이다.

중요한 원칙은 다음과 같다.

- `narre-eval`은 `narre-server`의 thin client다.
- system prompt 조립 책임은 `narre-server`에 있다.
- `narre-eval`은 prompt를 직접 만들지 않는다.
- `narre-eval`은 실행 spec, scenario, tester response, artifact를 다룬다.

즉 이 패키지는 “Narre 자체”가 아니라, **Narre를 정해진 조건으로 돌리고 평가하는 프로그램**이다.

## 3. 핵심 역할

`narre-eval`은 현재 다음 역할을 가진다.

1. scenario를 로드한다.
2. seed를 통해 임시 프로젝트와 DB 상태를 만든다.
3. `netior-service`와 `narre-server`를 띄운다.
4. target provider로 Narre를 실행한다.
5. tester가 Narre의 카드/질문/승인 요청에 응답하게 한다.
6. transcript, tool call, tester interaction을 수집한다.
7. deterministic verify를 수행한다.
8. tool-use analyzer를 수행한다.
9. judge를 수행한다.
10. 사람이 읽는 report와 기계가 읽는 result artifact를 남긴다.

## 4. 현재 실행 모델

현재 실행 모델은 아래 네 축으로 이해하면 된다.

### 4.1 Target Agent

평가 대상은 지금 기준으로 `narre-basic`이다.

- 실제 실행은 `narre-server`
- provider는 `claude`, `openai`, `codex`
- 지금 기본 provider는 `codex`

### 4.2 Tester

tester는 단순한 grading rule이 아니라 **interactive counterpart**다.

다만 중요한 점이 있다.

- tester의 외부 페르소나는 여전히 “도메인은 알지만 Netior 내부는 모르는 사용자”다.
- tester가 `network`, `model`, `schema_ref`, `node placement`를 먼저 말해서는 안 된다.
- tester는 내부적으로만 bootstrap contract나 평가 기준을 안다.

즉 tester는 “똑똑한 Netior 유저”가 아니라, **일반 사용자 페르소나를 유지한 evaluator**다.

현재 지원 tester id:

- `codex-tester`
- `basic-turn-runner`
- `conversation-tester`
- `card-responder`
- `approval-sensitive`

실제로는 `codex-tester`가 중심이고, 나머지는 레거시 또는 호환용에 가깝다.

### 4.3 Judge

judge는 transcript와 실행 요약을 읽고 최종 평가를 내린다.

현재 방향은 다음과 같다.

- judge는 프로그램이 만든 점수표만 읽어서는 안 된다.
- judge는 scenario 목표, transcript, tool 흐름, tester 관찰을 읽어야 한다.
- 산출물은 사람이 읽는 markdown report여야 한다.

즉 judge는 “숫자 생성기”가 아니라 **LLM evaluator / reporter**다.

### 4.4 Analyzer

analyzer는 tool-use와 bootstrap contract 위반을 잡는다.

현재 주요 finding:

- `prompt_digest_redundant_lookup`
- `broad_discovery_overuse`
- `redundant_repeated_lookup`
- `project_binding_violation`
- `tool_budget_overrun`
- `bootstrap_missing_interview`
- `bootstrap_missing_proposal`

즉 analyzer는 “맞았는가”만이 아니라 **어떻게 틀렸는가**를 잡는 역할이다.

## 5. 패키지 구조

주요 소스 파일은 아래와 같다.

### 5.1 실행 진입점

- [src/cli.ts](../../../packages/narre-eval/src/cli.ts)

책임:

- CLI 인자 파싱
- scenario set 결정
- adapter 생성
- run loop orchestration
- result / summary 출력

### 5.2 시나리오 로딩

- [src/loader.ts](../../../packages/narre-eval/src/loader.ts)
- [src/types.ts](../../../packages/narre-eval/src/types.ts)
- [src/execution.ts](../../../packages/narre-eval/src/execution.ts)
- [src/run-spec.ts](../../../packages/narre-eval/src/run-spec.ts)

책임:

- manifest/turns/verify/rubric 로딩
- `ScenarioExecutionConfig` 정규화
- `target_skill` 검증
- run spec override 적용

### 5.3 환경 셋업

- [src/harness.ts](../../../packages/narre-eval/src/harness.ts)
- [src/netior-service-process.ts](../../../packages/narre-eval/src/netior-service-process.ts)
- [src/netior-service-client.ts](../../../packages/narre-eval/src/netior-service-client.ts)

책임:

- temp dir 준비
- sqlite/서비스 초기화
- seed 실행
- teardown

### 5.4 target agent adapter

- [src/agents/base.ts](../../../packages/narre-eval/src/agents/base.ts)
- [src/agents/narre-server.ts](../../../packages/narre-eval/src/agents/narre-server.ts)

책임:

- `narre-server` 프로세스 실행
- provider env 설정
- SSE 이벤트 수집
- transcript 이벤트로 변환

### 5.5 실행기

- [src/runner/session-runner.ts](../../../packages/narre-eval/src/runner/session-runner.ts)

책임:

- turn 순서 실행
- tester와 카드 상호작용 연결
- transcript / tool / tester trace 수집

### 5.6 tester runtime

- [src/tester-runtime.ts](../../../packages/narre-eval/src/tester-runtime.ts)
- [src/codex-exec.ts](../../../packages/narre-eval/src/codex-exec.ts)

책임:

- Codex tester prompt 구성
- 카드 응답 생성
- tester interaction trace 수집

### 5.7 grading / analysis

- [src/grader.ts](../../../packages/narre-eval/src/grader.ts)
- [src/analyzer.ts](../../../packages/narre-eval/src/analyzer.ts)

책임:

- deterministic verify
- LLM judge
- tool-use analyzer
- metric 계산

### 5.8 산출물 및 비교

- [src/report.ts](../../../packages/narre-eval/src/report.ts)
- [src/comparator.ts](../../../packages/narre-eval/src/comparator.ts)

책임:

- `result.json`, `report.md`, `transcript.md` 작성
- `runs/latest`, `runs/history` 관리
- baseline diff 계산

## 6. 시나리오 모델

현재 시나리오는 두 층으로 이해하면 된다.

### 6.1 Product Scenario

실제 사용자 use case를 평가하는 시나리오다.

예:

- `fantasy-world-bootstrap`
- `type-update`
- `cascade-delete`

이 시나리오는 다음을 본다.

- 사용자 작업 목표를 Narre가 제대로 이해하는가
- 적절한 schema/network/graph 결정을 하는가
- 사용자에게 내부 구조를 떠넘기지 않는가

### 6.2 Contract Fixture

하네스나 analyzer 규칙이 맞는지 검증하는 보조 fixture다.

예:

- repeated lookup 검증
- project binding 위반 검증
- bootstrap interview 누락 검증

현재는 이 구분이 문서적으로는 맞지만, 코드 구조상 아직 완전히 분리된 상태는 아니다.

## 7. bootstrap skill 평가 관점

현재 `fantasy-world-bootstrap`은 `/bootstrap` skill 평가 시나리오다.

이 시나리오가 보려는 핵심은 다음이다.

- 사용자는 Netior 구조를 모른다.
- 사용자는 자기 도메인만 설명한다.
- Narre는 그 도메인 설명으로부터 ontology를 먼저 읽어야 한다.
- 그 ontology를 network / schema / model / ORM / starter graph로 투영해야 한다.
- 인터뷰 없이 바로 대량 생성으로 뛰면 안 된다.

즉 `/bootstrap`은 “생성 명령”이 아니라 **도메인 인터뷰 + 구조 추론 + 제안 + 실행** workflow여야 한다.

## 8. artifact 구조

현재 중요한 artifact는 아래와 같다.

### 8.1 run 단위

- `runs/latest/run.json`
- `runs/history/<run-id>/run.json`

의미:

- 어떤 run이었는지
- 어떤 scenario / agent / provider / tester 조합이었는지

### 8.2 scenario 단위

- `result.json`
  - 최종 점수/판정/verify/analyzer/judge 요약
- `transcript.json`
  - 구조화된 원본 transcript
- `transcript.md`
  - 사람이 읽기 위한 pretty transcript
- `report.md`
  - 사람이 읽는 통합 평가 보고서
- `analysis.json`
  - analyzer 결과
- `tester-trace.json`
  - tester interaction 로그

### 8.3 scenario 로컬 latest/history

- `scenarios/<id>/results/latest/...`
- `scenarios/<id>/results/history/...`

의미:

- 특정 시나리오 관점에서 최신/과거 결과를 빠르게 확인

## 9. 현재 한계

현재 `narre-eval`은 많이 나아졌지만, 아직 아래 한계가 있다.

### 9.1 bootstrap은 아직 stage machine이 아니다

현재 `/bootstrap`은 prompt와 tester contract는 강해졌지만, runtime 차원의 강제 stage machine은 아니다.

즉 아직 부족한 것:

- interview stage
- proposal stage
- approval stage
- execution stage

별 allowed tools 제어

### 9.2 scenario가 아직 완전한 multi-turn bootstrap을 강제하지 못한다

특히 `fantasy-world-bootstrap`은 여전히 완전한 “단계형 conversation bootstrap”이라고 보기 어렵다.

### 9.3 verify가 의미 기반보다 이름 기반일 때가 있다

특히 fantasy 시나리오에서는 한국어/영어 schema 이름 차이 때문에 verify가 불안정할 수 있다.

### 9.4 report 품질은 더 좋아져야 한다

현재 `report.md`와 `transcript.md`는 쓸 만하지만, 아직 다음이 더 필요하다.

- stage별 구분
- created/changed item 요약 강화
- tester 의도와 판정 근거 표시 강화

## 10. 다음 단계

패키지 관점에서 다음 우선순위는 이렇다.

1. `/bootstrap`을 실제 stage machine으로 승격
2. bootstrap scenario를 true multi-turn 형태로 개편
3. tester / judge / analyzer / verify를 같은 bootstrap contract로 더 강하게 정렬
4. transcript/report를 stage-aware하게 개편
5. TUI를 통해 run 선택, tester 선택, transcript 보기, operator Codex와의 대화를 지원

## 11. 한 줄 요약

`narre-eval`은 지금 단순 러너가 아니라, **Narre를 시나리오 기반으로 실행하고 tester/judge/analyzer를 결합해 평가하는 headless eval engine**이다.  
다만 `/bootstrap` 같은 고차 워크플로우를 제대로 평가하려면, 다음 단계는 prompt 개선이 아니라 **stageful runtime + stronger interaction contract + TUI operator surface**다.
