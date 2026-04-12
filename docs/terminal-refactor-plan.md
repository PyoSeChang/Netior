# Terminal Refactor Plan

작성일: 2026-04-12

## 1. Worktree

- Worktree path: `.claude/worktrees/terminal-refactor`
- Branch: `worktree-terminal-refactor`
- Base: `master`의 `HEAD` at `c4528a3`

이 문서는 terminal 대규모 리팩터링을 현재 메인 워크트리의 다른 변경과 분리해서 진행하기 위한 실행 계획 문서다.

## 2. 목표

이번 리팩터링의 목표는 단순히 "VS Code terminal override를 제거한다"가 아니다.

실제 목표는 다음 세 가지다.

1. Netior terminal renderer를 VS Code service override 중심 구조에서 벗어나 더 단순한 자체 소유 구조로 재편한다.
2. 이미 붙어 있는 Netior 전용 기능을 회귀 없이 유지한다.
3. 이후 terminal 기능 추가와 디버깅이 가능한 구조로 계층을 다시 나눈다.

중요한 판단:

- 이번 worktree의 기본 전략은 `Hyper 포크`다.
- 여기서 말하는 포크는 Netior 안에 통합할 수 있는 `Hyper terminal surface` 코드의 실질적 포크를 뜻한다.
- 이 문서는 Hyper를 참고만 하는 계획이 아니라, Hyper 포크를 기준으로 Netior terminal을 재구성하는 계획이다.

### 2.1 이번 작업의 1차 성공 기준

이번 작업이 성공으로 간주되려면 아래가 먼저 충족되어야 한다.

1. `codex`, `claude code`, PowerShell 같은 실제 TUI/CLI에서 커서 위치가 어긋나지 않는다.
2. helper textarea, selection, paste, IME, caret 처리의 ownership이 Netior workaround가 아니라 Hyper 포크 경로 쪽에 있다.
3. 기존 VS Code override 경로에서 생기던 textarea/cursor 계열 문제가 재현되지 않거나 구조적으로 줄어든다.

즉, 이번 작업의 핵심은 terminal 기능 개수를 늘리는 것이 아니라, terminal 입력/렌더링 ownership을 더 안정적인 쪽으로 옮기는 것이다.

### 2.2 Hyper 포크에 대한 입장

이번 worktree의 전제는 `Hyper 포크`다.

즉, 이번 계획은 아래 선택지 중 3번이 아니라 2번을 기본 전략으로 둔다.

1. Hyper 앱 전체를 통째로 포크한다.
2. Hyper의 terminal surface 관련 renderer 코드를 Netior에 맞게 포크/이식한다.
3. Hyper는 참고만 하고 Netior 자체 terminal engine을 처음부터 새로 만든다.

현재 기본 전략은 2번이다.

이 문서에서 말하는 `Hyper 포크`는 "terminal surface를 Netior 안으로 가져와 주 경로로 삼는다"는 뜻이다.

### 2.3 이번 worktree에서 실제로 결정할 것

이번 worktree에서 결정할 것은 "Hyper를 포크할지 말지"가 아니다.

이번 worktree에서 결정할 것은 아래 두 가지다.

1. Hyper에서 어디까지 가져올 것인가
2. 가져온 코드를 Netior 계층 어디까지 유지하고 어디서 어댑트할 것인가

현재 가정은 다음과 같다.

- main / preload / PTY session 계약은 Netior 것을 최대한 유지한다.
- renderer terminal surface는 Hyper 포크를 기준으로 재구성한다.
- Hyper app shell, plugin system, updater, menu system은 직접 이식 대상이 아니다.

즉, 포크 여부는 이미 결정되었고, 남은 문제는 포크 범위와 통합 경계다.

### 2.4 Hyper에서 버릴 것

사용자 목표와 무관한 Hyper 기능은 포크 대상에서 제외한다.

- plugin system
- plugin API
- app-level config system
- updater
- menu integration
- window shell 전반
- Redux/store 구조 전체

필요한 것은 terminal surface이고, Hyper 제품 기능 전체가 아니다.

## 3. 현재 구조 요약

현재 terminal 경로는 크게 세 층으로 나뉜다.

### 3.1 Main / PTY

- `packages/desktop-app/src/main/pty/pty-manager.ts`
- `packages/desktop-app/src/main/ipc/pty-ipc.ts`

이 층은 비교적 단순하다.

- `node-pty`로 프로세스를 띄운다.
- session 단위로 `createInstance`, `attach`, `input`, `resize`, `shutdown`을 제공한다.
- output replay, pid, cwd, title, state를 관리한다.
- agent runtime launch preparation과 cleanup도 이 층과 연결되어 있다.

### 3.2 Preload / IPC bridge

- `packages/desktop-app/src/preload/index.ts`

이 층은 `window.electron.terminal.*` API를 renderer에 노출한다.

### 3.3 Renderer / Terminal engine + feature layer

- `packages/desktop-app/src/renderer/lib/terminal/terminal-services.ts`
- `packages/desktop-app/src/renderer/lib/terminal/terminal-backend.ts`
- `packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx`

문제는 이 층이다.

- `@codingame/monaco-vscode-*` 의존성을 여러 개 물고 있다.
- VS Code terminal service override를 올린 뒤 다시 Netior 쪽에서 우회한다.
- `TerminalEditor.tsx`가 mount, attach, resize, 검색, 링크 처리, 선택 오버레이, 단축키, todo, title sync까지 모두 떠안고 있다.
- VS Code 기본 링크 동작을 끄기 위한 dispose workaround까지 들어가 있다.

## 4. 현재 구조의 문제

### 4.1 엔진과 기능 레이어가 분리되어 있지 않다

Netior 전용 UX가 terminal engine 내부 구현과 뒤엉켜 있다.

예:

- 파일/URL 링크 감지와 오버레이
- pane-aware file open
- Ctrl/Cmd+click 동작
- 검색 UI
- terminal font size 제어
- Shift+PageUp/Down 스크롤
- todo 패널
- agent 상태/알림 연동

이 상태에서는 엔진만 바꾸는 작업이 불가능하고, 매번 기능 회귀 위험을 같이 진다.

### 4.2 의존성 대비 실익이 낮다

현재 구조는 terminal 하나 때문에 다음 계열 의존성을 끌고 온다.

- `@codingame/monaco-vscode-api`
- `@codingame/monaco-vscode-configuration-service-override`
- `@codingame/monaco-vscode-terminal-service-override`
- `@codingame/monaco-vscode-theme-service-override`

하지만 실제로 필요한 것은 VS Code workbench 전체가 아니라 PTY-backed terminal viewport와 일부 UX 기능뿐이다.

### 4.3 버그 책임 경계가 흐리다

문제가 발생했을 때 아래 셋이 섞인다.

- xterm 자체 문제
- VS Code terminal override 계층 문제
- Netior의 DOM patch / workaround 문제

이 구조에서는 입력, selection, caret, link handling 관련 버그를 빠르게 단정하기 어렵다.

## 5. 회귀 금지 계약

이 리팩터링은 terminal 렌더러 교체 작업이지만, 사용자 관점에서는 아래 기능이 그대로 유지되어야 한다.

### 5.1 세션 계약

- terminal tab 생성 방식 유지
- `TerminalLaunchConfig` 계약 유지
- `TerminalSessionInfo` 계약 유지
- 기존 `window.electron.terminal.*` IPC surface는 초반 단계에서 유지
- output replay 유지
- detached window에서 기존 session attach 가능해야 함

### 5.2 링크/오버레이 UX

- URL 감지
- 파일 경로 감지
- 선택 텍스트 기반 액션 오버레이
- Ctrl/Cmd+click으로 링크 열기
- 파일 열기 시 `smart`, `right`, `below`, 특정 pane 열기 유지
- URL open / file open / clipboard copy 유지

### 5.3 단축키 UX

- `Ctrl/Cmd+F` 검색
- `Ctrl/Cmd+C` selection copy
- selection이 없을 때 shell 쪽 `SIGINT` 동작 유지
- `Ctrl/Cmd+V` paste
- `Ctrl/Cmd+=`, `Ctrl/Cmd+-`, `Ctrl/Cmd+0` 폰트 크기 제어
- `Shift+PageUp`, `Shift+PageDown` 페이지 스크롤

### 5.4 editor/workspace 연동

- tab rename
- tab context menu에서 todo 표시 토글
- tab kill
- open terminal shortcut
- detached host에서 terminal open / reattach / tab cycle 유지

### 5.5 agent 연동

- terminal launch 시 agent provider config 전달
- Claude/Codex terminal naming 유지
- attention/completion toast 유지
- `Ctrl/Cmd+.` jump-to-agent 유지

### 5.6 보조 UI

- `TerminalSearchBar`
- `TerminalTodoPanel`
- theme token 반영
- 기존 editor surface 안에서의 attach error 표시

## 6. 비목표

이번 작업에서 하지 않는 것:

- Hyper 포크 여부를 다시 선택지로 돌리는 것
- terminal 탭 정보 구조 전체 교체
- main PTY 백엔드의 전면 재설계
- shell integration 프로토콜 자체를 새로 정의하는 일
- terminal UI를 완전히 새로운 제품처럼 재디자인하는 일

즉, 이번 작업의 본질은 "새 terminal 앱 만들기"가 아니라 "Netior 안의 terminal engine과 기능 경계를 다시 세우는 것"이다.

## 7. 목표 구조

목표 구조는 아래와 같다.

### 7.1 Session layer

역할:

- preload IPC 호출
- session attach/shutdown
- data/ready/title/state 이벤트 구독
- session metadata 동기화

후보 파일:

- `packages/desktop-app/src/renderer/lib/terminal/session-client.ts`

### 7.2 Engine layer

역할:

- 실제 xterm instance 생성/파기
- container mount/unmount
- write, resize, focus, selection, search API 제공
- renderer addon 구성

후보 파일:

- `packages/desktop-app/src/renderer/lib/terminal/engine/terminal-engine.ts`
- `packages/desktop-app/src/renderer/lib/terminal/engine/native-xterm-engine.ts`

여기서 "native"는 Netior가 직접 소유하는 xterm 경로를 뜻한다.

### 7.3 Feature adapter layer

역할:

- 링크 파싱
- overlay 위치 계산
- terminal-specific keyboard handling
- pane-aware file open
- font size state
- search UI adapter

후보 파일:

- `packages/desktop-app/src/renderer/lib/terminal/terminal-link-controller.ts`
- `packages/desktop-app/src/renderer/lib/terminal/terminal-keyboard-controller.ts`
- `packages/desktop-app/src/renderer/lib/terminal/terminal-theme.ts`

### 7.4 UI layer

역할:

- terminal viewport container 렌더링
- action overlay 렌더링
- search bar / todo panel 배치
- attach error 표시

후보 파일:

- `packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/terminal/TerminalViewport.tsx`
- `packages/desktop-app/src/renderer/components/editor/terminal/TerminalActionOverlay.tsx`

핵심 원칙:

- `TerminalEditor`는 더 이상 terminal engine의 세부 구현을 직접 알지 않는다.
- 링크 처리와 shortcut 처리는 xterm implementation 세부사항과 분리한다.
- 나중에 engine을 바꿔도 feature layer는 유지되어야 한다.

## 8. 단계별 실행 계획

전체 작업은 5개 milestone으로 나눈다.

### Milestone A. 계약 고정

목표:

- 지금 terminal이 제공하는 기능을 명시적인 계약으로 고정한다.

작업:

- 현재 기능 목록을 문서 기준으로 확정
- manual verification checklist 작성
- 없는 테스트 중 최소한의 parser/shortcut 테스트 보강 포인트 식별

완료 기준:

- "무엇이 회귀인지"가 명확하다
- 리팩터링 중 논쟁 없이 비교할 기준이 생긴다

### Milestone B. Hyper Fork Baseline

목표:

- Hyper terminal surface를 Netior renderer 안에서 컴파일 가능한 기준선으로 가져온다.

작업:

- Hyper 소스에서 실제 포크 대상 모듈을 식별
- renderer terminal surface 관련 파일을 Netior 경로로 가져오기
- Netior build 환경에 맞게 import/path/runtime 의존성 정리
- Hyper 쪽 terminal mount path를 Netior terminal tab 내부에서 띄울 수 있게 최소 어댑트

완료 기준:

- Hyper 포크 기반 terminal viewport가 Netior renderer 안에서 뜬다
- 아직 모든 기능이 붙지 않아도, 포크 baseline이 독립적으로 존재한다

### Milestone C. Netior Integration Layer

목표:

- Hyper 포크 코드와 Netior session/editor 기능을 연결하는 어댑터 계층을 만든다.

작업:

- session-client 연결
- PTY attach/write/resize/shutdown 연결
- theme/font size 전달
- title/cwd/state sync
- detached attach 경로 연결
- 기존 `TerminalEditor`의 Netior 전용 기능을 engine 외부 계층으로 분리

완료 기준:

- Hyper 포크 기반 terminal이 Netior 세션 계약으로 실제 동작한다
- Netior 전용 기능이 Hyper 내부 구현과 직접 뒤엉키지 않는다

### Milestone D. 기능 parity 확보

목표:

- Hyper 포크 기반 terminal이 기존 UX와 동일하게 느껴질 때까지 맞춘다.

작업:

- 링크 좌표 매핑
- Ctrl/Cmd+click open
- 선택 텍스트 오버레이
- 검색 UX
- page scroll
- detached attach
- agent terminal naming/title sync
- paste / copy / interrupt 경계 정리

완료 기준:

- manual checklist 기준으로 주요 사용 흐름이 기존과 같거나 더 낫다
- Codex / Claude Code / PowerShell 케이스에서 치명적 회귀가 없다

### Milestone E. VS Code 경로 제거

목표:

- Hyper 포크 기반 terminal을 기본값으로 전환하고 불필요한 의존성을 제거한다.

작업:

- feature flag 기본값 전환
- `@codingame/monaco-vscode-*` 제거
- 관련 bootstrap/override 코드 제거
- 상태 문서 업데이트

완료 기준:

- renderer에서 VS Code terminal override 경로가 완전히 사라진다
- terminal 기능은 유지된다

## 9. 우선순위 높은 파일

초기 수정 우선순위는 아래 순서로 잡는다.

1. `packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx`
2. `packages/desktop-app/src/renderer/lib/terminal/terminal-services.ts`
3. `packages/desktop-app/src/renderer/lib/terminal/terminal-backend.ts`
4. `packages/desktop-app/src/renderer/components/editor/TerminalSearchBar.tsx`
5. `packages/desktop-app/src/renderer/lib/terminal/terminal-link-parser.ts`
6. `packages/desktop-app/src/renderer/lib/terminal/open-terminal-tab.ts`
7. `packages/desktop-app/src/renderer/shortcuts/useGlobalShortcuts.ts`
8. `packages/desktop-app/src/renderer/shortcuts/useDetachedShortcuts.ts`

main/preload는 초반에 최대한 건드리지 않는다.

## 10. 검증 계획

### 10.1 수동 검증 시나리오

최소한 아래 케이스는 직접 확인해야 한다.

1. 일반 PowerShell tab 생성, 입력, 종료
2. `codex --no-alt-screen` 실행 후 입력/selection/caret
3. Claude terminal launch 후 session name, 상태 알림
4. 긴 출력 후 scroll, page scroll, resize
5. 파일 경로 클릭과 URL 클릭
6. 선택 텍스트 오버레이에서 file/url open
7. split pane 상태에서 `right`, `below`, 특정 pane 열기
8. detached window attach 후 기존 output replay
9. tab rename, kill, reopen
10. todo panel on/off, pin 상태

### 10.2 자동 검증 후보

- `terminal-link-parser` 테스트 확대
- terminal shortcut 처리 테스트 추가
- overlay 상태 계산 로직 단위 테스트
- pane-aware file open 분기 테스트

## 11. 주요 리스크와 대응

### 11.1 링크 좌표 오차

리스크:

- xterm row wrapping과 selection 모델 때문에 클릭 열 위치가 어긋날 수 있다.

대응:

- 링크 파싱 로직은 현재 규칙을 유지
- 엔진 레이어는 "현재 포인터 아래 텍스트 범위"를 최대한 정확히 노출
- exact match 실패 시 fallback 규칙을 명시적으로 유지

### 11.2 copy와 SIGINT 경계

리스크:

- `Ctrl/Cmd+C`가 selection copy인지 shell interrupt인지 케이스가 엇갈릴 수 있다.

대응:

- selection 유무 판정 규칙을 engine API로 고정
- parity 확인 전까지는 현재 shortcut semantics를 변경하지 않는다

### 11.3 검색 API 차이

리스크:

- VS Code 경로에서 쓰던 검색 인터페이스와 direct xterm addon 인터페이스가 다를 수 있다.

대응:

- `TerminalSearchBar`가 engine abstract search API만 보도록 바꾼다

### 11.4 detached lifecycle

리스크:

- detached window attach/replay 시 mount timing race가 다시 생길 수 있다.

대응:

- session-client에 replay/attach 순서를 명시적으로 둔다
- editor detach/reattach 시나리오를 별도 체크리스트로 검증한다

## 12. 의존성 전략

초기에는 공존, 마지막에 제거 전략으로 간다.

### 리팩터링 초반에 유지

- `node-pty`
- `@xterm/xterm`
- `@xterm/addon-fit`
- `@xterm/addon-web-links`
- 필요 시 search/webgl 관련 xterm addon

### 최종 제거 대상

- `@codingame/monaco-vscode-api`
- `@codingame/monaco-vscode-configuration-service-override`
- `@codingame/monaco-vscode-terminal-service-override`
- `@codingame/monaco-vscode-theme-service-override`

주의:

- 의존성 제거는 Hyper 포크 기반 terminal을 기본값으로 전환한 뒤 마지막 단계에서만 한다.
- 제거를 먼저 하면 회귀 원인을 분리할 수 없다.

## 13. Immediate Next Steps

바로 다음 작업은 아래 순서로 진행한다.

1. Hyper 포크 대상 renderer 파일과 의존성 범위를 확정한다.
2. Netior renderer 안에서 Hyper terminal baseline을 띄운다.
3. `TerminalEditor.tsx`의 Netior 전용 기능을 engine 외부 계층으로 분리한다.
4. Hyper 포크 terminal과 Netior session/editor 계층을 연결한다.
5. parity를 맞춘 뒤 VS Code 경로를 제거한다.

## 14. 문서 관계

- `DESIGN-vscode-terminal-replacement.md`는 VS Code 방향의 기존 설계 기록으로 유지한다.
- 이 문서는 실제 실행 기준 문서다.
- 이후 진행 상황은 필요 시 `TERMINAL-REPLACEMENT-STATUS.md`에 별도로 반영한다.
