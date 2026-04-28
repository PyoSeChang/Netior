# Agent Supervisor / Orchestration 전환 계획

작성일: 2026-04-12

## 1. 문서 목적

이 문서는 Netior의 에이전트 구조를 다음 목표에 맞게 재설계하기 위한 상위 계획 문서다.

- 모바일 앱에서 작업 맥락을 원격으로 이어받을 수 있어야 한다.
- Narre, terminal 기반 Codex, terminal 기반 Claude Code를 하나의 관리 체계 안에서 다뤄야 한다.
- 이후 multi-agent orchestration을 도입할 수 있어야 한다.

이 문서는 코드 레벨 구현 상세보다 아키텍처 전환의 방향, 책임 분리, 단계별 작업과 의존성에 집중한다.

## 2. 현재 구조의 한계

현재 구조는 크게 두 갈래로 나뉘어 있다.

- `desktop-app`이 terminal 기반 agent runtime을 직접 관리한다.
- `narre-server`는 Narre chat 세션만 별도로 관리한다.

이 구조는 다음 문제를 만든다.

- 어떤 에이전트 세션이 존재하는지에 대한 단일 관리 주체가 없다.
- 모바일은 하나의 서버만 보면 되는 구조가 아니라 desktop 내부 상태까지 알아야 한다.
- Narre와 terminal agent가 서로 다른 세션 체계를 사용하므로 handoff와 원격 이어받기가 어렵다.
- 이후 orchestration을 넣으려 해도 supervisor가 볼 수 있는 공통 세션 모델이 없다.
- Narre는 내부 provider에 따라 Claude, Codex, OpenAI로 실행될 수 있지만 외부에서 볼 때는 여전히 Narre여야 한다. 현재 구조는 이 정체성 분리가 충분히 명확하지 않다.

즉 현재 구조는 single-agent, local-first 흐름에는 맞지만 remote control과 multi-agent control plane에는 맞지 않는다.

## 3. 핵심 전제

이번 전환의 핵심 전제는 다음과 같다.

- 실행 주체와 관리 주체를 분리한다.
- 실행은 계속 `desktop-app`이 맡을 수 있다.
- 관리 권위는 `narre-server`가 가진다.
- 모바일, desktop renderer, orchestration logic은 모두 `narre-server`만 바라본다.
- Narre, Codex, Claude Code는 서로 다른 실행 경로를 가질 수 있지만 같은 세션 관리 체계 안에 들어와야 한다.

따라서 앞으로 `narre-server`는 단순한 Narre chat sidecar가 아니라 전체 에이전트 시스템의 supervisor가 되어야 한다.

## 4. 목표 아키텍처

목표 구조는 다음과 같다.

- `narre-server`
  - 통합 세션 레지스트리
  - 상태 집계와 이벤트 버스
  - 원격 통신 API
  - 모바일 클라이언트 연결 지점
  - orchestration 진입점
  - Narre runtime
- `desktop-app`
  - executor host
  - PTY 소유
  - terminal launch / attach / input / resize / shutdown
  - Codex app-server bridge
  - Claude hook bridge
  - 로컬 파일시스템, 로그인 상태, OS 자원 접근
- `netior-service`
  - 데이터 plane
  - 프로젝트, 네트워크, 온톨로지, 파일 메타데이터 등의 권위 데이터 제공
- `mobile app`
  - supervisor에 attach
  - 세션 목록 조회
  - 상태 확인
  - 승인 / 입력 / 재개 요청 전달

흐름은 다음과 같다.

1. 사용자가 desktop에서 terminal agent를 시작한다.
2. desktop executor가 해당 세션을 supervisor에 등록한다.
3. 세션 상태 변화, turn 시작/종료, approval 대기, 오류 등을 supervisor에 보고한다.
4. 모바일과 desktop UI는 supervisor가 제공하는 동일한 세션 상태를 본다.
5. 모바일 입력이나 orchestration 명령은 supervisor가 받아 적절한 executor 또는 Narre runtime에 전달한다.

## 5. 핵심 개념 모델

### 5.1 Agent Definition

Agent Definition은 실행 가능한 에이전트의 설계도다.

여기에는 다음이 포함된다.

- agent kind
- 실행 surface
- preset
- 권한 범위
- 기본 목적
- system agent인지 user agent인지 여부

Agent Definition과 Session은 같은 개념이 아니다. 하나의 Agent Definition으로 여러 Session이 열릴 수 있어야 한다.

### 5.2 Preset

Preset은 단순한 프롬프트 묶음이 아니라 에이전트의 실행 계약이다.

Preset은 다음 요소를 포함할 수 있다.

- 사용할 MCP tool
- 사용할 skill
- 사용할 sub-agent
- 적용할 AGENTS.md / harness
- 맡는 책임
- 하지 말아야 할 일
- handoff 규칙
- 결과물 형식
- permission / sandbox / approval 정책
- supervisor에 대한 보고 방식

Persona는 preset의 일부일 수 있지만 핵심은 아니다. orchestration에서 중요한 것은 말투가 아니라 책임, 권한, 도구 경계다.

### 5.3 Session

Session은 특정 agent가 특정 문맥에서 실행되고 있는 실제 작업 인스턴스다.

Session은 최소한 다음 속성을 가져야 한다.

- 어떤 agent definition에서 시작되었는가
- 현재 어느 executor에서 실행 중인가
- 현재 project / network / context는 무엇인가
- 지금 상태가 idle / working / blocked / error / offline 중 무엇인가
- approval 또는 user input 대기 여부
- 현재 turn의 상태
- 외부 런타임 세션 ID가 있는가

### 5.4 Executor

Executor는 실제 실행을 담당하는 주체다.

초기 단계에서는 `desktop-app`이 executor 역할을 맡는다.

- terminal PTY 실행
- Codex launch
- Claude Code launch
- 로컬 환경 종속 작업 수행

향후 executor는 하나 이상이 될 수 있다. 이 가능성도 설계에 열어두는 것이 좋다.

### 5.5 Supervisor

Supervisor는 전체 세션의 관리 권위자다.

`narre-server`가 맡아야 할 역할은 다음과 같다.

- 세션 생성과 등록
- 세션 상태 집계
- 이벤트 전달
- 원격 요청 수신
- handoff 관리
- orchestration
- Narre runtime 실행

## 6. Narre의 정체성

Narre는 내부적으로 여러 provider 경로를 가질 수 있다.

- Claude 기반 Narre
- Codex 기반 Narre
- OpenAI 기반 Narre

하지만 외부 관리 체계에서 Narre는 항상 별도의 agent여야 한다.

즉 다음 구분이 필요하다.

- `agent kind`
  - `narre`
  - `codex`
  - `claude`
- `backend provider`
  - Narre 내부 실행 경로로서의 `claude`, `codex`, `openai`

이 분리가 있어야 supervisor가 Narre를 다른 terminal agent와 구분할 수 있고, 동시에 Narre 내부 구현은 유연하게 바꿀 수 있다.

## 7. Narre agent의 분기

Narre agent는 크게 두 부류로 나뉜다.

- system agent
- user agent

### 7.1 System agent

System agent는 앱의 핵심 구조를 위해 필수적으로 존재하는 agent다.

예시:

- network builder
- ontology helper
- 필수 메타구조 관리 agent

특징:

- platform-owned
- 사용자가 마음대로 core 계약을 바꾸면 안 된다
- 권한과 책임이 강하게 고정된다

### 7.2 User agent

User agent는 사용자의 워크플로우에 맞춰 생성되는 agent다.

예시:

- 소설 편집가 agent
- 연구 조교 agent
- 특정 도메인 분석 agent

특징:

- user-owned
- preset 커스터마이징 가능
- 탐색과 생성이 가능하지만 scope 제한이 필요할 수 있다

이 구분은 단순한 분류가 아니라 권한 모델에도 반영되어야 한다.

## 8. Multi-agent orchestration 관점에서 preset이 중요한 이유

Multi-agent orchestration의 핵심 문제는 "누가 무엇을 맡아야 하는가"다.

이 판단을 단순히 provider 이름이나 model 이름으로 하면 충분하지 않다. 실제로 supervisor가 참고해야 하는 단위는 preset이 붙은 agent definition이다.

예를 들면 supervisor는 다음처럼 판단할 수 있어야 한다.

- 네트워크 구조 생성은 `network builder`
- 코드 변경은 `terminal codex builder`
- 검토는 `terminal claude reviewer`
- 사용자 워크플로우 지원은 `narre novel editor`

즉 orchestration의 기본 단위는 "세션"이기 전에 "책임이 정의된 agent definition"이다.

## 9. 왜 agent runtime만 옮겨서는 부족한가

단순히 현재 `desktop-app`의 agent runtime 코드 일부를 `narre-server`로 옮기는 것만으로는 충분하지 않다.

전체 아키텍처가 함께 바뀌어야 하는 이유는 다음과 같다.

- 세션 ID 발급 주체가 바뀌어야 한다.
- 세션 상태의 권위자가 바뀌어야 한다.
- desktop과 narre-server 사이에 명령 / 이벤트 채널이 생겨야 한다.
- Narre와 terminal agent가 같은 세션 모델을 써야 한다.
- renderer가 desktop broadcast를 직접 보는 구조에서 supervisor stream을 보는 구조로 바뀌어야 한다.
- remote control을 고려하면 service lifetime과 window lifetime도 재정의해야 한다.

즉 이것은 코드 이동이 아니라 control plane 재구성이다.

## 10. 전환 원칙

전환은 다음 원칙을 따른다.

1. 실행은 desktop에 남길 수 있지만 관리 권위는 supervisor로 이동한다.
2. Narre와 terminal agent를 같은 세션 체계 안으로 편입한다.
3. Narre는 외부적으로 항상 Narre여야 하며 내부 provider와 분리한다.
4. mobile과 desktop renderer는 같은 supervisor 상태를 보게 한다.
5. multi-agent 기능을 바로 완성하지 않아도 되지만 multi-agent를 수용할 수 있는 구조를 먼저 만든다.
6. 기존 단일 에이전트 흐름을 한 번에 제거하지 말고 bridge를 통해 단계적으로 옮긴다.

## 11. 단계별 전환 계획

### 단계 A. 공통 세션 모델 정리

목표:

- Narre, Codex, Claude Code를 하나의 세션 모델로 설명할 수 있도록 만든다.

산출:

- 공통 agent definition 개념
- 공통 session 개념
- supervisor와 executor 사이에서 주고받을 이벤트 / 명령 개념

이 단계가 먼저 필요한 이유:

- 이후 어떤 컴포넌트도 같은 대상을 같은 말로 부를 수 있어야 한다.

### 단계 B. Narre server를 supervisor 구조로 확장

목표:

- `narre-server`가 Narre chat server가 아니라 통합 세션 관리자 역할을 맡도록 만든다.

산출:

- 세션 레지스트리
- 상태 집계
- 이벤트 스트림
- 원격 요청 API

이 단계가 필요한 이유:

- 모바일과 orchestration이 바라볼 단일 권위자가 생긴다.

### 단계 C. Desktop executor bridge 도입

목표:

- desktop-app이 상위 supervisor와 통신하는 executor로 바뀐다.

산출:

- executor 등록
- heartbeat
- session register / update / close
- launch / attach / input / interrupt 수신 경로

이 단계가 필요한 이유:

- desktop은 여전히 실행을 맡지만 더 이상 로컬 권위자가 아니게 된다.

### 단계 D. Narre runtime 편입

목표:

- Narre도 같은 supervisor 체계 안에서 first-class agent로 등록한다.

산출:

- Narre session도 unified registry에 편입
- Narre 내부 provider를 backend provider로만 처리
- system agent / user agent 분기 반영

이 단계가 필요한 이유:

- Narre와 terminal agent가 동일한 원격/오케스트레이션 흐름에 들어와야 한다.

### 단계 E. UI 전환

목표:

- desktop renderer와 mobile이 supervisor의 동일한 상태를 보게 한다.

산출:

- unified session list
- unified session detail
- unified event stream

이 단계가 필요한 이유:

- 두 클라이언트가 같은 세션을 서로 다른 방식으로 해석하면 원격 이어받기가 깨진다.

### 단계 F. Remote control 경로 정식화

목표:

- 모바일이 supervisor를 통해 session을 이어받고 작업할 수 있게 한다.

산출:

- attach / resume / approve / send input
- 현재 작업 문맥 조회
- attention 상태 알림

이 단계가 필요한 이유:

- remote control은 supervisor 구조가 완성된 뒤에야 자연스럽게 구현된다.

### 단계 G. Multi-agent orchestration 추가

목표:

- supervisor가 여러 agent session을 동시에 조정할 수 있게 한다.

산출:

- handoff
- task routing
- session fan-out / fan-in
- shared context 전달
- approval aggregation

이 단계가 마지막인 이유:

- orchestration은 그 자체보다 아래 기반 구조를 더 많이 필요로 한다.

## 12. 작업 의존성

작업 의존성은 대략 다음 순서를 가진다.

- 단계 A가 모든 작업의 선행 조건이다.
- 단계 B와 단계 C는 단계 A 이후에 가능하다.
- 단계 D는 단계 A와 단계 B에 의존한다.
- 단계 E는 단계 B, 단계 C, 단계 D의 결과를 필요로 한다.
- 단계 F는 단계 E 이전에도 일부 가능하지만, 안정적인 remote control은 단계 B, C, E 이후가 적절하다.
- 단계 G는 사실상 모든 선행 작업 위에 올라간다.

간단히 쓰면 다음과 같다.

`A -> B -> {C, D} -> E -> F -> G`

## 13. 우선순위

가장 먼저 해야 할 것은 multi-agent 기능 구현이 아니다.

가장 먼저 해야 할 것은 다음 세 가지다.

- supervisor가 될 수 있는 세션 구조 만들기
- desktop executor bridge 만들기
- Narre를 first-class agent로 격상하기

이 세 가지가 정리되면 mobile 원격도 시작할 수 있고, 이후 orchestration도 무리 없이 올라간다.

## 14. 결론

이 전환의 본질은 다음 한 문장으로 요약된다.

`desktop-app`은 실행기이고, `narre-server`는 전체 에이전트 시스템의 supervisor가 되어야 한다.

이 구조가 되어야만 다음이 가능해진다.

- 모바일에서 작업 이어받기
- Narre와 terminal agent의 통합 관리
- system agent / user agent 분리
- preset 기반 책임 분리
- future multi-agent orchestration

즉 지금 필요한 것은 "기존 Narre server에 기능 몇 개를 추가하는 것"이 아니라, Narre server를 전체 agent control plane으로 재정의하는 것이다.
