# Narre Eval 시나리오 인덱스

## 목적

이 문서는 현재 `packages/narre-eval/scenarios`에 있는 manifest 기반 시나리오를 인덱싱하고,  
`Netior 제품 전체 기능 리스트`의 기능 ID 기준으로 무엇이 테스트되고 있고 무엇이 비어 있는지 정리한 문서다.

## 현재 활성 시나리오 수

현재 manifest가 있는 활성 시나리오는 총 `4개`다.

- `custom-model-authoring-foreshadowing`
- `fantasy-world-bootstrap`
- `research-builtin-model-reuse`
- `think-data-structure-pdf-index`

구형 단일 파일 시나리오는 현재 활성 manifest 목록에 포함하지 않는다.

## 시나리오 카탈로그

| Scenario ID | 타입 | Target Skill | 주 목적 | 성격 |
|---|---|---|---|---|
| `custom-model-authoring-foreshadowing` | `single-turn` | `bootstrap` | built-in으로 충분하지 않은 도메인 의미를 custom model로 만들고 schema에 적용 | product scenario / custom model + meaning binding |
| `fantasy-world-bootstrap` | `single-turn` | `bootstrap` | 판타지 도메인 브리프만으로 bootstrap skill 평가 | product scenario / bootstrap skill |
| `research-builtin-model-reuse` | `single-turn` | `bootstrap` | 연구 도메인에서 built-in model 재사용과 중복 custom model 방지 평가 | product scenario / built-in model reuse |
| `think-data-structure-pdf-index` | `single-turn` | `index` | PDF 목차를 읽고 file metadata `pdf_toc`에 저장 | product scenario / index skill |

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
| F08 | 타입 시스템 | `fantasy-world-bootstrap`, `research-builtin-model-reuse`, `custom-model-authoring-foreshadowing` | 강함 | schema/field뿐 아니라 model, model recipe, meaning binding을 직접 본다 |
| F09 | relation type 및 edge 의미 | `fantasy-world-bootstrap` | 부분 | relation type 생성은 일부 보지만 edge 의미/편집 시나리오는 약하다 |
| F10 | 컨텍스트 | 없음 | 없음 | context 생성/멤버 관리 시나리오가 없다 |
| F11 | 파일 엔터티 및 PDF 메타데이터 | `think-data-structure-pdf-index` | 강함 | PDF TOC 추출과 file metadata 저장을 직접 검증한다 |
| F12 | 에디터 워크벤치 | 없음 | 없음 | 탭/split/detached/workbench는 eval 범위 밖 |
| F13 | 파일 편집기 | 없음 | 없음 | Markdown/PDF/Image editor 시나리오가 없다 |
| F14 | 터미널 및 에이전트 런타임 | 없음 | 없음 | 터미널/agent runtime 시나리오가 없다 |
| F15 | 설정 및 단축키 | 없음 | 없음 | 설정/shortcut 시나리오가 없다 |
| F16 | Narre 기본 채팅 | 모든 시나리오 | 부분 | Narre 응답은 모두 거치지만, 일반 conversational quality를 전용으로 보는 시나리오는 없다 |
| F17 | Narre `/bootstrap` | `fantasy-world-bootstrap`, `research-builtin-model-reuse`, `custom-model-authoring-foreshadowing` | 강함 | ontology bootstrap, built-in model reuse, custom model authoring을 분리해서 본다 |
| F18 | Narre `/index` | `think-data-structure-pdf-index` | 강함 | index skill로 실제 PDF TOC를 읽고 저장하는 흐름을 검증한다 |

## 시나리오별 상세 메모

### 1. `fantasy-world-bootstrap`

- 강점
  - ontology / network / models / ORM / starter graph를 한 번에 보려는 시도다
- 한계
  - fantasy domain에 넓게 걸쳐 있어 model/meaning/binding 전용 회귀로는 신호가 흐릴 수 있다

### 2. `research-builtin-model-reuse`

- 강점
  - 시간, 반복, 워크플로, 출처, 첨부, 버전처럼 built-in model이 이미 담당하는 의미를 재사용하는지 본다
  - 중복 custom model 생성을 금지하고, structured recurrence field binding까지 검증한다
- 한계
  - 실제 concept property 값 입력과 recurrence occurrence materialization은 보지 않는다

### 3. `custom-model-authoring-foreshadowing`

- 강점
  - built-in model로 충분하지 않은 도메인 의미를 custom model로 만드는지 본다
  - model recipe, 복수 허용 field type, schema_ref, custom field meaning binding을 함께 검증한다
- 한계
  - schema meaning slot binding은 built-in meaning 중심 도구라 custom meaning의 slot binding은 아직 제한적으로만 본다

### 4. `think-data-structure-pdf-index`

- 강점
  - `/index` target skill, PDF page read, approval-before-save, `pdf_toc` metadata 저장을 직접 검증한다
- 한계
  - file/network placement와 broader artifact organization은 보지 않는다

## 현재 공백

다음 기능은 시나리오가 전혀 없거나 사실상 비어 있다.

- module / module directory / filesystem registration
- layout
- context
- edge editing semantics
- concept property value editing
- terminal / agent runtime
- settings / shortcuts

즉 현재 시나리오 세트는 **schema/model/bootstrap/index 중심**이며, 그래프 편집과 concept property 실제 값 흐름은 아직 약하다.

## 우선 보강 대상

우선순위가 높은 신규 시나리오는 다음과 같다.

1. `bootstrap` 멀티턴 시나리오
- 도메인 브리프
- artifact/workflow/관계 인터뷰
- ontology 요약
- 네트워크/스키마 proposal
- 승인 후 생성

2. file/module registration 시나리오
- module 선택
- moduleDir 추가/변경
- file tree 반영

3. concept property value 시나리오
- schema field type별 값 입력
- meaning binding 기반 property 입력
- recurrence 값과 virtual occurrence 연결

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
- `/bootstrap`은 ontology bootstrap, built-in model reuse, custom model authoring으로 분리되기 시작했다.
- `/index`는 PDF TOC 저장 흐름을 직접 보는 시나리오가 생겼다.

즉 현재 시나리오 인덱스는 “제품 전체 회귀 세트”라기보다는 아직 **schema/model-heavy Narre regression set**에 가깝다.
