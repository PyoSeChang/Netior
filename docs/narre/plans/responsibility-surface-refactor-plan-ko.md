# Narre Responsibility Surface 리팩터링 계획

## 목적

이 계획의 기준 문서는 다음 세 개다.

- [Netior Narre 책임 표면 인벤토리](../architecture/responsibility-surface-ko.md)
- [Narre MCP Coverage By Responsibility Surface](../architecture/mcp-coverage-by-surface-ko.md)
- [Narre Eval 시나리오 인덱스 By Responsibility Surface](../eval/scenario-index-by-surface-ko.md)

즉 앞으로의 리팩터링 기준은 “제품 전체 기능”이 아니라 `NR01~NR25`다.

핵심 질문은 세 가지다.

1. Narre가 이 책임 표면을 실제로 이해하고 주도할 수 있는가
2. MCP가 이 책임 표면을 실행 가능한 도구로 충분히 열어주는가
3. Eval이 이 책임 표면을 신뢰할 수 있게 검증하는가

## 현재 진단

### 1. Narre는 너무 schema-centric 하다

현재 강한 축:

- `NR02` network CRUD 일부
- `NR05` concept 생성
- `NR09~NR19` schema/graph core 일부

현재 약한 축:

- `NR01` 모듈 루트와 디렉터리 등록
- `NR03` concept 기반 subnetwork
- `NR06~NR08` object placement / file node / node-level interaction
- `NR14` occurrence 관리
- `NR20` context
- `NR21~NR22` file entity / PDF metadata
- `NR24~NR25` staged skill contract

즉 지금 Narre는 “도메인을 workspace로 투영하는 운영자”라기보다 “schema 편집기”에 더 가깝다. 이번 도메인 모델 확장 이후에는 schema만 만드는 것이 아니라 project-level model, model meanings, field meaning bindings, meaning slot binding까지 함께 설계해야 한다.

### 2. MCP는 graph/schema core는 강하지만 responsibility surface 전체를 못 덮는다

강한 축:

- `NR02`, `NR05`, `NR09~NR19` 일부

큰 공백:

- `NR20` context = 없음
- `NR21` file entity와 node metadata = 부분
- `NR22` PDF TOC = skill orchestration 의존
- `NR01` module/moduleDir registration = 부분
- `NR03`, `NR06~NR08`, `NR14` = raw primitive는 있으나 high-level flow 부족

즉 MCP는 아직 “Netior 전체 책임 표면”이 아니라 “schema + graph core” 중심이다.

### 3. Eval은 schema-heavy regression set에 치우쳐 있다

현재 강한 시나리오 축:

- schema CRUD
- field definition
- model CRUD / schema meaning / field meaning bindings
- typed `schema_ref`
- 일부 destructive confirmation

현재 거의 비어 있는 축:

- `NR01`
- `NR03~NR08`
- `NR09~NR11`
- `NR13~NR14`
- `NR18`의 model/meaning/binding 세부 검증
- `NR20~NR22`
- `NR25`

즉 지금 eval은 Narre의 진짜 책임 표면을 거의 절반 이상 비워 둔 상태다.

### 4. `/bootstrap`은 아직 prompt이지 contract가 아니다

지금 `/bootstrap`의 가장 큰 문제는 다음이다.

- ontology-first wording은 넣었지만 runtime 강제가 없다
- multi-turn contract가 없다
- interview -> proposal -> approval -> execution 순서를 tool surface가 보장하지 않는다
- eval도 아직 staged bootstrap을 강하게 검증하지 못한다

즉 `/bootstrap`은 “좋은 지침”은 있어도 “행동 계약”은 아직 없다.

## 목표 상태

### 1. Narre의 기준축을 `NR01~NR25`로 고정한다

앞으로 Narre 관련 기능 추가, MCP 추가, 시나리오 추가, TUI 운영은 전부 책임 표면 ID에 매핑돼야 한다.

새 작업은 최소한 다음 질문에 답해야 한다.

- 이 변경은 어떤 `NR`을 강화하는가
- MCP / skill / scenario 중 어디를 건드리는가
- coverage 공백을 실제로 줄이는가

### 2. Narre를 ontology-first staged operator로 재정의한다

특히 `/bootstrap`은 다음 순서를 기본 계약으로 가져야 한다.

1. domain brief
2. ontology interview
3. ontology summary
4. workspace projection proposal
5. approval
6. execution
7. final summary

즉 네트워크는 출발점이 아니라 ontology의 projection이어야 한다.

### 3. Eval은 responsibility-surface coverage matrix가 되어야 한다

각 시나리오는 단순히 `single-turn` / `conversation`이 아니라,

- 어떤 `NR`을 검증하는지
- `고정형`인지 `해석형`인지
- 어떤 skill 계약을 검증하는지

를 명시해야 한다.

## 리팩터링 원칙

### 원칙 1. Prompt만으로 해결하지 않는다

행동 순서가 중요하면 runtime contract로 강제한다.

예:

- interview 전 mutation 금지
- proposal 전 mutation 금지
- approval 전 bulk create 금지

### 원칙 2. MCP는 high-level responsibility surface를 기준으로 확장한다

primitive가 이미 있다고 해서 coverage가 있다고 보지 않는다.

예:

- `create_network_node`가 있다고 `NR06`이 해결된 것은 아니다
- `read_pdf_pages`가 있다고 `NR22`가 해결된 것은 아니다

### 원칙 3. Eval은 시나리오 수보다 surface coverage를 우선한다

시나리오를 많이 만드는 것보다, 비어 있는 `NR`을 채우는 것이 우선이다.

### 원칙 4. Tester는 사용자 페르소나를 유지한다

tester는 Netior 내부 구조를 아는 똑똑한 사용자로 바뀌면 안 된다.

겉으로는:

- 도메인만 안다
- Netior 내부는 모른다

속으로는:

- bootstrap contract를 평가한다
- tool-use 품질을 본다

## 핵심 워크스트림

## Workstream A. `/bootstrap` contract 재설계

### 목표

`NR24`를 prompt가 아니라 stage machine으로 바꾼다.

### 변경

1. `bootstrap` 세션 상태 도입

예:

```ts
type BootstrapStage =
  | 'ontology_interview'
  | 'ontology_summary'
  | 'workspace_proposal'
  | 'approval'
  | 'execution'
  | 'final_summary';
```

2. stage별 허용 도구 분리

- interview stage
  - `ask`
  - read-only lookup
- proposal stage
  - `propose`
  - `confirm`
- execution stage
  - create/update/delete

3. stage 전이 조건 명시

- interview 없이는 summary로 못 감
- proposal 없이는 execution 못 감
- approval 없이는 mutation 못 감

4. ontology intermediate output 강제

최소 산출물:

- entity kinds
- relation kinds
- artifact kinds
- workflow structure

5. starter graph를 execution 계약에 포함

bootstrap은 schema만 만드는 게 아니라 starter concept/node까지 만들어야 한다.

### 주요 파일

- `packages/narre-server/src/prompts/bootstrap.ts`
- `packages/narre-server/src/prompt-skills/bootstrap-skill.ts`
- `packages/narre-server/src/runtime/narre-runtime.ts`
- 필요 시 bootstrap 전용 session state 파일 추가

### 완료 기준

- `/bootstrap`이 ask/propose 없이 바로 bulk mutation으로 못 간다
- report/transcript에 stage가 드러난다
- fantasy bootstrap이 실제 multi-turn 흐름으로 바뀐다

## Workstream B. MCP responsibility-surface gap closure

### 목표

현재 큰 공백인 `NR20`, `NR21`, `NR22`, `NR01`, `NR03`, `NR06~NR08`, `NR14`를 우선 메운다.

### B1. Context surface (`NR20`)

추가 대상:

- `list_contexts`
- `create_context`
- `update_context`
- `delete_context`
- `add_context_object_member`
- `remove_context_object_member`
- `add_context_edge_member`
- `remove_context_edge_member`

### B2. File / PDF surface (`NR21`, `NR22`)

추가 또는 보강 대상:

- file entity 일반 CRUD
- node-level file metadata 편집
- `relevant_pages` / TOC metadata의 structured write
- `/index`가 쓰는 file/PDF 고수준 흐름 재정의

### B3. Object placement / occurrence surface (`NR03`, `NR06~NR08`, `NR14`)

필요한 것:

- existing object placement 고수준 API
- concept 기반 subnetwork create/connect 고수준 API
- node-level metadata/occurrence 편집 surface
- file node add flow

### B4. Model / meaning / binding surface (`NR18`)

필요한 것:

- model CRUD가 schema 편집의 부속 기능이 아니라 project-level modeling operation으로 노출됨
- model recipe가 meanings와 field recipes를 가진다는 계약
- schema meaning 생성/수정/삭제와 meaning slot binding 수정 흐름
- field definition 생성/수정 시 `meaning_bindings`를 여러 개 다룰 수 있는 tool/tester 계약
- 같은 meaning을 여러 field로 표현하거나 하나의 field가 여러 meaning binding을 갖는 경우를 다루는 eval

### B5. Module root surface (`NR01`)

필요한 것:

- module/moduleDir registration CRUD
- Narre가 artifact reachability를 이해할 수 있는 최소 surface

### 완료 기준

- 책임 표면 문서에서 `없음`/`부분`으로 남아 있던 항목이 줄어든다
- 새 MCP surface는 책임 표면 ID와 직접 매핑된다

## Workstream C. Eval / Scenario matrix 재구성

### 목표

시나리오를 “몇 개 있나”가 아니라 “어떤 `NR`을 검증하나” 기준으로 관리한다.

### C1. 시나리오 분류 체계 도입

tester 전략 문맥에서는 두 분류만 쓴다.

- `고정형`
- `해석형`

기본 tester:

- `고정형` -> `basic-turn-runner`
- `해석형` -> `codex-tester`

이 분류는 [tester-refactor-plan-ko.md](../eval/tester-refactor-plan-ko.md)와 연결한다.

### C2. 현재 시나리오 재배치

- `init-project` -> 고정형
- `type-update` -> 고정형
- `cascade-delete` -> 고정형
- `fantasy-character-orm` -> 고정형
- `fantasy-quest-orm` -> 고정형
- `fantasy-world-bootstrap` -> 해석형

### C3. 신규 시나리오 우선순위

1. `bootstrap-multiturn`
   - 목표 표면: `NR02`, `NR03`, `NR05`, `NR16`, `NR18`, `NR24`

2. `index-pdf`
   - 목표 표면: `NR21`, `NR22`, `NR25`

3. `context-authoring`
   - 목표 표면: `NR20`

4. `object-placement`
   - 목표 표면: `NR06`, `NR07`, `NR08`

5. `concept-occurrence`
   - 목표 표면: `NR14`

6. `edge-semantics`
   - 목표 표면: `NR09`, `NR10`, `NR11`

7. `model-meaning-bindings`
   - 목표 표면: `NR16`, `NR17`, `NR18`, `NR19`
   - 검증 초점: 사용자 정의 model 생성, model meanings, field recipes, field `meaning_bindings`, schema_ref와 relation field 판단

### C4. Scenario metadata 강화

각 시나리오는 최소한 다음을 가져야 한다.

- `scenario_kind`
- `target_skill`
- `responsibility_surfaces: NRxx[]`
- `primary_success_criteria`

### 완료 기준

- scenario index 문서에서 “없음” 항목이 실제로 줄기 시작한다
- bootstrap과 index가 전용 시나리오로 검증된다

## Workstream D. Tester / Judge / Analyzer 공진화

### 목표

Narre prompt, tester prompt, judge prompt, verify/analyzer를 하나의 계약으로 맞춘다.

### D1. Tester

공통:

- 도메인만 아는 사용자 페르소나 유지
- Netior 내부 용어를 먼저 말하지 않음

고정형:

- 가능한 deterministic
- 불필요한 해석 최소화

해석형:

- bootstrap 계약을 내부적으로 평가
- 인터뷰 없이 바로 mutation으로 뛰면 제동

### D2. Judge

공통:

- 한국어 `report.md` 작성
- 프로그램 요약 + tester context + transcript를 바탕으로 평가

고정형:

- 정확성
- 부작용
- confirmation boundary

해석형:

- interview 품질
- ontology 추론
- proposal 적절성
- starter graph 품질

### D3. Analyzer

이미 있는 finding에 더해 responsibility-surface 맥락을 점점 반영한다.

예:

- `bootstrap_missing_interview`
- `bootstrap_missing_proposal`
- 향후 `index_missing_file_scope`
- 향후 `context_surface_uncovered`

### 완료 기준

- bootstrap류에서는 인터뷰/제안 부재가 명확히 실패한다
- 고정형 시나리오에서는 불필요한 인터뷰 감점이 붙지 않는다

## Workstream E. TUI / Operator를 coverage 운영 콘솔로 승격

### 목표

지금 TUI를 단순 실행기에서 responsibility-surface 운영 콘솔로 발전시킨다.

### 필요한 반영

- scenario detail에 `responsibility_surfaces` 표시
- `고정형` / `해석형` 표시
- target skill 표시
- latest run이 어떤 `NR`을 통과/실패했는지 요약
- operator가 시나리오 patch를 만들 때 `NR` 공백 기준으로 초안을 만들 수 있게 함

### 완료 기준

- TUI에서 “이 시나리오가 무엇을 검증하는가”가 바로 보인다
- operator가 coverage gap 기준으로 patch/diff 초안을 만들 수 있다

## 단계별 구현 순서

## Phase 0. 기준축 고정

목표:

- `NR01~NR25`를 Narre 리팩터링의 공식 기준으로 고정

작업:

- strategy/reference 문서 링크 정리
- 새 시나리오/새 MCP 작업에 `NR` 매핑 요구

완료 기준:

- 이후 계획 문서가 모두 `NR` 기준으로 작성됨

## Phase 1. `/bootstrap` contract

목표:

- staged bootstrap runtime 구현

작업:

- stage state
- stage별 tool profile
- approval gate
- ontology summary intermediate output

완료 기준:

- bootstrap이 진짜 multi-turn contract가 됨

## Phase 2. 고우선 MCP 공백 메우기

목표:

- `NR20`, `NR21`, `NR22`, `NR01` 우선 해소

작업:

- context 도구
- file/PDF 도구 보강
- module/moduleDir surface 보강

완료 기준:

- 현재 `없음`이던 핵심 항목이 `부분` 또는 `강함`으로 이동

## Phase 3. 시나리오/테스터 재구성

목표:

- scenario_kind
- responsibility_surfaces
- bootstrap/index 전용 시나리오

작업:

- 기존 시나리오 재분류
- 신규 시나리오 추가
- tester 기본 정책 교체

완료 기준:

- 고정형에는 lightweight tester
- 해석형에는 codex-tester

## Phase 4. coverage-driven 운영

목표:

- TUI/operator/report가 responsibility-surface 관점으로 동작

작업:

- TUI 표시 강화
- operator patch prompt에 `NR` 문맥 반영
- coverage 갭 기반 리포트 정리

완료 기준:

- 운영 콘솔에서 공백이 바로 보이고 대응이 쉬워짐

## 지금 바로 우선순위

1. `/bootstrap` stage machine
2. `scenario_kind + tester 기본 정책` 적용
3. `context` MCP surface
4. `index-pdf` 시나리오 활성화
5. `object-placement` / `concept-occurrence` 시나리오 추가

이 순서가 맞는 이유:

- bootstrap contract가 먼저 바로잡혀야 ontology-first 방향이 실제 행동으로 바뀐다
- 그 다음 tester 분류를 적용해야 simple scenario와 interpretive scenario가 분리된다
- 그 다음 MCP/시나리오 공백을 메워야 responsibility surface coverage가 실제로 올라간다

## 한 줄 요약

앞으로의 Narre 리팩터링은  
**`제품 전체` 기준이 아니라 `NR01~NR25 책임 표면` 기준으로 진행하고,**
그 위에서

- `/bootstrap`을 staged ontology-first contract로 바꾸고
- MCP의 공백 표면을 메우고
- Eval을 surface coverage matrix로 재구성하고
- tester는 `고정형 / 해석형` 두 축으로 단순화하는 방향

으로 간다.
