# Narre Eval Tester 분류 리팩터링 계획

## 목적

현재 `narre-eval`은 기본 tester가 지나치게 `codex-tester` 중심으로 잡혀 있다.  
이 구조는 단순하고 결정적인 기능 검증에도 불필요하게 해석형 tester를 끌어오게 만든다.

앞으로는 시나리오를 아래 두 가지로만 나눈다.

- `고정형`
- `해석형`

이 문서는 이 두 분류를 기준으로 tester 기본 정책, 시나리오 메타데이터, 실행기, TUI, 문서, 기존 시나리오를 어떻게 정리할지 정의한다.

## 분류 정의

### 1. 고정형

의미:

- 사용자의 의도가 이미 충분히 명확하다
- 정답 공간이 좁다
- tester가 깊게 해석하지 않아도 된다

예:

- 프로필 이미지 삽입
- schema 이름 변경
- relation type 색 변경
- 단순 field 추가
- 단순 삭제 확인

기본 tester:

- `basic-turn-runner`

예외:

- destructive confirmation이 핵심이면 `approval-sensitive`

### 2. 해석형

의미:

- Narre가 먼저 의미를 읽고 해석해야 한다
- 필요하면 인터뷰하고 구조를 제안해야 한다
- ambiguity resolution이 중요하다

예:

- `/bootstrap`
- 도메인 구조 설계
- ontology 추론
- 관계 인터뷰
- artifact/workflow 인터뷰

기본 tester:

- `codex-tester`

## 현재 문제

### 1. 기본값이 과하게 해석형이다

현재 기본값:

- `single-turn` 기본 tester = `codex-tester`
- `conversation` 기본 tester = `codex-tester`

이 구조는 단순 시나리오에서도 Codex tester를 사실상 기본 가정으로 깔게 만든다.

### 2. 시나리오 intent와 tester가 분리되어 있다

지금 manifest에는:

- `type`
- `provider`
- `tester`
- `target_skill`

은 있지만, 시나리오가 `고정형`인지 `해석형`인지 드러나는 명시적 분류가 없다.

### 3. TUI도 같은 분류를 직접 보여주지 않는다

지금 TUI에서는 tester를 선택할 수는 있지만,

- 이 시나리오가 왜 `basic-turn-runner`가 기본인지
- 왜 `codex-tester`가 필요한지

가 명확히 드러나지 않는다.

### 4. 기존 시나리오도 이 기준으로 정리되어 있지 않다

예:

- `type-update`는 고정형에 가깝다
- `fantasy-world-bootstrap`은 해석형이다

하지만 현재 구조에서는 둘 다 비슷한 층에서 다뤄진다.

## 목표 상태

### 핵심 규칙

1. 모든 시나리오는 `고정형` 또는 `해석형` 중 하나를 가진다.
2. tester 기본값은 시나리오 분류에서 자동 결정된다.
3. manifest에서 명시한 tester가 있으면 그 값을 우선한다.
4. TUI와 보고서도 이 분류를 직접 보여준다.
5. judge와 analyzer도 이 분류를 이해하고 평가 기준을 다르게 쓴다.

## 리팩터링 방향

## Phase 1. 시나리오 분류 모델 도입

### 목표

시나리오에 `고정형/해석형`을 first-class metadata로 도입한다.

### 제안 스키마

`packages/narre-eval/src/types.ts`

새 타입:

```ts
export type EvalScenarioKind = 'fixed' | 'interpretive';
```

`ScenarioExecutionManifest` 또는 `ScenarioManifest`에 추가:

```ts
scenario_kind?: EvalScenarioKind;
```

정규화 결과에도 추가:

```ts
scenario_kind: EvalScenarioKind;
```

### 기본값

- `target_skill === 'bootstrap'` 이면 기본 `interpretive`
- 그 외는 기본 `fixed`

단, 이후 필요하면 manifest에서 명시적으로 override 가능하게 둔다.

### 검증 기준

- `types.ts` 타입 체크 통과
- loader가 `scenario_kind`를 안정적으로 읽고 정규화
- previous scenario도 깨지지 않음

## Phase 2. tester 기본 정책 교체

### 목표

tester 기본값을 `scenario_kind` 기준으로 바꾼다.

### 새 기본 정책

- `fixed` -> `basic-turn-runner`
- `interpretive` -> `codex-tester`

추가 규칙:

- 명시적 destructive confirmation 시나리오는 manifest에서 `approval-sensitive`로 override

### 수정 지점

- `packages/narre-eval/src/execution.ts`

현재:

- `DEFAULT_SINGLE_TURN_TESTER`
- `DEFAULT_CONVERSATION_TESTER`

변경:

- scenario type이 아니라 `scenario_kind` 기준으로 기본 tester 선택

### 검증 기준

- `fixed` 시나리오에서 tester 지정 없으면 `basic-turn-runner`
- `interpretive` 시나리오에서 tester 지정 없으면 `codex-tester`
- 기존 manifest에 `tester`가 있으면 override 유지

## Phase 3. tester runtime 정책 분기

### 목표

`fixed`와 `interpretive`에서 tester의 기대 역할을 분리한다.

### fixed tester 기대

- 가능한 한 deterministic
- 불필요한 해석 금지
- 카드가 없으면 사실상 no-op
- 단순 승인/응답만 수행

### interpretive tester 기대

- 도메인만 아는 사용자 페르소나 유지
- Netior 내부는 모름
- bootstrap 계약, 인터뷰 품질, proposal 품질을 내부적으로 평가

### 수정 지점

- `packages/narre-eval/src/tester-runtime.ts`

변경 방향:

- prompt에 `scenario_kind` 명시
- `fixed`면 응답을 더 짧고 결정적으로
- `interpretive`면 기존 Codex tester evaluator 역할 유지

### 검증 기준

- fixed 시나리오에서 Codex tester를 일부러 안 써도 흐름이 자연스럽다
- interpretive 시나리오에서 bootstrap 인터뷰 기준이 유지된다

## Phase 4. judge/analyzer 기준 분기

### 목표

judge와 analyzer가 시나리오 종류를 알고 평가 기준을 다르게 적용하게 한다.

### fixed 평가 기준

- 결과 정확성
- 부작용 없음
- tool 과용 없음
- confirmation boundary 준수

### interpretive 평가 기준

- 인터뷰 품질
- ontology 추론 품질
- proposal 적절성
- network/schema/starter graph 투영 품질

### 수정 지점

- `packages/narre-eval/src/grader.ts`
- `packages/narre-eval/src/analyzer.ts`

### 검증 기준

- fixed 시나리오에서 “왜 인터뷰 안 했냐” 같은 감점이 안 붙음
- interpretive 시나리오에서는 bootstrap_missing_interview류가 계속 유효

## Phase 5. TUI 반영

### 목표

TUI에서 `고정형/해석형`을 직접 보여주고, tester 선택 UI도 그에 맞게 보조한다.

### 변경

- scenario summary에 `scenario_kind` 표시
- tester 선택 시 권장값 표시
  - fixed -> `basic-turn-runner`
  - interpretive -> `codex-tester`
- operator 보고서/요약에도 이 분류 표시

### 수정 지점

- `packages/narre-eval/src/tui.ts`

### 검증 기준

- 시나리오 선택 화면에서 종류가 바로 보임
- 사용자가 tester를 바꿀 때 기본 추천을 확인 가능

## Phase 6. 기존 시나리오 재분류

### 목표

현재 활성 시나리오를 `fixed/interpretive`로 재분류한다.

### 제안

#### fixed

- `init-project`
- `type-update`
- `cascade-delete`
- `fantasy-character-orm`
- `fantasy-quest-orm`

설명:

- 현재 형태 기준으로는 정답 공간이 상대적으로 좁고, deterministic verify 비중이 높다.

#### interpretive

- `fantasy-world-bootstrap`

설명:

- target skill이 `/bootstrap`
- ontology 인터뷰, proposal, 구조 추론이 핵심

### 검증 기준

- manifest에 `scenario_kind` 반영
- 기본 tester 자동 선택이 기대대로 바뀜

## Phase 7. 문서/용어 통일

### 목표

기존 문서와 코드 설명에서 `micro deterministic`, `conversation/domain`, `single-turn/conversation` 같은 혼재된 framing을 줄이고, tester 전략 문맥에서는 `고정형/해석형`만 사용한다.

### 수정 대상

- `narre-eval-reference-ko.md`
- `narre-eval-guide-ko.md`
- TUI guide
- 관련 strategy 문서

### 검증 기준

- tester 전략을 설명할 때 항상 `고정형/해석형` 두 축만 쓰도록 정리

## 최종 상태 예시

### 고정형

```yaml
id: type-update
type: single-turn
execution:
  scenario_kind: fixed
```

실행 시 기본:

- tester = `basic-turn-runner`

### 해석형

```yaml
id: fantasy-world-bootstrap
type: single-turn
execution:
  target_skill: bootstrap
  scenario_kind: interpretive
```

실행 시 기본:

- tester = `codex-tester`

## 구현 순서

1. `types.ts`에 `scenario_kind` 추가
2. `execution.ts` 기본 tester 정책 교체
3. `tester-runtime.ts` 분기
4. `grader.ts` / `analyzer.ts` 분기
5. `tui.ts` 표시/선택 보조 반영
6. 기존 scenario manifest 재분류
7. 문서 정리

## 예상 효과

- 단순 시나리오에서 불필요한 Codex tester 호출 감소
- bootstrap류 시나리오에서는 여전히 rich tester 유지
- 시나리오 intent와 tester 선택 이유가 더 직관적으로 드러남
- eval 결과 해석이 쉬워짐

## 한 줄 요약

앞으로 tester 전략은 `single-turn vs conversation`이 아니라  
**`고정형 vs 해석형`** 기준으로 간다.
