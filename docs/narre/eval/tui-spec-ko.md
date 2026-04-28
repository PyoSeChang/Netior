# narre-eval TUI 개발 명세

작성일: 2026-04-18  
상태: Draft  
대상: `packages/narre-eval`

## 1. 문서 목적

이 문서는 `narre-eval`의 차기 TUI(Text UI) 개발 방향을 정리한다.

이 TUI의 목적은 “예쁜 터미널 화면”이 아니다.  
핵심 목적은 다음 세 가지다.

- 실행 전에 **tester를 선택**할 수 있어야 한다.
- 실행 후 **Narre-tester transcript를 읽기 좋게 볼 수 있어야 한다.**
- 시나리오와 eval harness를 관리하는 **Codex operator와 채팅**할 수 있어야 한다.

즉 이 TUI는 단순 실행기가 아니라, **eval 운영 콘솔**이어야 한다.

## 2. 핵심 원칙

### 2.1 TUI는 eval core 위에 얹는 운영 표면이다

TUI는 `narre-eval` core를 대체하지 않는다.

- 실행 엔진은 계속 headless / deterministic / spec-driven이어야 한다.
- TUI는 scenario selection, tester selection, artifact browsing, operator chat을 위한 표면이다.
- 실제 run은 항상 명시적 run spec으로 떨어져야 한다.

즉:

- TUI = operator surface
- core = reproducible engine

### 2.2 tester는 Netior power user가 아니다

TUI에서 tester를 선택할 수 있어도, tester의 외부 페르소나는 유지되어야 한다.

- tester는 자기 도메인은 안다
- tester는 Netior 내부 구조는 모른다
- tester는 `network`, `model`, `schema_ref`, `node placement`를 먼저 말하지 않는다

TUI는 이 설정을 바꾸는 UI를 주면 안 된다.

즉 “tester 선택”은 Netior 지식 수준을 올리는 옵션이 아니라,
**응답 전략 / 엄격도 / LLM 구현체 / policy**를 선택하는 표면이어야 한다.

### 2.3 Codex operator는 target Narre와 분리된다

TUI 안에서 Codex와 채팅할 수 있어야 하지만, 그 Codex는 평가 대상 Narre와 다른 역할이다.

- target Narre: 평가 대상
- tester: 상호작용 상대
- operator Codex: scenario/run/harness를 관리하는 운영자

이 셋을 혼동하면 안 된다.

## 3. 사용자 시나리오

### 3.1 run 전 준비

사용자는 TUI에서:

- 어떤 scenario를 돌릴지 고른다
- 어떤 provider를 쓸지 고른다
- 어떤 tester를 쓸지 고른다
- judge를 켤지 정한다
- baseline을 지정한다

그리고 그 선택은 최종적으로 **run spec**으로 저장되어야 한다.

### 3.2 run 후 분석

사용자는 TUI에서:

- transcript를 읽는다
- tool sequence를 본다
- tester가 어떻게 응답했는지 본다
- report를 읽는다
- analyzer finding을 본다

### 3.3 operator Codex와 상의

사용자는 TUI 안에서 Codex에게 다음을 요청할 수 있어야 한다.

- 어떤 scenario를 돌리는 게 좋은지
- 왜 이 run이 실패했는지
- 시나리오를 어떻게 고쳐야 하는지
- harness 규칙을 어떻게 바꿔야 하는지
- 새 scenario 초안을 어떻게 만들지

즉 TUI는 단순 viewer가 아니라 **operator assistant surface**여야 한다.

## 4. TUI 범위

### 4.1 포함

- scenario 목록/검색
- scenario 상세 보기
- tester 선택
- provider 선택
- judge on/off
- run 실행
- run history 보기
- transcript 렌더링
- tester trace 보기
- report 보기
- analyzer finding 보기
- operator Codex 채팅

### 4.2 제외

- Netior 본체 UI 대체
- scenario file 직접 편집기
- live graphical canvas
- realtime streaming watch를 기본 요구사항으로 강제

실시간 streaming은 나중에 optional mode로 둘 수 있지만, 현재 핵심 요구사항은 아니다.

## 5. 정보 구조

TUI는 크게 세 영역으로 나뉜다.

### 5.1 Run Control

역할:

- scenario 선택
- tester 선택
- provider 선택
- run spec 생성
- 실행 시작

### 5.2 Evaluation Reader

역할:

- transcript 보기
- report 보기
- tool/analyzer 보기
- tester trace 보기

### 5.3 Codex Operator Chat

역할:

- 시나리오 관리
- harness 개선 논의
- run 결과 분석
- 다음 액션 제안

## 6. 화면 구조 제안

권장 layout:

```text
+----------------------------------------------------------------------------------+
| Header: project / scenario / provider / tester / judge / run status             |
+-----------------------------+--------------------------------+-------------------+
| Left Pane                   | Center Pane                    | Right Pane        |
| Scenario Explorer           | Transcript / Report Viewer     | Inspector         |
| - scenario list             | - transcript.md                | - tool calls      |
| - filters                   | - report.md                    | - tester trace    |
| - history                   | - result summary               | - findings        |
+-----------------------------+--------------------------------+-------------------+
| Bottom Pane: Codex Operator Chat                                              |
| - prompt input                                                                 |
| - Codex suggestions                                                            |
| - proposed scenario/run/harness actions                                        |
+----------------------------------------------------------------------------------+
```

## 7. 핵심 기능 상세

### 7.1 tester 선택 UI

이건 필수다.

선택 가능 항목 예:

- `codex-tester`
- `approval-sensitive`
- `conversation-tester`

표시해야 할 정보:

- tester id
- 설명
- domain persona 유지 여부
- strictness
- bootstrap contract enforcement 강도

중요한 제약:

- tester 선택이 “Netior를 더 잘 아는 사용자”로 바뀌는 옵션처럼 보여서는 안 된다.
- 설명 문구도 그렇게 쓰면 안 된다.

권장 설명 예:

- `codex-tester`: 도메인만 아는 사용자 페르소나를 유지하면서 LLM이 응답하는 tester
- `approval-sensitive`: 승인/고위험 변경에 더 보수적으로 반응하는 tester

### 7.2 transcript 렌더링

이건 현재 가장 부족한 부분 중 하나다.

TUI transcript는 단순 raw log가 아니라 **읽기 좋은 conversation renderer**여야 한다.

최소 표시 단위:

- User 발화
- Narre 발화
- Tool call
- Tool result 요약
- Card
- Tester 응답
- Stage 구분

권장 섹션:

- `도메인 브리프`
- `인터뷰`
- `제안`
- `승인`
- `생성`
- `최종 요약`

각 transcript item은 다음 메타를 가질 수 있다.

- turn index
- actor (`user`, `narre`, `tester`, `system`)
- block type (`text`, `tool`, `card`, `feedback`)
- stage
- timestamp

### 7.3 Narre-tester transcript 전용 뷰

핵심 요구사항 중 하나는 **Narre와 tester가 어떻게 상호작용했는지**를 읽는 것이다.

그래서 transcript viewer 안에 최소 2가지 모드가 있어야 한다.

- `전체 흐름`
  - user + narre + tester + tool 전부 보기
- `Narre ↔ Tester`
  - 카드와 tester 응답만 추려 보기

이 두 번째가 매우 중요하다.

왜냐하면 bootstrap이나 approval 시나리오에서 핵심은:

- Narre가 언제 인터뷰를 시도했는지
- tester가 그걸 어떻게 받아쳤는지
- tester가 언제 “도메인 수준에서 다시 물어봐라”라고 돌려보냈는지

이걸 보는 것이기 때문이다.

### 7.4 operator Codex 채팅

이건 단순 help 패널이 아니다.

operator Codex는 다음을 해야 한다.

- 현재 시나리오 세트 요약
- 어떤 scenario가 적합한지 제안
- 실패 run 원인 분석
- harness 개선안 제안
- 새 scenario 초안 제안
- run spec 초안 제안

즉 대화 예시는 이런 식이다.

- “bootstrap 평가하려면 어떤 scenario를 먼저 돌리는 게 좋아?”
- “이 run이 실패한 이유를 정리해줘”
- “tester contract를 어떻게 더 엄격하게 해야 해?”
- “이 실패에서 파생된 scenario draft 하나 만들어”

중요한 점:

- 이 채팅은 target Narre transcript와 섞이면 안 된다.
- 별도 operator session으로 분리되어야 한다.

## 8. run spec 연동

TUI의 모든 실행 선택은 결국 run spec으로 물질화돼야 한다.

예:

- scenario = `fantasy-world-bootstrap`
- provider = `codex`
- tester = `codex-tester`
- judge = `true`
- baseline = `latest`

이걸 UI 상태로만 두면 안 되고, 내부적으로는 반드시 run spec으로 저장해야 한다.

즉 TUI의 실행 버튼은 사실상:

1. run spec 생성
2. eval core 호출
3. 결과 artifact 로드

이 흐름이어야 한다.

## 9. Codex operator와 artifact 연결

operator Codex는 아래 artifact를 읽을 수 있어야 한다.

- `result.json`
- `report.md`
- `transcript.md`
- `transcript.json`
- `analysis.json`
- `tester-trace.json`

그리고 operator에게는 이걸 그대로 던지는 게 아니라, 최소한 다음 요약도 같이 주는 게 좋다.

- scenario goal
- execution profile
- pass/fail summary
- key findings
- key transcript excerpt

즉 TUI는 artifact browser이면서, 동시에 **Codex operator context builder** 역할도 해야 한다.

## 10. 상태 모델

TUI 내부 상태는 최소 다음 단위가 필요하다.

### 10.1 Explorer State

- selected scenario
- selected history run
- filters

### 10.2 Run Control State

- selected provider
- selected tester
- judge enabled
- run spec draft
- run status

### 10.3 Reader State

- active tab
  - report
  - transcript
  - narre-tester
  - tools
  - findings
- transcript mode
  - full
  - narre-tester
  - tool-centric

### 10.4 Operator State

- Codex operator session id
- current chat history
- linked run/scenario context

## 11. transcript 렌더링 명세

### 11.1 렌더링 단위

한 항목은 다음 중 하나다.

- `user_message`
- `narre_message`
- `tester_message`
- `tool_call`
- `tool_result`
- `card`
- `finding`
- `stage_marker`

### 11.2 최소 포맷

예:

```text
[도메인 브리프]
사용자: 판타지 소설 프로젝트를 정리하고 싶어...

[인터뷰]
Narre: 어떤 종류의 결과물이 가장 자주 나오나요?
Tester: 캐릭터 시트, 장면 초안, 사건 기록이 많아요.

[제안]
Narre: 우선 인물 / 세계관 / 플롯 / 스토리 네트워크로 나누겠습니다...

[생성]
tool: create_network
result: created "인물"
```

### 11.3 강조 규칙

강조가 필요한 것:

- 첫 `ask`
- 첫 `propose`
- 첫 mutation
- tester의 거절/수정 유도
- analyzer finding이 발생한 지점

즉 transcript는 “순서”가 보여야 한다.

## 12. 구현 단계 제안

### Phase 1. TUI shell

- package scaffold
- layout skeleton
- scenario explorer
- run control form

### Phase 2. Artifact reader

- report viewer
- transcript viewer
- narre-tester transcript mode
- finding inspector

### Phase 3. Run integration

- run spec 생성
- eval core 실행
- latest/history reload

### Phase 4. Operator Codex chat

- Codex operator session
- scenario/run context 주입
- operator suggestion UI

### Phase 5. Bootstrap-focused transcript polish

- stage-aware rendering
- tool-card-tester 묶음 보기
- failure highlight

## 13. acceptance 기준

이 TUI가 최소 성공했다고 말하려면 아래가 가능해야 한다.

1. 사용자가 scenario를 고를 수 있다.
2. 사용자가 tester를 고를 수 있다.
3. 사용자가 run을 실행할 수 있다.
4. 사용자가 `report.md`를 바로 읽을 수 있다.
5. 사용자가 Narre ↔ tester transcript를 별도 모드로 볼 수 있다.
6. 사용자가 Codex operator와 채팅하며 scenario/harness 개선점을 논의할 수 있다.
7. 모든 실행은 내부적으로 run spec으로 재현 가능하다.

## 14. 한 줄 요약

`narre-eval` TUI는 단순 log viewer가 아니라, **tester 선택 + transcript 분석 + Codex operator 채팅을 한곳에서 제공하는 eval 운영 콘솔**이어야 한다.  
그리고 그 위에서 돌아가는 실제 실행은 계속 headless / reproducible / spec-driven core가 맡아야 한다.
