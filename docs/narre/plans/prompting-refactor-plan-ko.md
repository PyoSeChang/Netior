# Narre 프롬프팅 리팩터링 계획

작성일: 2026-04-16  
상태: Draft  
기준 문서: `docs/narre-prompting-strategy-redesign-ko.md`

## 1. 목표

Narre 프롬프팅을 다음 구조로 재편한다.

- `projectId`를 단순 metadata가 아니라 execution identity로 승격한다.
- `network object type`과 주변 개념을 base ontology로 상주시킨다.
- 현재 프로젝트의 schema/index를 project digest로 요약 주입한다.
- live state만 tool lookup 대상으로 남긴다.
- `/onboarding`, `/index` 같은 command prompt를 base system prompt를 대체하는 정적 builder가 아니라, base prompt 위에 얹는 dynamic skill prompt로 바꾼다.

이 리팩터링의 목적은 prompt를 길게 만드는 것이 아니라, Narre가 무엇을 이미 알고 있고 무엇을 조회해야 하는지 경계를 재정의하는 데 있다.

## 2. 현재 구조와 직접적인 문제

### 2.1 prompt contract가 execution identity를 표현하지 못한다

현재 Narre runtime은 `projectId`를 알고 실행된다. 세션 저장, approval 저장, provider run context도 모두 project-scoped다.

하지만 prompt 입력 구조는 사실상 다음 축만 강하게 표현한다.

- project name
- root dir
- schemas
- relation types
- 일부 project metadata

즉 현재 project scope의 정체성은 실행 계층에만 강하고, prompt 계층에는 약하다.

### 2.2 command prompt가 base prompt를 대체한다

현재 runtime은 command가 있을 때 base system prompt 대신 command-specific prompt builder를 선택한다.

이 구조는 다음 문제를 만든다.

- command 실행 시 base ontology와 공통 tool policy가 약해진다.
- command-specific 예외 처리가 runtime에 남는다.
- `/index` 같은 명령의 특수 파싱 로직이 runtime 내부에 박힌다.
- command가 늘수록 prompt 계층이 skill system이 아니라 하드코딩된 분기 구조가 된다.

### 2.3 project metadata는 풍부하지만 계층이 없다

desktop-app main IPC는 이미 다음 metadata를 만들 수 있다.

- project name
- root_dir
- root networks
- network tree
- schema + field digest
- relation type digest
- type group digest

하지만 지금은 이 값을 execution identity, ontology-aware digest, live lookup 경계로 나눠 주지 않는다.

### 2.4 tool contract가 current project 기본값을 갖지 못한다

현재 Netior MCP의 다수 tool은 `project_id`를 필수 인자로 요구한다.

이 자체는 명시적이지만, Narre 입장에서는 이미 project-scoped 세션 안에서 일하고 있으므로 같은 정보를 반복 입력하는 구조가 된다.

이 상태는 다음 문제를 만든다.

- Narre가 project ID를 prompt에서 강하게 anchor하지 못하면 tool 호출 품질도 흔들린다.
- command prompt가 user-visible payload 안에 `projectId`를 끼워 넣어야 하는 경우가 생긴다.
- project-scoped tool인데도 cross-project tool처럼 다뤄진다.

### 2.5 MCP tool surface가 monolithic하다

현재 `netior-mcp`는 `registerAllTools()`로 전체 도구를 한 번에 등록하고, Narre runtime은 기본적으로 `netior` 서버 하나만 세션에 붙인다.

이 구조는 다음 문제를 만든다.

- prompt에 이미 있는 digest를 다시 긁는 broad discovery tool도 항상 떠 있다.
- `/index`용 PDF 도구와 일반 modeling 도구가 같은 surface에 섞인다.
- tool misuse를 prompt 문장만으로 막아야 한다.
- tool metadata와 실제 등록 surface가 drift하기 쉽다.

즉 프롬프트 전략을 바꾸면 MCP tool list 전략도 같이 바뀌어야 한다.

## 3. 리팩터링 원칙

1. `projectId`는 project digest가 아니라 execution identity다.
2. base ontology는 command 여부와 무관하게 항상 유지한다.
3. command prompt는 base prompt를 대체하지 않고 dynamic skill overlay로 붙인다.
4. project digest는 summarized schema/index만 담는다.
5. live state와 ambiguity만 tool lookup으로 남긴다.
6. project-scoped tool은 current project 기본값을 가질 수 있어야 한다.
7. runtime 내부의 command-specific branching은 가능한 한 skill module로 이동한다.
8. 기존 command UX와 renderer contract는 가능한 한 유지한다.
9. prompt reform과 MCP tool surface reform은 함께 진행한다.

## 4. 목표 구조

### 4.1 Prompt Context Contract

프롬프트 입력은 최소 네 층으로 나뉘어야 한다.

- `executionIdentity`
  - `projectId`
  - `projectName`
  - `projectRootDir`
  - session/project scope
- `baseOntology`
  - object type 설명
  - node/layout/module/type group/folder node 구분
- `projectDigest`
  - root networks
  - network hierarchy index
  - schema digest
  - relation type digest
  - type group digest
  - relational schema digest
- `lookupOnly`
  - live state와 candidate resolution

실제 타입은 한 interface일 수 있지만, 개념적으로는 이 4층을 분리해야 한다.

### 4.2 Prompt Assembly Pipeline

최종 prompt 조립은 다음 순서를 따른다.

1. request에서 `projectId`와 command를 resolve한다.
2. `executionIdentity`를 만든다.
3. base system prompt를 조립한다.
4. project digest를 조립한다.
5. command가 있으면 대응하는 skill prompt를 동적으로 로드한다.
6. base prompt 뒤에 skill prompt를 overlay로 추가한다.
7. mentions와 user message를 처리한다.

핵심은 command가 있어도 base prompt가 사라지지 않는다는 점이다.

### 4.3 Command Skill Prompt Model

command prompt는 다음 형태의 skill module이어야 한다.

- `key`
- `commandName`
- `buildSkillPrompt(context)`
- 선택적으로 `normalizeArgs(message, parsedCommand)`
- 선택적으로 `validateInput(mentions, args)`
- 선택적으로 `toolPolicyHints`

이 구조가 있으면 `/index`의 특수 파라미터 파싱이나 `/onboarding`의 단계 지시를 runtime 본체에서 떼어낼 수 있다.

### 4.4 Tool Input Policy

tool 입력 정책은 다음으로 정리한다.

- project-scoped query/mutation tool은 `project_id`를 생략하면 current project를 기본값으로 쓴다.
- app-scope 도구나 cross-project 동작은 명시적 인자를 유지한다.
- prompt는 "현재 project는 이미 고정되어 있다"는 사실을 분명히 말한다.
- command skill도 user-visible payload에 `projectId`를 억지로 노출하지 않도록 정리한다.

### 4.5 MCP Tool Surface Model

tool surface는 최소 다음 레벨로 나누는 편이 맞다.

- `core`
  - 일반 modeling 대화에서 항상 노출하는 핵심 도구
- `targeted`
  - live state 정밀 확인용 도구
- `discovery`
  - project 전체를 훑는 bootstrap/broad discovery 도구
- `skill`
  - 특정 command skill에서만 필요한 도구

예시 분류:

- `core`
  - schema/field mutation
  - relation type mutation
  - concept mutation
  - object lookup
  - network/node/edge mutation
- `targeted`
  - `get_network_full`
  - `get_edge`
  - `get_concept_properties`
  - `get_field_candidates`
- `discovery`
  - `get_project_summary`
  - `list_schemas`
  - `list_relation_types`
  - `list_type_groups`
  - `get_network_tree`
  - `get_project_root_network`
- `skill`
  - `read_pdf_pages`
  - `read_pdf_pages_vision`
  - `get_file_metadata`
  - `update_file_pdf_toc`
  - file search/read 계열 도구

이 구조가 있어야 prompt digest를 강화한 뒤에도 tool surface가 그 전략을 따라간다.

## 5. 구현 대상 파일

### 5.1 narre-server

- `packages/narre-server/src/system-prompt.ts`
- `packages/narre-server/src/runtime/narre-runtime.ts`
- `packages/narre-server/src/command-router.ts`
- `packages/narre-server/src/prompts/index-toc.ts`
- `packages/narre-server/src/prompts/onboarding-v2.ts`

추가 예정 구조:

- `packages/narre-server/src/prompt-skills/registry.ts`
- `packages/narre-server/src/prompt-skills/types.ts`
- `packages/narre-server/src/prompt-skills/onboarding-skill.ts`
- `packages/narre-server/src/prompt-skills/index-skill.ts`

### 5.2 desktop-app main IPC

- `packages/desktop-app/src/main/ipc/narre-ipc.ts`

이 파일에서 해야 할 일:

- execution identity와 project digest를 명시적으로 분리
- prompt에 들어갈 digest shape를 안정화
- command skill이 필요한 부가 input만 따로 넘기도록 정리

### 5.3 shared command metadata

- `packages/shared/src/types/index.ts`
- `packages/shared/src/constants/index.ts`

가능한 역할:

- slash command에 `promptSkillKey` 같은 메타를 추가
- command registry와 skill registry를 느슨하게 연결

### 5.4 netior-mcp

- `packages/netior-mcp/src/index.ts`
- `packages/netior-mcp/src/tools/index.ts`
- `packages/netior-mcp/src/tools/shared-tool-registry.ts`
- project-scoped tool 파일들
- `packages/shared/src/constants/netior-mcp-tools.ts`
- `packages/shared/src/types/index.ts`

핵심 역할:

- tool profile 또는 surface 개념 추가
- default surface와 skill surface 분리
- current project 기본값 resolver 추가
- project-scoped tool의 `project_id` optional 전환 범위 정리
- app/global tool과 project-scoped tool을 구분

## 6. 마일스톤

### Milestone A. Prompt Context 계약 분리

작업:

- `SystemPromptParams`를 execution identity와 project digest를 표현할 수 있게 재구성
- base prompt에서 `projectId`를 명시적으로 다루는 블록 추가
- `projectId` fallback을 `projectName = projectId` 식의 임시 처리에서 분리

주요 파일:

- `packages/narre-server/src/system-prompt.ts`
- `packages/narre-server/src/runtime/narre-runtime.ts`
- `packages/desktop-app/src/main/ipc/narre-ipc.ts`

완료 기준:

- base prompt가 현재 project identity를 분명히 표현한다
- `projectId`가 prompt 안에서 lookup 대상처럼 서술되지 않는다
- execution identity와 project digest가 개념적으로 분리된다

### Milestone B. Base System Prompt 재작성

작업:

- `network object type` ontology block 추가
- node/layout/type group/module/folder node 책임 경계 추가
- search policy를 `mentioned object -> prompt digest -> targeted lookup -> broad search`로 재작성
- 기존 search-first 문구 제거 또는 약화

주요 파일:

- `packages/narre-server/src/system-prompt.ts`

완료 기준:

- base prompt만 읽어도 object/node/layout/schema/graph relation을 구분할 수 있다
- schema, relation type, network hierarchy를 "먼저 조회할 대상"이 아니라 "이미 주어진 digest"로 다룬다

### Milestone C. Project Digest 구조화

작업:

- `narre-ipc.ts`에서 metadata 조립 시 execution identity와 project digest를 분리
- network hierarchy index shape 정리
- schema digest와 relation type digest를 prompt 친화적 요약 구조로 정리
- relational schema summary와 type group digest 기준 정리

주요 파일:

- `packages/desktop-app/src/main/ipc/narre-ipc.ts`

완료 기준:

- project digest가 broad search를 줄일 만큼 충분히 구조적이다
- prompt에 들어갈 정보와 live lookup-only 정보가 분리된다

### Milestone D. Command Prompt를 Dynamic Skill로 전환

작업:

- runtime의 static `commandPromptBuilders` 제거
- command skill registry 추가
- command별 prompt module을 lazy load 가능 구조로 분리
- base prompt + skill prompt overlay 조립으로 변경
- `/index` 특수 arg 처리 같은 runtime 예외 로직을 skill module로 이동

주요 파일:

- `packages/narre-server/src/runtime/narre-runtime.ts`
- `packages/narre-server/src/command-router.ts`
- `packages/narre-server/src/prompts/index-toc.ts`
- `packages/narre-server/src/prompts/onboarding-v2.ts`
- 신규 `packages/narre-server/src/prompt-skills/*`

완료 기준:

- command가 있어도 base prompt가 항상 유지된다
- `/onboarding`, `/index`는 skill overlay로 동작한다
- runtime 본체에서 command-specific 분기가 줄어든다

### Milestone E. MCP Tool Surface 계층화

작업:

- `NetiorMcpToolSpec`에 surface/profile 관련 metadata 추가
- broad discovery tool, core tool, skill tool 분류
- `netior-mcp`가 profile 또는 allowed-tool 기반으로 subset registration 가능하게 수정
- runtime이 대화 모드와 command skill에 따라 필요한 MCP server surface만 연결하게 수정
- metadata와 실제 등록 surface의 drift 제거

주요 파일:

- `packages/shared/src/types/index.ts`
- `packages/shared/src/constants/netior-mcp-tools.ts`
- `packages/netior-mcp/src/index.ts`
- `packages/netior-mcp/src/tools/index.ts`
- `packages/netior-mcp/src/tools/shared-tool-registry.ts`
- `packages/narre-server/src/runtime/narre-runtime.ts`

완료 기준:

- 일반 modeling 대화에서 discovery/pdf/file 도구가 default surface에 과도하게 노출되지 않는다
- command skill은 필요한 tool surface만 추가로 붙인다
- `get_project_summary` 같은 broad discovery 도구가 default core surface에서 내려간다

### Milestone F. Project-Scoped Tool Input 개선

작업:

- `netior-mcp`에 current project resolver 추가
- project-scoped tool은 `project_id` 생략 시 current project 사용
- app-scope/cross-project 도구는 명시 인자 유지
- command prompt에서 user-visible `projectId` 전달 의존 줄이기

주요 파일:

- `packages/netior-mcp/src/tools/shared-tool-registry.ts`
- project-scoped tool 등록 파일들
- 필요 시 `packages/narre-server/src/runtime/narre-runtime.ts`

완료 기준:

- Narre가 현재 project를 잃지 않고 tool 호출한다
- project-scoped tool 호출에서 불필요한 `project_id` 반복이 줄어든다
- `/index` 같은 skill이 `projectId`를 입력 데이터로 노출하지 않아도 된다

### Milestone G. Command Skill 문서화와 검증

작업:

- command skill 작성 규약 문서화
- onboarding/index smoke scenario 정리
- tool usage regression 체크리스트 추가
- prompt stack 구조에 맞게 eval 시나리오 갱신

주요 파일:

- Narre 관련 docs
- 필요 시 eval 또는 테스트 파일

완료 기준:

- 새 command를 추가할 때 base prompt를 건드리지 않고 skill만 추가할 수 있다
- 현재 command 2종이 동일한 contract로 동작한다

## 7. 세부 설계 메모

### 7.1 `projectId` 처리

`projectId`는 다음 세 층에서 동시에 맞춰야 한다.

- prompt 상의 execution identity
- provider run context
- MCP tool 기본 project scope

셋 중 하나만 고쳐서는 불안정성이 남는다.

### 7.1.1 tool surface도 같이 봐야 한다

`projectId` 기본값을 넣더라도 tool surface가 monolithic하면 broad discovery 습관은 남는다.

즉 `projectId` 문제와 tool list 문제는 분리된 이슈가 아니라, 하나의 prompt-tool contract 문제다.

### 7.2 `/index` skill

`/index`는 현재 가장 command-specific한 예외가 많은 사례다.

리팩터링 후에는 다음이 skill module 소유가 되어야 한다.

- TOC parameter parsing
- PDF indexing task 절차
- low-quality extraction 분기
- TOC 저장 전 confirm 절차

### 7.3 `/onboarding` skill

`/onboarding`은 base ontology 위에서 "도메인 타입 체계를 잡는 작업 모드"만 추가해야 한다.

즉 schema/relation type/concept bootstrap 절차는 skill이 담당하지만, object ontology와 tool usage 원칙은 base prompt가 유지해야 한다.

## 8. 검증 계획

### 8.1 Prompt-level checks

- 일반 채팅에서 project identity가 prompt에 보인다
- 일반 채팅에서 command skill이 없을 때 base prompt만 사용된다
- command 채팅에서 base prompt + skill overlay가 함께 조립된다

### 8.2 Tool-use checks

- schema 질문에서 불필요한 `list_schemas` 남발이 줄어든다
- network hierarchy 관련 요청에서 `get_network_tree` 선조회가 줄어든다
- project-scoped tool 호출이 current project를 안정적으로 사용한다
- 일반 대화에서 PDF/file discovery 도구가 기본 surface에 불필요하게 노출되지 않는다
- command skill에서만 필요한 도구가 해당 skill 실행 시에만 보인다

### 8.3 Command checks

- `/onboarding`이 기존처럼 단계형 drafting flow를 유지한다
- `/index`가 기존처럼 PDF TOC workflow를 유지한다
- command별 특수 입력 계약이 runtime이 아니라 skill module에 모인다

## 9. 리스크

- prompt stack을 잘못 나누면 오히려 중복 설명이 늘 수 있다.
- command skill 로더를 과하게 일반화하면 현재 command 2개 대비 구조가 과도해질 수 있다.
- project-scoped tool defaulting을 성급히 넓히면 app-scope/cross-project tool까지 모호해질 수 있다.
- tool profile을 과도하게 잘게 쪼개면 provider/MCP 연결 구조가 오히려 복잡해질 수 있다.

따라서 이 리팩터링은 "전부 generic하게 만들기"가 아니라, 현재 문제를 해결하는 최소 구조로 시작해야 한다.

## 10. 최초 착수 순서

실제 착수는 다음 순서가 가장 안전하다.

1. `SystemPromptParams`와 prompt context shape를 먼저 나눈다.
2. base system prompt를 execution identity + ontology + project digest 기준으로 재작성한다.
3. runtime에서 command prompt override를 overlay 구조로 바꾼다.
4. MCP tool surface를 core/discovery/skill로 나눈다.
5. `/index`, `/onboarding`을 skill module로 옮긴다.
6. 마지막에 MCP의 current project resolver를 붙인다.

이 순서를 지키면 prompt 구조를 먼저 안정화한 뒤 tool ergonomics를 건드릴 수 있다.
