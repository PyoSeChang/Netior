# Narre 프롬프팅 전략 재설계

작성일: 2026-04-16  
상태: Draft  
목적: 구현에 들어가기 전에 Narre의 system prompt, project digest, tool lookup 경계를 다시 정의한다.

## 1. 배경

현재 Narre는 Netior의 최신 모델을 부분적으로 알고 있지만, 프롬프팅 전략은 아직 그 모델에 맞게 재설계되지 않았다.

문제는 단순히 prompt 길이나 tool 개수의 문제가 아니다. 더 근본적으로는 Narre가 무엇을 이미 알고 있어야 하는지와, 무엇을 조회해서 알아내야 하는지가 분리되어 있지 않다.

그 결과 Narre는 다음 네 가지 약점을 보인다.

- `network object type`과 주변 개념에 대한 존재론적 설명이 약하다.
- prompt에 상주시켜야 할 정보와 tool로 조회해야 할 live state가 섞여 있어서 search-first 성향을 보인다.
- `projectId`가 실행 컨텍스트에는 있지만 prompt 구조 안에서는 충분히 anchor되지 않는다.
- command prompt가 base system prompt 위에 skill처럼 얹히는 구조가 아니라, 정적으로 연결되어 base prompt를 대체하는 구조에 가깝다.

이 문서는 이 문제를 해결하기 위한 프롬프팅 전략의 재설계 방향을 정의한다.

## 2. 현재 문제

### 2.1 `network object type` 설명이 부족하다

현재 프롬프트는 schema, relation type, root network 같은 요약은 일부 넣고 있지만, Narre가 그 정보를 해석하는 기반 ontology가 충분하지 않다.

예를 들어 Narre는 다음 구분을 system-level로 먼저 알고 있어야 한다.

- `project`는 작업 세계의 경계다.
- `network`는 객체를 배치하고 읽는 장면이다.
- `concept`는 기본 의미 단위다.
- `schema`은 객체의 도메인 타입이다.
- `relation type`은 관계의 문법이다.
- `edge`는 관계의 실제 사례다.
- `network node`는 object 자체가 아니라 object의 network-local manifestation이다.
- `layout`은 object가 아니라 workspace mode 및 view policy다.
- `type group`은 타입 정리용 메타 구조다.
- `module`은 agent가 직접 관리할 핵심 존재론이 아니라 경로/북마크 성격의 편의 구조다.
- `folder`는 filesystem folder가 아니라 특정 수납/인출 역할을 맡는 network node다.

이 기반 구분이 없으면 Narre는 요청을 받을 때마다 `object`, `node`, `layout`, `schema`, `graph relation`, `type organization`을 같은 층위에서 다루게 된다.

### 2.2 prompt와 lookup의 경계가 없다

현재 전략은 실제로는 다음 질문에 답하지 못하고 있다.

- 무엇을 Narre가 항상 알고 있어야 하는가
- 무엇을 현재 프로젝트 요약으로 매 턴 주입해야 하는가
- 무엇을 live state로서 tool로만 조회해야 하는가

이 경계가 없으면 Narre는 이미 prompt에 있거나 항상 알고 있어야 할 구조도 다시 검색한다.

대표적인 낭비는 다음과 같다.

- 계층형 네트워크 구조를 이미 알고 있어야 하는데 매번 다시 조회한다.
- 현재 프로젝트의 schema, relation type 체계를 매번 탐색한다.
- schema-level 판단을 하기 전에 broad search부터 들어간다.

### 2.3 현재 문구가 tool overuse를 유도한다

현재 prompt에는 tool 사용을 넓게 권장하는 문구가 있고, 이 문구는 Narre를 `reason-first`가 아니라 `search-first`로 밀어버린다.

문제는 tool 사용 자체가 아니라, tool 사용의 순서와 자격이 정의되어 있지 않다는 점이다.

### 2.4 이미 갖고 있는 metadata를 충분히 활용하지 못한다

현재 desktop-app 쪽에서는 이미 다음 수준의 project metadata를 만들 수 있다.

- project name / root dir
- app root / project root
- network tree
- schema 목록과 field digest
- relation type 목록
- type group digest

즉 기반 정보가 아예 없는 것이 아니라, 이 정보를 prompt contract 안에서 어떤 층위로 배치할지의 전략이 부족하다.

### 2.5 `projectId`가 prompt 안에서 execution identity로 다뤄지지 않는다

현재 런타임과 세션 저장, 승인 저장, provider 컨텍스트는 모두 `projectId`를 알고 있다.

하지만 prompt contract 안에서는 이 값이 "현재 내가 속한 작업 세계"라는 실행 정체성으로 충분히 드러나지 않는다.

그 결과 Narre는 다음 상태에 빠지기 쉽다.

- 현재 프로젝트를 이미 알고 있으면서도 다시 확인하려 든다.
- project-scoped tool 호출에서 `project_id`를 일관되게 쓰지 못한다.
- 현재 project identity와 project digest를 같은 층위로 취급한다.

`projectId`는 schema 목록처럼 "알아두면 좋은 metadata"가 아니라, Narre가 지금 어디서 행동하는지 정하는 execution identity여야 한다.

### 2.6 command prompt가 static override 구조다

현재 command prompt는 `/onboarding`, `/index` 같은 명령을 위해 별도 builder를 고정 import해서 선택하는 방식이다.

더 중요한 문제는 command prompt가 base system prompt 위에 추가되는 것이 아니라, 사실상 base prompt를 대체하는 흐름이라는 점이다.

이 구조는 다음 문제를 만든다.

- command 실행 시 base ontology와 tool policy가 약해질 수 있다.
- command별 예외 로직이 runtime 내부에 쌓인다.
- `/index` 같은 명령의 특수 처리와 prompt 조립이 한 군데에 엉긴다.
- 향후 command를 늘릴수록 prompt layer가 skill system이 아니라 하드코딩된 switch/map처럼 커진다.

## 3. 재설계 원칙

### 3.1 stable ontology는 prompt에 상주시킨다

Narre가 매 턴마다 다시 검색해서는 안 되는 지식이 있다.

- Netior가 어떤 객체들을 1급 존재로 다루는가
- object와 node의 차이는 무엇인가
- relation type과 edge의 차이는 무엇인가
- layout, module, type group, folder node는 어디에 속하는가

이런 정보는 lookup 대상이 아니라 system prompt의 고정 ontology여야 한다.

### 3.2 프로젝트의 모델링 언어는 요약해서 prompt에 넣는다

Narre는 현재 프로젝트가 어떤 모델링 언어를 쓰는지 알고 있어야 한다.

여기서 모델링 언어란 다음을 뜻한다.

- 어떤 network hierarchy가 이미 있는가
- 어떤 schema이 있는가
- 어떤 relation type이 있는가
- type group path가 어떻게 구성되어 있는가
- 어떤 relational schema pattern이 이미 존재하는가

이 정보는 instance 데이터가 아니라 project schema/index digest다.

### 3.3 live state만 tool로 조회한다

tool lookup은 현재 상태, 실제 대상, 후보 집합, 모호성 해소에만 사용해야 한다.

즉 tool은 다음 상황을 위해 존재한다.

- 특정 concept나 object의 실제 값이 필요할 때
- 특정 network의 현재 node/edge 상태가 필요할 때
- 실제 candidate set을 확인해야 할 때
- mention이나 이름이 모호해서 정확한 대상을 식별해야 할 때

반대로 ontology나 project schema/index까지 tool로 매번 재확인하면 tool spam이 생긴다.

### 3.4 prompt metadata는 raw dump가 아니라 digest여야 한다

프롬프트가 모든 데이터를 다 품어야 하는 것은 아니다.

중요한 것은 전체를 넣는 것이 아니라, Narre가 tool 선택 전에 사고할 수 있을 만큼의 요약을 넣는 것이다.

### 3.5 `projectId`는 metadata가 아니라 execution identity다

`projectId`는 project digest의 한 항목이 아니다.

이 값은 Narre가 현재 어느 project에 바인딩되어 있는지 정하는 실행 정체성이다.

따라서 `projectId`는 다음 성격으로 다뤄져야 한다.

- lookup 대상이 아니다.
- 현재 세션의 기본 project scope다.
- prompt의 맨 위에서 현재 작업 세계를 고정하는 값이다.
- project-scoped tool input의 기본값이 되어야 한다.

### 3.6 command prompt는 base prompt 위에 얹는 dynamic skill이어야 한다

conversation command는 별도 prompt를 static override하는 방식보다, base prompt 위에 덧붙는 skill prompt로 다루는 편이 맞다.

즉 `/onboarding`, `/index`는 "다른 Narre"가 아니라, 같은 Narre가 특정 작업 모드로 진입할 때 추가로 불러오는 skill이어야 한다.

이 원칙이 있으면 command prompt는 다음 역할만 맡게 된다.

- 해당 command의 입력 계약 설명
- 해당 command의 작업 순서와 산출물 형식
- 해당 command에서 우선해야 할 tool usage와 금지해야 할 drift

반대로 base ontology, project identity, project digest, 공통 tool policy는 여전히 base system prompt가 담당해야 한다.

## 4. 정보 계층 재정의

### 4.1 Tier 0. Execution Identity

이 계층은 현재 세션이 어떤 project에 묶여 있는지 정하는 실행 정체성이다.

- current `projectId`
- current `projectName`
- current `root_dir`
- current session이 project-scoped라는 사실

이 계층의 목표는 Narre가 "지금 어느 세계 안에서 생각하고 행동하는가"를 다시 찾지 않게 만드는 것이다.

### 4.2 Tier 1. 항상 system prompt에 넣을 고정 ontology

이 계층은 프로젝트마다 바뀌지 않는 Netior의 작업 세계 설명이다.

- `project`
- `network`
- `concept`
- `schema`
- `relation type`
- `edge`
- `file`
- `network node`
- `folder node`
- `layout type`
- `layout config`
- `type group`
- `module`

이 계층의 목표는 Narre가 요청을 받는 즉시 개념 층위를 올바르게 분류하게 만드는 것이다.

### 4.3 Tier 2. 매 요청에 주입할 project digest

이 계층은 현재 프로젝트의 모델링 언어와 구조 인덱스다.

- project name
- project `root_dir`
- app root network
- project root network
- 계층형 네트워크 인덱스
- schema digest
- relation type digest
- type group digest
- relational schema digest

이 계층의 목표는 Narre가 broad search 없이도 구조적 계획을 세울 수 있게 하는 것이다.

### 4.4 Tier 3. tool lookup 전용 live state

이 계층은 현재 상태이거나, 후보 탐색이 필요하거나, ID/멤버십/값 확인이 필요한 정보다.

- 특정 concept/object 인스턴스
- 특정 network의 full node/edge 상태
- concept property 값
- file 목록과 내용
- layout의 실제 config, position, viewport
- candidate concept 집합
- ambiguous title/name resolution

이 계층의 목표는 필요한 순간에만 정확하게 조회하게 만드는 것이다.

## 5. System Prompt에 들어갈 ontology block

### 5.1 핵심 object type

- `Project`: 하나의 작업 세계에 대한 경계다. 무엇이 이 세계에 속하는지와 어떤 루트 구조를 가질지를 정한다.
- `Network`: object들을 특정 문제의식 아래 배치하고 읽는 작업 장면이다.
- `Concept`: 이름 붙이고 구별하고 발전시킬 수 있는 기본 의미 단위다.
- `Schema`: object가 어떤 종류의 존재인지 규정하는 도메인 타입이다.
- `Relation Type`: 두 object 사이의 연결을 어떤 뜻으로 읽을지 정하는 관계의 문법이다.
- `Edge`: 실제 object들 사이에 성립한 관계 사례다. relation type과 relation meaning를 실을 수 있다.
- `File`: 원문, 근거, 산출물이 남는 물질적 기록 객체다.

### 5.2 object와 구분해야 하는 것

- `Network Node`: object 자체가 아니라, object가 특정 network 안에서 작업 가능하게 나타난 local manifestation이다.
- `Folder Node`: filesystem folder가 아니라, 특정 결과물을 담거나 꺼내 쓰는 수납/인출 역할의 network node다.
- `Layout Type`: workspace mode다. object type이 아니다.
- `Layout Config`: layout type 위에 적용되는 읽기/조작 정책이다. object 자체가 아니다.
- `Type Group`: schema과 relation type을 정리하기 위한 메타 구조다. 도메인 object 자체가 아니다.
- `Module`: `root_dir` 외부 또는 주변의 참조 경로, 즐겨찾기, 편의적 접근 단위를 위한 구조다. 이 phase에서 agent가 직접 관리할 핵심 object는 아니다.

### 5.3 prompt에 포함해야 하는 이유

이 ontology block이 있어야 Narre는 다음 구분을 검색 없이 바로 할 수 있다.

- 이것이 object 생성 문제인지, node 배치 문제인지
- 이것이 schema 문제인지, graph relation 문제인지
- 이것이 layout/view 문제인지, object modeling 문제인지
- 이것이 agent-owned change인지, 사용자 편의 구조에 대한 논의인지

## 6. Project Digest에 넣을 내용

### 6.1 계층형 네트워크 인덱스

계층형 네트워크 인덱스는 prompt에 포함하는 쪽이 맞다.

이유는 다음과 같다.

- network 개수는 개념 인스턴스처럼 폭증하는 종류의 데이터가 아니다.
- 구조 배치와 생성 판단은 tool 호출 전에 이루어져야 한다.
- root, parent, sibling 구조를 매번 조회하게 하면 tool spam이 된다.

이 인덱스는 full state가 아니라 planning index여야 한다.

권장 digest 항목:

- network id
- network name
- parent path 또는 tree path
- depth
- scope 요약

### 6.2 schema digest

schema은 현재 프로젝트의 도메인 언어다. Narre가 매번 찾아보는 대상이 아니라, 사고의 출발점이 되어야 한다.

권장 digest 항목:

- name
- group path
- description
- model/semantic slot 요약이 있다면 그 정보
- 주요 field summary
- `schema_ref`가 있다면 target schema 요약
- instance-backed choice인지 여부에 대한 요약

핵심은 Narre가 "새 schema이 필요한가"와 "기존 schema 확장인가"를 broad search 없이 판단하게 만드는 것이다.

### 6.3 relation type digest

relation type 역시 현재 프로젝트의 graph grammar다.

권장 digest 항목:

- name
- group path
- description
- directed 여부
- line style 또는 의미 요약

핵심은 Narre가 "새 relation type을 만들어야 하는가"와 "기존 relation type을 재사용하면 되는가"를 바로 판단하게 만드는 것이다.

### 6.4 relational schema digest

특정 schema이 다른 schema을 참조하는 구조는 schema-level 정보다. 이 역시 prompt에 요약으로 들어가야 한다.

예시:

- `Task.owner -> Person`
- `Document.author -> Person`
- `Character.equipped_items -> Item`

이 정보가 prompt에 있어야 Narre는 edge와 field를 덜 혼동한다.

### 6.5 type group digest

type group은 핵심 존재론은 아니지만, 현재 타입 체계가 어떻게 조직되어 있는지는 Narre가 알아야 한다.

목적은 다음과 같다.

- schema/relation type의 위치 감각 제공
- 새 타입을 어디에 둘지 판단
- 사용자가 "폴더처럼 정리해줘"라고 했을 때 type group과 object를 혼동하지 않게 하기

## 7. Tool Lookup 정책

### 7.1 기본 우선순위

Narre의 판단 순서는 다음과 같아야 한다.

1. mention된 대상이 있는가
2. system prompt의 ontology와 project digest만으로 판단 가능한가
3. 필요한 대상만 targeted lookup으로 확인하면 되는가
4. 정말로 broad search가 필요한가

즉 우선순위는 다음과 같다.

- mentioned object
- prompt digest
- targeted lookup
- broad search

### 7.2 tool을 써야 하는 경우

- 특정 concept/object의 실제 ID나 현재 값이 필요할 때
- 특정 network의 현재 node/edge 배치를 확인해야 할 때
- candidate set을 실제로 확인해야 할 때
- mention이나 이름이 모호해서 disambiguation이 필요할 때
- destructive 또는 high-impact change 전에 live state를 검증해야 할 때

### 7.3 tool을 쓰지 말아야 하는 경우

- 계층형 네트워크 구조를 이미 prompt index가 제공할 때
- schema 목록과 relation type 목록이 이미 digest로 들어와 있을 때
- object type의 의미 구분을 ontology block이 이미 제공할 때
- type group path를 이미 prompt가 제공할 때

### 7.4 anti-pattern

다음은 줄여야 할 대표 anti-pattern이다.

- 매 턴 시작마다 `list_concepts`, `list_networks`, `get_network_tree`부터 호출하기
- schema과 relation type이 prompt에 있는데도 다시 전체 목록을 탐색하기
- schema-level 질문인데 instance search부터 시작하기
- 특정 대상 하나면 충분한데 broad search를 여러 번 중첩하기

## 8. MCP Tool Surface 영향

프롬프트 전략이 바뀌면 MCP tool list와 노출 방식도 함께 바뀌어야 한다.

이유는 간단하다. 현재 구조에서는 `netior-mcp`가 등록한 전체 tool이 한 서버 surface로 그대로 노출되고, provider는 그 전체 surface를 세션에 연결한다.

즉 prompt를 아무리 잘 써도 tool surface가 그대로면, 모델은 여전히 "쓸 수 있는 도구 전체"를 보고 탐색 비용이 낮은 broad discovery 쪽으로 기울 수 있다.

### 8.1 현재 구조의 한계

- `netior-mcp`는 현재 `registerAllTools()`로 전체 tool을 한 번에 등록한다.
- Narre runtime은 MCP server config 배열을 지원하지만, 실제로는 기본 `netior` 서버 하나만 붙인다.
- provider 계층도 현재는 "어떤 서버를 붙일지"는 제어하지만, "한 서버 안에서 어떤 tool만 노출할지"는 제어하지 않는다.

따라서 prompt reform만으로는 tool overuse를 완전히 막지 못한다.

### 8.2 tool surface도 계층화해야 한다

prompt 계층이 `execution identity / ontology / digest / live lookup`으로 나뉘는 것처럼, tool surface도 계층을 나누는 편이 맞다.

- `base modeling surface`
  - schema/graph mutation과 targeted inspection의 핵심 도구
- `targeted lookup surface`
  - object, network, edge, concept의 현재 상태를 정밀 확인하는 도구
- `discovery/bootstrap surface`
  - project 전체를 훑는 broad discovery 도구
- `command skill surface`
  - `/index` 같은 특정 skill에서만 필요한 PDF/file 도구

핵심은 prompt에 이미 digest로 넣은 정보를 다시 긁는 도구를 default surface에서 내리는 것이다.

### 8.3 default surface에서 재검토해야 할 도구

다음 도구들은 prompt digest가 충분해질수록 기본 노출 필요성이 낮아진다.

- `get_project_summary`
- `list_schemas`
- `list_relation_types`
- `list_type_groups`
- `get_project_root_network`
- `get_network_tree`
- 경우에 따라 `list_networks`

이 도구들은 없애는 것이 아니라, `bootstrap/discovery surface`로 내리거나 낮은 우선 surface로 분리하는 쪽이 맞다.

### 8.4 command skill 전용 surface로 보내야 할 도구

다음 도구들은 일반 대화 기본 surface보다 command skill surface에 가깝다.

- `read_pdf_pages`
- `read_pdf_pages_vision`
- `get_file_metadata`
- `update_file_pdf_toc`
- `list_directory`
- `read_file`
- `glob_files`
- `grep_files`

특히 `/index`는 PDF indexing skill이므로, 이 도구들이 일반 modeling 대화에 항상 떠 있는 상태는 좋지 않다.

### 8.5 metadata와 실제 tool surface의 drift도 정리해야 한다

현재 `NETIOR_MCP_TOOL_SPECS`에는 `list_modules`가 정의되어 있지만, 실제 `registerAllTools()`에는 module tool이 등록되어 있지 않다.

이런 drift는 prompt/tool reform 이후 더 치명적이다. Narre가 "존재한다고 생각하는 도구"와 "실제로 호출 가능한 도구"가 달라지면, skill prompt나 tool policy가 쉽게 깨진다.

따라서 tool metadata 문법과 실제 MCP registration surface를 같이 정리해야 한다.

### 8.6 tool metadata도 richer contract가 필요하다

현재 tool metadata는 대략 다음만 표현한다.

- category
- kind
- approval mode

프롬프트 전략이 바뀌면 최소 다음 축이 추가로 필요하다.

- `surface`
  - base / targeted / discovery / command-skill
- `scope`
  - app / project / network / object
- `defaultProjectBinding`
  - current project 기본값 사용 여부
- `promptRedundant`
  - prompt digest가 이미 제공하는 정보인지 여부
- `commandSkillKeys`
  - 특정 skill에서만 노출해야 하는지 여부

### 8.7 구현 방향

가장 현실적인 방향은 provider 안에서 tool을 숨기려 하기보다, MCP surface를 profile 또는 multi-server 구조로 나누는 것이다.

예를 들면:

- `netior-core`
- `netior-discovery`
- `netior-index`

처럼 같은 바이너리를 다른 등록 프로필로 띄우고, Narre runtime이 command와 대화 모드에 따라 어떤 server config를 붙일지 결정하는 구조가 가능하다.

runtime은 이미 MCP server config 배열을 지원하므로, 이 방향이 현재 구조와도 잘 맞는다.

## 9. 권장 prompt stack 구조

재설계 후 prompt는 "하나의 긴 system prompt"라기보다, 역할이 분리된 stack으로 보는 편이 맞다.

### 8.1 execution identity block

- current `projectId`
- current `projectName`
- current `root_dir`
- current session scope

이 블록은 lookup 대상이 아니라, 현재 run의 전제다.

### 8.2 고정 역할과 범위

- Narre는 Netior modeling assistant다.
- 기본 중심은 project graph와 modeling state다.
- module, context 같은 비핵심 영역은 이 phase에서 agent-owned mutation 범위가 아니다.

### 8.3 ontology block

- object type 정의
- object와 node의 구분
- schema와 graph relation의 구분
- layout, type group, module, folder node의 책임 경계

### 8.4 project digest block

- root networks
- network hierarchy index
- schema digest
- relation type digest
- type group digest
- relational schema digest

### 8.5 command skill prompt block

conversation command가 있을 때만 동적으로 로드되는 overlay다.

예를 들면:

- `/onboarding` skill prompt
- `/index` skill prompt

이 블록은 base prompt를 대체하지 않는다. base prompt 위에 추가되어 해당 command의 입력 계약, 작업 절차, 산출 형식을 설명한다.

### 8.6 decision policy block

- 먼저 prompt로 판단할 것
- live state만 tool로 조회할 것
- broad search는 마지막 수단으로 둘 것
- destructive change는 확인할 것

### 8.7 command skill 구조 원칙

- command skill은 static override가 아니라 dynamic overlay다.
- command skill은 base ontology를 다시 정의하지 않는다.
- command skill은 runtime의 특수 분기 대신 자기 input contract와 task procedure를 소유한다.
- command skill은 필요한 경우에만 lazy load된다.
- command skill registry는 slash command registry와 느슨하게 연결되어야 한다.

## 10. 기대 효과

이 재설계가 들어가면 다음 효과를 기대할 수 있다.

- Narre가 `network object type`을 더 안정적으로 구분한다.
- 현재 project identity를 더 안정적으로 유지한다.
- object, node, edge, layout, type group, module을 덜 혼동한다.
- schema-level 요청에서 불필요한 search를 줄인다.
- network 배치와 hierarchy 작업에서 tool spam을 줄인다.
- schema/ref-field/relation type 선택이 더 일관된다.
- command prompt가 base prompt를 덮어쓰지 않고 skill처럼 동작하게 된다.
- prompt가 단순 설명문이 아니라 tool selection과 task-mode selection의 출발점이 된다.

## 11. 구현 범위 제안

이번 문서는 구현 문서가 아니라 전략 문서다. 다만 실제 반영 지점은 분명해야 한다.

우선순위는 다음 순서가 적절하다.

1. `system-prompt.ts`에서 execution identity, ontology block, decision policy를 재작성한다.
2. `narre-ipc.ts`에서 execution identity와 project digest를 더 명확히 구조화한다.
3. command prompt를 base prompt와 분리된 dynamic skill layer로 바꾼다.
4. onboarding prompt와 eval 시나리오를 뒤에서 정렬한다.

핵심은 "더 많은 데이터를 넣는다"가 아니라 "무엇을 항상 알고, 무엇을 조회해야 하는지 경계를 세운다"이다.

## 12. 최종 제안

Narre 프롬프팅 전략은 다음 문장으로 요약할 수 있다.

`execution identity와 stable ontology, project schema/index는 prompt stack에 상주시키고, live state와 ambiguity만 tool로 조회하며, command는 base prompt 위에 얹는 dynamic skill로 다룬다.`

이 원칙이 서야 Narre는 tool을 많이 쓰는 agent가 아니라, 먼저 이해하고 필요한 만큼만 조회하는 modeling assistant가 된다.
