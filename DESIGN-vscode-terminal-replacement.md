# VS Code OSS Terminal Replacement

> MoC 데스크탑 앱의 현재 터미널 구현을 제거하고, VS Code OSS 터미널 스택을 최대한 그대로 재사용하기 위한 설계 문서.
> 목표는 `codex`, `claude code` 같은 TUI/CLI에서 발생하는 커서 위치 이상, 입력 불일치, selection/caret 꼬임 문제를 구조적으로 제거하는 것이다.

---

## 1. 결론

MoC의 현재 터미널은 `node-pty + xterm` 조합 자체가 문제라기보다, 그 위에 얹은 **직접 제어 래퍼**가 문제다.

현재 구현은:

- renderer에서 `Terminal` 인스턴스를 직접 생성한다
- helper textarea, paste, resize, WebGL fallback, focus를 직접 다룬다
- DOM patch와 CSS override로 동작을 맞추려 한다

이 구조는 일반 셸에서는 버틸 수 있어도, `codex`, `claude code`처럼 입력기/커서/selection을 민감하게 쓰는 TUI에서 쉽게 깨진다.

따라서 방향은 "현재 코드를 조금씩 고친다"가 아니라:

- **현재 `TerminalEditor.tsx` 기반 구현은 폐기**
- **VS Code OSS의 terminal host/service 계층을 renderer에 도입**
- **PTY 연결도 VS Code가 기대하는 세션/프로세스 모델에 맞춰 재정의**

으로 고정한다.

---

## 2. 대표 Use Case

### Use Case 1. Codex CLI 입력

사용자는 터미널 탭을 연다. `codex`를 실행한다. 입력 중 커서가 실제 문자 위치와 일치해야 한다. 줄 중간 이동, backspace, multiline 입력, selection, paste가 모두 정상이어야 한다.

### Use Case 2. Claude Code 입력

사용자는 `claude` 또는 `claude code`를 실행한다. 내부 TUI가 그리는 커서, 선택 상태, 반전 색상, 입력 포커스가 터미널 표면과 정확히 일치해야 한다. 숨겨진 textarea가 별도 커서를 노출하거나, caret가 화면 다른 위치에 나타나면 안 된다.

### Use Case 3. 일반 PowerShell / cmd / long-running process

사용자는 일반 명령을 실행하고, 출력이 길어져도 스크롤/리사이즈/복사/링크 클릭이 안정적으로 동작해야 한다. 프로세스 종료 후 상태가 정상 반영되어야 하고, 탭 닫기 시 종료 확인도 일관돼야 한다.

---

## 3. 시각 구조

터미널 탭의 화면은 지금처럼 "빈 div 안에 xterm 렌더러를 여는 구조"로 보이더라도, 제어 책임은 달라진다.

### 화면 구조

1. 상단 탭/도킹 UI는 기존 editor 시스템을 유지한다.
2. 터미널 본문은 VS Code OSS terminal host가 소유하는 단일 viewport로 렌더링한다.
3. 스크롤바, selection, cursor, IME/focus helper, link hover는 host가 관리한다.
4. MoC는 바깥 컨테이너 크기와 theme token만 제공한다.

### 고정 영역

- 기존 Editor 탭 프레임
- Close confirm dialog
- Activity bar / editor dock 구조

### 교체 영역

- 현재 `TerminalEditor.tsx`의 xterm 직접 생성/제어 로직
- helper textarea DOM patch
- paste intercept
- resize debounce 로직의 직접 구현
- terminal-specific CSS 응급처치

---

## 4. 상호작용 정의

아래 상호작용은 "우리가 직접 구현"이 아니라 "VS Code OSS 터미널 host가 기본 제공하는 동작"을 우선으로 한다.

| 입력 | 동작 | 비고 |
|---|---|---|
| 좌클릭 | 포커스 이동, 커서 위치 반영 | host 기본 동작 사용 |
| 드래그 | 텍스트 selection | host 기본 동작 사용 |
| 휠 | 스크롤 | host 기본 동작 사용 |
| Ctrl+C | selection이 있으면 copy, 없으면 PTY에 SIGINT/ETX 전달 | VS Code 기본 규칙에 맞춤 |
| Ctrl+V | paste | renderer에서 별도 paste handler 금지 |
| 우클릭 | context menu 또는 paste 메뉴 | 1차는 기본 동작, 커스텀 최소화 |
| 창 resize | terminal viewport 재측정 및 PTY resize 전달 | host/service가 소유 |
| 탭 전환 | 세션 유지, focus만 이동 | 재생성 금지 |
| 탭 닫기 | 실행 중 프로세스면 경고 후 종료 여부 확인 | 기존 UX 유지 |
| 링크 클릭 | URL open | host link provider 사용 |
| IME 입력 | 조합 중 커서/후보창 위치 정확 | helper textarea 직접 수정 금지 |

### 금지 사항

- `.xterm-helper-textarea` 직접 style 수정 금지
- `.xterm-scrollbar` 직접 style 강제 금지
- paste 이벤트 capture로 가로채기 금지
- `terminal.attachCustomKeyEventHandler`로 광범위한 키 재정의 금지

이 네 가지를 다시 허용하면 같은 종류의 버그가 반복된다.

---

## 5. 데이터 및 제어 흐름

현재는 단순하다.

`TerminalEditor` -> preload `window.electron.terminal.*` -> main `ptyManager` -> `node-pty`

교체 후는 다음처럼 바뀐다.

`TerminalTab` -> VS Code OSS Terminal Host -> Terminal Instance Service -> Backend Process Manager -> `node-pty` 또는 VS Code 호환 PTY backend

핵심은 **renderer가 xterm을 직접 만지지 않는 것**이다.

### Renderer 책임

- 터미널 host를 mount/unmount
- theme/폰트/컨테이너 크기 전달
- editor 탭 생명주기와 연결

### Host/Service 책임

- xterm 인스턴스 생성
- helper textarea, selection, scroll, accessibility
- focus/clipboard/link provider
- resize 측정과 viewport 갱신
- terminal instance 상태 관리

### Main 책임

- PTY 프로세스 spawn/kill/resize/write
- 세션 수명주기 관리
- 종료 이벤트 전달

### Preload 책임

- terminal backend bridge 노출
- host가 기대하는 형태의 IPC API 제공

---

## 6. 왜 PTY도 같이 재정의하는가

이번 선택은 "2번", 즉 VS Code OSS 터미널 스택 전체에 최대한 맞추는 방향이다. 따라서 단순히 renderer만 교체하지 않고 PTY 계층도 **VS Code가 기대하는 프로세스 추상화에 맞게 다시 감싼다**.

이유는 세 가지다.

1. 현재 IPC는 `spawn/input/resize/kill/output/exit` 수준의 얇은 채널이고, 세션/프로세스/상태 모델이 빈약하다.
2. VS Code terminal 계층은 프로세스 상태, title, shell launch config, reconnect 가능성, capabilities 같은 메타를 가정한다.
3. renderer만 바꾸고 backend는 그대로 두면 "겉은 VS Code, 속은 임시 브리지"가 되어 다시 glue code가 늘어난다.

즉 backend를 "버린다"기보다, `node-pty`를 직접 호출하는 현재 `ptyManager`를 **VS Code 호환 terminal backend service**로 교체한다.

### 유지하는 것

- Windows에서는 여전히 ConPTY 사용
- 실제 셸 프로세스 spawn은 계속 `node-pty` 기반일 가능성이 높음

### 버리는 것

- 현재 `sessionId` 중심 단순 registry
- 단발성 IPC 이벤트 명세
- renderer가 가정하는 수동 spawn 타이밍

---

## 7. 구현 경계

### 남기는 것

- `EditorTabType`의 `'terminal'`
- Activity bar / tab context menu에서 terminal tab 열기
- 실행 중 프로세스 종료 확인 UX
- detached editor와 editor store의 큰 구조

### 제거 또는 대체하는 것

- [`TerminalEditor.tsx`](/C:/PyoSeChang/projects/moc/packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx)
- [`pty-manager.ts`](/C:/PyoSeChang/projects/moc/packages/desktop-app/src/main/pty/pty-manager.ts)
- [`pty-ipc.ts`](/C:/PyoSeChang/projects/moc/packages/desktop-app/src/main/ipc/pty-ipc.ts)의 단순 이벤트 계약
- preload의 `window.electron.terminal` 직접 제어 API

### 새로 생기는 층

- renderer: `vscode-terminal-host/`
- main: `terminal-backend-service/`
- preload: VS Code host 친화적인 terminal bridge
- optional shared types: terminal session/process state contracts

---

## 8. 구체 설계

### 8-1. Renderer

새 renderer 계층의 최종 공개 이름은 `TerminalEditor`로 유지하고, 내부 구현만 VS Code 기반으로 교체한다.

이 컴포넌트는:

- DOM container만 제공
- host bootstrap/init 호출
- theme/font/config 전달
- editor 탭 lifecycle에 맞춰 attach/detach

만 한다.

여기서 xterm 인스턴스를 직접 `new Terminal(...)` 하지 않는다.

### 8-2. Host Layer

host layer는 VS Code OSS의 terminal widget/instance/service 코드를 가져와 MoC에 맞게 최소 어댑터만 둔다.

필수 어댑터:

- configuration service
- theme service
- clipboard service
- opener service
- lifecycle/disposable utilities
- layout service
- instantiation/service container

이 계층이 무겁더라도 감수한다. 이번 목표는 코드량 최소화가 아니라 입력 안정성이다.

### 8-3. Backend Layer

main process에 terminal backend service를 둔다.

이 서비스는:

- launch config 기반으로 shell spawn
- processId / title / cwd / state 관리
- input/write/resize/kill
- onData / onExit / onReady / onTitleChange 이벤트 제공

을 담당한다.

단순히 문자열만 흘리는 것이 아니라, "프로세스 객체"를 가진다.

### 8-4. IPC 계약

현재의 IPC 계약은 너무 낮은 수준이다.

새 계약은 예를 들어 아래 형태를 가진다.

- `terminal:createInstance`
- `terminal:attach`
- `terminal:input`
- `terminal:resize`
- `terminal:shutdown`
- `terminal:onData`
- `terminal:onExit`
- `terminal:onReady`
- `terminal:onTitleChanged`

필요하면 이후 persistence/reconnect도 붙일 수 있게 여지를 둔다.

---

## 9. 테마와 스타일 방침

MoC의 semantic token 시스템은 유지한다. 단, terminal 내부 DOM을 CSS로 맞추려 하지 않는다.

허용:

- host configuration에 theme colors 공급
- terminal container 바깥 여백/배경 지정
- font family, font size, cursor blink 같은 public config 전달

비허용:

- 내부 textarea/scrollbar selector override
- z-index 응급처치
- focus ring/caret를 CSS로 조정

터미널 내부는 VS Code OSS의 제어 영역으로 본다.

---

## 10. Edge Case

### 빈 프로젝트 또는 cwd 없음

terminal tab을 열 때 프로젝트 디렉터리 또는 module dir이 없으면 spawn하지 않고, 명시적 오류 상태를 보여준다.

### detached editor

detached 상태에서도 terminal instance를 새로 만들지 않고 attach만 바꿔야 한다. 같은 세션을 여러 번 spawn하면 안 된다.

### 프로세스 종료 후 탭 유지

프로세스가 끝나도 버퍼는 유지되고, 탭은 즉시 닫히지 않는다.

### 빠른 탭 전환

탭 전환 중 focus race로 helper textarea가 꼬이지 않아야 한다. host attach/detach 모델을 사용한다.

### 창 리사이즈 연속 발생

renderer의 debounce 땜질이 아니라 host/service가 최종 크기를 기준으로 PTY resize를 안정적으로 보낸다.

### IME 입력

한글/일본어/중국어 조합 중 caret와 후보창 위치가 정확해야 한다. 이 부분은 수동 DOM 패치 금지 원칙을 가장 엄격하게 적용한다.

### 접근성 모드

screen reader 지원까지 1차 목표는 아니지만, host가 제공하는 접근성 동작을 깨지 않게 유지한다.

---

## 11. 단계별 마이그레이션

### Phase 1. 설계 확정 및 의존성 조사

- VS Code OSS에서 가져올 terminal 관련 모듈 범위 확정
- Electron renderer에서 필요한 service adapter 목록 확정
- 라이선스/번들링/빌드 영향 점검

### Phase 2. Backend service 치환

- 현재 `ptyManager`를 terminal backend service로 교체
- richer process lifecycle 이벤트 추가
- preload bridge 초안 작성

### Phase 3. Renderer host 도입

- 현재 `TerminalEditor`를 제거
- VS Code host 기반 editor 컴포넌트 추가
- 단일 terminal instance attach/detach 검증

### Phase 4. 기존 editor 시스템 통합

- 탭 열기/닫기/분리/재부착 연결
- close confirm과 process running state 연결
- title/state 동기화

### Phase 5. 안정화

- `codex`, `claude code`, PowerShell, `git` interactive-ish flows 검증
- IME, paste, selection, resize, theme 검증
- 기존 DOM/CSS hack 완전 제거

---

## 12. 검증 기준

다음이 만족되지 않으면 완료로 보지 않는다.

1. `codex` 실행 중 입력 caret가 실제 문자 위치와 항상 일치한다.
2. `claude code` 실행 중 이중 커서, 잘못된 selection, 화면 밖 caret가 발생하지 않는다.
3. Ctrl+C, Ctrl+V, 마우스 selection, 우클릭 paste가 VS Code 터미널과 같은 체감으로 동작한다.
4. 창 resize와 editor split resize 후 프롬프트 redraw가 깨지지 않는다.
5. detached editor와 재부착 후에도 세션이 유지된다.
6. 기존 `TerminalEditor.tsx`의 DOM patch 코드가 완전히 제거된다.

---

## 13. 이번 결정에서 포기하는 것

- 빠른 임시 수정
- 최소 변경
- 직접 제어 가능한 단순 코드

대신 얻는 것은:

- CLI/TUI 입력 안정성
- CSS 땜질 종료
- 이후 terminal feature 추가 시 재사용 가능한 구조

---

## 14. 최종 결정

이번 작업은 "xterm 옵션 조정"이 아니다.

이번 작업은:

- **현재 터미널 렌더러 폐기**
- **VS Code OSS terminal host/service 도입**
- **backend IPC도 그 모델에 맞게 재정의**

로 진행한다.

이 설계 기준이 승인되면, 다음 단계는 VS Code OSS에서 실제로 가져올 최소 모듈 집합과 파일 생성 계획을 확정한 뒤 구현에 들어간다.
