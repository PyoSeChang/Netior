# App Root Canvas 구현 계획

작성일: 2026-04-10
상태: Draft

## 1. 목적

이 문서는 App Root Canvas를 제품의 실제 진입점으로 도입하고, 그 과정에서 드러난 `project context` 결합을 함께 정리하기 위한 구현 계획이다.

핵심 목표는 다음 두 가지다.

- 앱이 더 이상 "프로젝트 목록 화면"과 "프로젝트 내부 작업공간"으로 갈라진 제품이 아니라, App Root와 Project Root를 중심으로 움직이는 하나의 network workspace 제품이 되게 한다.
- 현재 `currentProject`에 몰려 있는 역할을 분리해서, App Root 도입 이후에도 셸, 캐시, detached window, 파일 기능, Narre, 단축키가 예외 처리 없이 동작하게 한다.

## 2. 최종 상태

구현이 끝난 뒤 제품은 다음 상태를 만족해야 한다.

- 앱 실행 직후 App Root Workspace가 열린다.
- App Root Canvas에는 프로젝트가 `project node`로 배치된다.
- 새 프로젝트를 만들면 해당 프로젝트의 Project Root로 즉시 리다이렉트된다.
- `project node`를 열면 해당 프로젝트의 Project Root Network로 진입한다.
- 프로젝트를 닫으면 카드형 홈으로 돌아가는 대신 App Root로 돌아간다.
- 브레드크럼, editor dock, detached window, state restore는 App Root와 Project Workspace 양쪽에서 일관되게 동작한다.
- 파일 트리, 모듈, Narre, 터미널 cwd, PDF 파일 매칭 같은 기능은 project workspace에서만 활성화된다.
- 기존 ProjectHome은 독립 메인 화면이 아니라, 프로젝트가 하나도 없을 때 쓰는 온보딩 또는 빈 상태 레이어로 축소된다.

## 2.1 정책 확정

다음 항목은 구현 전에 확정된 정책으로 본다.

- 앱 시작 시 첫 workspace는 항상 App Root Network다.
- 새 프로젝트 생성 직후에는 App Root에 머무르지 않고 해당 프로젝트의 Project Root로 리다이렉트한다.
- App Root Network 안의 `project node`는 포털이면서 편집 가능한 객체다.
- App Root Network 안에서 `project node`에는 "프로젝트 삭제" 액션을 허용한다.
- 다른 project network 및 그 하위 network 안에 들어간 `project node` 역시 포털이면서 편집 가능한 객체다.
- 다만 App Root 바깥의 network에서 `project node`를 제거할 때는 "프로젝트 삭제"가 아니라 "해당 network에서 제외"로 취급한다.

위 정책은 현재 `network node`가 이미 갖고 있는 이중 성격과도 맞는다. 하나의 객체가 캔버스에서는 포털처럼 동작하면서, inspector나 editor에서는 편집 가능한 network object로 다뤄질 수 있다.

## 2.2 아직 남은 정책 결정

최종 마감을 위해 실질적으로 남은 결정은 workspace 상태 보존 정책 하나다.

권장 v1 정책은 다음과 같다.

- App Root workspace와 각 project workspace는 서로 독립된 상태를 가진다.
- workspace를 이동할 때 현재 workspace의 network 위치, editor 탭, split 상태를 각각 저장한다.
- 프로젝트를 닫으면 마지막 App Root 상태로 복귀한다.
- 프로젝트를 다시 열면 마지막 project workspace 상태를 복원한다.
- detached window는 v1에서 별도 창 상태까지 완전 복원하지 않는다.
- 대신 project workspace를 떠날 때 detached 탭은 main host 기준 상태로 정리하고, 재진입 시 main window에서 복원한다.

이 정책을 쓰면 state cache와 bridge sync를 지나치게 복잡하게 만들지 않고도 App Root / Project Root 왕복 경험을 안정적으로 만들 수 있다.

## 3. 지금 구조의 핵심 문제

현재 구조는 App Root Canvas를 넣기에 앞서 다음 문제가 있다.

- `currentProject`가 너무 많은 역할을 동시에 맡고 있다.
- 앱 셸이 "project 없음 = 홈, project 있음 = workspace"라는 이분법으로 고정되어 있다.
- network 조회와 tree 조회가 전부 `projectId` 전제다.
- 캔버스는 `project` 오브젝트를 일부 렌더링할 준비가 되어 있지만, 선택, 열기, 피커, 브라우저, 컨텍스트 메뉴는 아직 `project`를 1급 객체로 다루지 않는다.
- state cache와 cross-window sync가 project 단위로만 설계되어 있다.
- detached window는 `openProject()`를 못 쓰고 store를 직접 만지는 우회 경로를 이미 갖고 있다.

이 상태에서 홈 화면만 캔버스로 바꾸면, App Root는 별도 특수 화면이 되고 기존 project workspace와 중복된 구조가 생긴다. 따라서 우선순위는 "화면 추가"가 아니라 "workspace model 정리"다.

## 4. 설계 원칙

- App Root는 별도 런처 화면이 아니라 정식 workspace여야 한다.
- Project Root는 project 내부의 정식 root workspace여야 한다.
- `project`는 편집 대상보다 진입 포털에 가까운 객체로 취급한다.
- project 전용 기능은 억지로 app scope로 일반화하지 않는다.
- 공통 셸은 재사용하고, app mode와 project mode의 차이는 capability와 sidebar 구성을 통해 드러나게 한다.
- `currentProject`를 숨은 전역 스위치처럼 쓰지 않는다.

## 5. 범위와 비범위

이번 계획의 범위는 다음과 같다.

- App Root Canvas를 앱의 최상위 진입점으로 도입
- Project Root 진입 동선 완성
- `project context` 리팩터링
- workspace cache / sync / detached window 정리
- app mode와 project mode capability 분리

이번 1차 마감에서 비범위로 두는 것은 다음과 같다.

- App Root에서 project 자체를 편집하는 전용 editor 추가
- app mode에서 파일 트리, Narre, terminal을 완전 일반화
- 여러 프로젝트를 동시에 활성 workspace로 여는 다중 project 세션

## 6. 구조 목표

최종 구조는 `project store` 중심이 아니라 `workspace session` 중심이어야 한다.

권장 구조는 다음과 같다.

- `project catalog`
- 역할: 프로젝트 목록, 생성, 삭제, 이름/경로 수정, 존재 여부 검증

- `workspace session`
- 역할: 현재 workspace가 `app`인지 `project`인지, 현재 active project가 무엇인지, 현재 root network가 무엇인지, App Root와 Project Root 사이를 어떻게 이동하는지 관리

- `workspace state cache`
- 역할: App Root 상태와 각 Project Workspace 상태를 각각 저장하고 복원

- `workspace capabilities`
- 역할: 현재 workspace에서 files, modules, Narre, terminal, file metadata가 가능한지 결정

이렇게 분리되면 `currentProject`는 더 이상 전역 문맥 그 자체가 아니라 "현재 workspace가 project일 때 참조되는 데이터"가 된다.

## 7. 단계별 구현 계획

### Phase 1. `project context` 분해

목표는 `currentProject`에 얹힌 역할을 걷어내는 것이다.

- `project store`에서 프로젝트 목록 관리와 활성 workspace 제어를 분리한다.
- `openProject()`와 `closeProject()`에 들어 있는 파일시스템 검증, cache restore, 최근 project 기록, missing path 처리 책임을 쪼갠다.
- `workspace store` 또는 `workspace session store`를 도입해서 `mode: 'app' | 'project'`를 1급 상태로 만든다.
- `project-state-cache`를 `workspace-state-cache`로 승격한다.
- `editor-state-bridge`가 `currentProject` 대신 `workspace session`을 동기화하게 바꾼다.
- app mode와 project mode 전환 API를 명시적으로 만든다.

완료 조건은 다음과 같다.

- App Root를 열기 위한 상태 전이가 `currentProject = null` 같은 암묵 규칙이 아니라 명시적 API로 표현된다.
- detached window가 `project store`를 직접 세팅하는 임시 우회 없이 같은 session 모델을 쓴다.

### Phase 2. App Root용 data / API 확장

목표는 project id 없이도 app scope network를 열 수 있게 만드는 것이다.

- core layer에 App Root 조회와 진입용 API를 정리한다.
- renderer service와 IPC에서 app scope network 조회 경로를 추가한다.
- network full hydration에서 `project` object를 정식으로 확장한다.
- `project node`가 label, target id, navigation intent를 완전하게 가지게 한다.
- project scope API와 app scope API를 섞지 말고, 공통 모델 위에 명시적 진입 함수를 둔다.

완료 조건은 다음과 같다.

- App Root Network를 renderer에서 직접 열 수 있다.
- App Root 안의 `project node`가 실제 project 정보를 가진다.

### Phase 3. App Shell 통합

목표는 홈 화면과 workspace를 하나의 셸 계층으로 합치는 것이다.

- `App.tsx`의 "home vs workspace" 분기를 없애고 항상 workspace shell을 렌더링한다.
- `WorkspaceShell`이 project 전용 prop 대신 workspace session을 받게 바꾼다.
- title bar는 app mode와 project mode를 모두 표현할 수 있게 바꾼다.
- `Go Home`은 카드형 홈으로 가는 동작이 아니라 App Root로 이동하는 동작이 된다.
- 기존 `ProjectHome`은 새 프로젝트 생성, 빈 상태 안내, missing path 대응을 담당하는 보조 레이어로 축소한다.

완료 조건은 다음과 같다.

- 앱이 항상 하나의 workspace shell 안에서 동작한다.
- project를 닫아도 셸이 바뀌지 않고 App Root만 열린다.

### Phase 4. App Root Canvas 상호작용 완성

목표는 `project`를 캔버스 안의 정식 객체로 만들고 Project Root 진입을 완성하는 것이다.

- `NetworkWorkspace`의 open/select 경로에 `project`를 추가한다.
- `NodeContextMenu`, `ObjectPicker`, `NetworkObjectBrowser`, selection store에 `project`를 추가한다.
- `project node` 기본 동작은 "project workspace 열기"로 정의한다.
- App Root 안의 `project node`에는 프로젝트 메타 편집과 프로젝트 삭제 액션을 제공한다.
- App Root 바깥 network 안의 `project node`에는 프로젝트 메타 편집과 "이 network에서 제외" 액션을 제공한다.
- portal 시각 언어에서 `network`와 `project`의 차이를 필요한 만큼만 드러낸다.
- App Root에서 새 프로젝트 생성 시 새 project node를 자연스럽게 캔버스에 배치하는 흐름을 설계한다.

완료 조건은 다음과 같다.

- App Root에서 project node를 클릭하거나 더블클릭하면 해당 Project Root로 들어간다.
- App Root에서 project를 객체처럼 선택하고 탐색할 수 있다.
- App Root와 일반 network에서 `project node`의 삭제 의미가 다르게 동작한다.

### Phase 5. Sidebar와 capability 분리

목표는 app mode와 project mode가 같은 셸을 쓰되 서로 다른 도구 세트를 갖게 하는 것이다.

- sidebar를 workspace capability 기반으로 렌더링한다.
- app mode에서는 files, modules, Narre 진입을 숨기거나 비활성화한다.
- project mode에서는 기존 files / objects / networks 구성을 유지한다.
- object panel과 network list가 app mode에서도 일관되게 동작하도록 정리한다.
- terminal 기본 cwd, file path resolver, PDF file lookup은 project workspace가 있을 때만 project root를 사용하게 한다.

완료 조건은 다음과 같다.

- app mode에서 project 전용 기능이 억지로 동작하려 하지 않는다.
- project mode에서는 기존 기능 회귀가 없다.

### Phase 6. Restore / Sync / Detached Window 마감

목표는 App Root 도입 이후에도 상태 복원과 다중 창 동작이 자연스럽게 유지되게 하는 것이다.

- 마지막 workspace와 각 workspace 상태를 저장하는 정책을 정의한다.
- app workspace와 project workspace를 각각 cache key로 관리한다.
- bridge sync payload를 workspace session 기준으로 재정의한다.
- detached editor shell이 project 여부에 따라 다른 hydrate 경로를 쓰지 않게 한다.
- startup restore 정책을 명확히 결정한다.

권장 정책은 다음과 같다.

- 최종 제품 기준 첫 화면은 App Root다.
- App Root 상태와 각 project workspace 상태는 별도 cache key로 저장한다.
- 프로젝트를 닫으면 마지막 App Root 상태를 복원한다.
- 프로젝트 재진입 시 마지막 project workspace 상태를 복원한다.
- detached window는 v1에서 별도 창 레이아웃까지 재생성하지 않고 main host 기준으로 정리해서 복원한다.
- 다만 개발 중간 단계에서는 기존 `lastProjectId` 복원을 임시 호환 로직으로 둘 수 있다.

완료 조건은 다음과 같다.

- App Root와 Project Workspace 사이를 오가도 editor state와 network state가 자연스럽게 복원된다.
- detached window가 app mode와 project mode 모두에서 같은 규칙으로 동작한다.

### Phase 7. 테스트와 마이그레이션 정리

목표는 구조 전환 이후의 회귀를 막는 것이다.

- core 테스트에 App Root 보장, Project Root 보장, project node hydration을 추가한다.
- renderer 테스트에 app mode 진입, project node 진입, close project -> App Root 복귀를 추가한다.
- detached window sync와 workspace restore에 대한 시나리오 테스트를 추가한다.
- 기존 `ProjectHome` 의존 테스트는 App Root 흐름 기준으로 재작성한다.
- 기존 config 키와 cache 구조를 어떻게 이전할지 마이그레이션 정책을 문서화한다.

## 8. 권장 작업 순서

작업 순서는 다음 순서를 지키는 것이 가장 안전하다.

1. `project context` 분해
2. App Root data / API 확장
3. app shell 통합
4. `project node` 상호작용 완성
5. sidebar / capability 분리
6. restore / sync / detached window 마감
7. 테스트와 마이그레이션 정리

이 순서를 거꾸로 가면 UI는 잠깐 보일 수 있어도 내부 상태가 전부 예외 처리로 더러워진다.

## 9. 구현 중 지켜야 할 금지 사항

- App Root를 기존 ProjectHome 옆의 두 번째 특수 화면으로 만들지 않는다.
- `currentProject === null`을 App Root의 의미로 계속 재사용하지 않는다.
- app mode를 가짜 project처럼 취급하지 않는다.
- files, modules, Narre 같은 project 전용 기능을 app mode에서 억지로 일반화하지 않는다.
- detached window만을 위한 별도 state 모델을 만들지 않는다.

## 10. 완료 정의

다음 조건이 만족되면 이번 작업은 완료로 본다.

- 앱을 처음 열면 App Root Canvas가 나온다.
- App Root에 project node가 보인다.
- project node를 열면 Project Root Network로 진입한다.
- 프로젝트를 닫으면 App Root로 돌아간다.
- app mode와 project mode 사이 이동 중에도 브레드크럼, editor dock, state restore, detached window sync가 유지된다.
- project 전용 기능은 project workspace에서만 활성화된다.
- 기존 project 내부 기능은 회귀 없이 동작한다.

## 11. 한 문장 요약

이 작업의 본체는 홈 화면 개편이 아니라, `project 중심 앱`을 `workspace 중심 앱`으로 바꾸고 그 위에 App Root Canvas를 정식 진입점으로 올리는 것이다.
