# Narre Eval 시나리오 인덱스

## 목적

이 문서는 현재 `packages/narre-eval/scenarios`에 있는 manifest 기반 시나리오를 인덱싱하고,  
`Netior 제품 전체 기능 리스트`의 기능 ID 기준으로 무엇이 테스트되고 있고 무엇이 비어 있는지 정리한 문서다.

## 현재 활성 시나리오 수

현재 manifest가 있는 활성 시나리오는 총 `6개`다.

- `init-project`
- `type-update`
- `cascade-delete`
- `fantasy-character-orm`
- `fantasy-quest-orm`
- `fantasy-world-bootstrap`

추가로 `toc-index/` 디렉터리는 있으나 현재 manifest가 없어 활성 시나리오로 계산하지 않는다.

## 시나리오 카탈로그

| Scenario ID | 타입 | Target Skill | 주 목적 | 성격 |
|---|---|---|---|---|
| `init-project` | `single-turn` | 없음 | 빈 프로젝트에 역사 도메인 타입 초기 세팅 | 기본 회귀 / schema init |
| `type-update` | `single-turn` | 없음 | 기존 schema 이름 변경 | 기본 회귀 / schema update |
| `cascade-delete` | `conversation` | 없음 | 종속 concept가 있는 schema 삭제와 확인 흐름 | 기본 회귀 / destructive confirmation |
| `fantasy-character-orm` | `single-turn` | 없음 | `Character`, `City` 중심 typed `schema_ref` 설계 | product scenario / ORM |
| `fantasy-quest-orm` | `single-turn` | 없음 | `Quest` schema과 workflow형 field 설계 | product scenario / ORM + workflow field |
| `fantasy-world-bootstrap` | `single-turn` | `bootstrap` | 판타지 도메인 브리프만으로 bootstrap skill 평가 | product scenario / bootstrap skill |

## 기능별 시나리오 커버리지

판정 기준:

- `강함`: 해당 기능의 핵심 행위가 시나리오에서 직접 검증됨
- `부분`: 일부 핵심만 검증되며 깊이나 현실성이 부족함
- `없음`: 현재 활성 시나리오가 없음

| ID | 기능 영역 | 현재 시나리오 | 커버리지 | 메모 |
|---|---|---|---|---|
| F01 | 프로젝트 라이프사이클 | 없음 | 없음 | 시드에서 project를 만들 뿐, 사용자 행위로 프로젝트 생성/삭제를 검증하지 않음 |
| F02 | 모듈 및 파일 시스템 등록 | 없음 | 없음 | module/moduleDir/file tree를 직접 검증하는 시나리오가 없다 |
| F03 | 사이드바 및 탐색 패널 | 없음 | 없음 | UI 탐색 계층을 평가하는 시나리오가 없다 |
| F04 | 네트워크 워크스페이스 | `fantasy-world-bootstrap` | 부분 | 네트워크 분기/생성은 보지만 멀티턴 제안·승인 흐름은 아직 약함 |
| F05 | 그래프 편집 | `fantasy-world-bootstrap` | 부분 | starter node와 graph 초기화는 일부 보지만 edge 중심 시나리오는 없다 |
| F06 | 레이아웃 저장 | 없음 | 없음 | layout 관련 시나리오가 전혀 없다 |
| F07 | 개념 및 속성 | `fantasy-world-bootstrap` | 부분 | starter concept 생성은 보지만 concept property 값 조작 시나리오는 없다 |
| F08 | 타입 시스템 | `init-project`, `type-update`, `cascade-delete`, `fantasy-character-orm`, `fantasy-quest-orm`, `fantasy-world-bootstrap` | 강함 | 현재 eval의 중심축은 schema/field/schema다 |
| F09 | relation type 및 edge 의미 | `init-project`, `fantasy-world-bootstrap` | 부분 | relation type 생성은 일부 보지만 edge 의미/편집 시나리오는 약하다 |
| F10 | 컨텍스트 | 없음 | 없음 | context 생성/멤버 관리 시나리오가 없다 |
| F11 | 파일 엔터티 및 PDF 메타데이터 | 없음 | 없음 | `toc-index`가 비어 있어 file/PDF/index skill 시나리오가 사실상 없다 |
| F12 | 에디터 워크벤치 | 없음 | 없음 | 탭/split/detached/workbench는 eval 범위 밖 |
| F13 | 파일 편집기 | 없음 | 없음 | Markdown/PDF/Image editor 시나리오가 없다 |
| F14 | 터미널 및 에이전트 런타임 | 없음 | 없음 | 터미널/agent runtime 시나리오가 없다 |
| F15 | 설정 및 단축키 | 없음 | 없음 | 설정/shortcut 시나리오가 없다 |
| F16 | Narre 기본 채팅 | 모든 시나리오 | 부분 | Narre 응답은 모두 거치지만, 일반 conversational quality를 전용으로 보는 시나리오는 없다 |
| F17 | Narre `/bootstrap` | `fantasy-world-bootstrap` | 부분 | target skill까지 걸려 있으나 현재 single-turn 중심이고 staged bootstrap realism이 부족하다 |
| F18 | Narre `/index` | 없음 | 없음 | `toc-index`가 활성화되지 않아 index skill을 실제로 검증하지 못한다 |

## 시나리오별 상세 메모

### 1. `init-project`

- 강점
  - 빈 프로젝트 초기 schema 세팅 회귀에 유용
- 한계
  - bootstrap처럼 도메인에서 구조를 추론하는 능력은 거의 보지 않는다
  - 네트워크, models, starter graph를 실질적으로 보지 않는다

### 2. `type-update`

- 강점
  - 기존 스키마 변경 회귀에 유용
- 한계
  - 이름 변경 중심이라 field migration, model refactor, graph side-effect는 깊게 못 본다

### 3. `cascade-delete`

- 강점
  - confirmation turn을 가진 유일한 conversation 시나리오
  - destructive action 전 확인과 side-effect 검증이 들어 있다
- 한계
  - bootstrap류 멀티턴 설계 대화와는 성격이 다르다

### 4. `fantasy-character-orm`

- 강점
  - typed `schema_ref` 설계 검증이 명확하다
  - ORM-style field를 Narre가 제대로 쓰는지 보기 좋다
- 한계
  - 네트워크/models/starter graph는 거의 안 본다

### 5. `fantasy-quest-orm`

- 강점
  - workflow형 schema 설계와 cross-schema reference를 함께 본다
- 한계
  - model보다 일반 field 설계에 치우치기 쉽다

### 6. `fantasy-world-bootstrap`

- 강점
  - 현재 세트 중 유일하게 `/bootstrap` target skill을 명시한다
  - ontology / network / models / ORM / starter graph를 한 번에 보려는 시도다
- 한계
  - 아직 `single-turn`
  - 진짜 staged bootstrap(인터뷰 -> proposal -> 승인 -> 생성) 강제가 약하다
  - 현재 시나리오 realism이 충분하지 않아 지속적인 개편 대상이다

## 현재 공백

다음 기능은 시나리오가 전혀 없거나 사실상 비어 있다.

- module / module directory / filesystem registration
- file entity / PDF metadata / `/index`
- layout
- context
- edge editing semantics
- concept property value editing
- terminal / agent runtime
- settings / shortcuts

즉 현재 시나리오 세트는 **스키마 중심**이며, 제품 전체 기능 대비 편향이 매우 크다.

## 우선 보강 대상

우선순위가 높은 신규 시나리오는 다음과 같다.

1. `bootstrap` 멀티턴 시나리오
- 도메인 브리프
- artifact/workflow/관계 인터뷰
- ontology 요약
- 네트워크/스키마 proposal
- 승인 후 생성

2. `index` skill 시나리오
- PDF 읽기
- TOC 추출
- file metadata 저장

3. file/module registration 시나리오
- module 선택
- moduleDir 추가/변경
- file tree 반영

4. context 시나리오
- context 생성
- object/edge 멤버 추가
- context 편집

5. layout 시나리오
- 레이아웃 position
- edge visual override
- network content와 layout 상태 분리 검증

## 결론

현재 Narre eval은 `타입 시스템`과 `ORM형 field 설계`는 어느 정도 테스트하지만,

- Netior 전체 제품 기능 관점에서는 커버리지가 매우 불균형하다.
- `/bootstrap`은 이미 시나리오가 하나 있지만 아직 충분히 멀티턴/ontology-first하지 않다.
- `/index`는 사실상 아직 테스트 세트에 없다.

즉 현재 시나리오 인덱스는 “제품 전체 회귀 세트”라기보다 **schema-heavy Narre regression set**에 가깝다.
