# narre-eval TUI 가이드

작성일: 2026-04-18  
대상: `packages/narre-eval`

## 1. 목적

`narre-eval` TUI는 단순한 실행기가 아니라, 다음 세 가지를 한 화면에서 다루기 위한 운영 콘솔이다.

- 어떤 시나리오를 어떤 `provider / tester / judge` 조합으로 실행할지 선택
- Narre 실행 결과와 `Narre ↔ tester` 상호작용을 읽기 좋게 확인
- Codex operator와 대화하면서 시나리오, 하네스, 패치 초안을 만들고 적용

핵심 전제는 이렇다.

- 실행 엔진은 여전히 `narre-eval` core다.
- TUI는 그 위에 얹힌 operator surface다.
- tester는 Netior 내부 구조를 아는 power user가 아니라, **도메인만 아는 사용자 페르소나**를 유지한다.

## 2. 실행

개발 모드:

```powershell
pnpm --filter @netior/narre-eval tui:dev
```

빌드 후 실행:

```powershell
pnpm --filter @netior/narre-eval tui
```

## 3. 화면 구성

TUI는 기본적으로 세 영역으로 구성된다.

- 왼쪽: `Scenarios`
- 가운데: `Runs`
- 오른쪽: `Content`

현재 포커스된 pane은 제목의 `[ACTIVE]`로 표시된다.

## 4. 기본 조작

- `←`, `→`, `Tab`: pane 이동
- `↑`, `↓`: 현재 pane 안에서 선택 이동
- `PageUp`, `PageDown`, `Home`, `End`: 오른쪽 content 스크롤
- `1`: `summary`
- `2`: `report`
- `3`: `transcript`
- `4`: `narreTester`
- `5`: `findings`
- `6`: `scenario`
- `7`: `operator`
- `e`: 현재 시나리오를 현재 설정으로 실행
- `t`: tester 선택
- `p`: provider 선택
- `j`: judge on/off
- `i`: operator 인라인 입력 시작
- `r`: 새로고침
- `q`: 종료

## 5. 뷰 설명

### `summary`

현재 선택된 시나리오와 run에 대해:

- 상태
- verify 통과 수
- judge 평균
- tool call 수
- tester interaction 수
- analyzer finding
- 실패한 verify 항목

을 요약해서 보여준다.

### `report`

해당 run의 `report.md`를 그대로 보여준다.

### `transcript`

사람이 읽기 좋게 압축된 `transcript.md`를 보여준다.

### `narreTester`

`transcript.json`을 바탕으로 `Narre ↔ tester` 상호작용만 추려 보여준다.

특히 bootstrap류 시나리오에서:

- 인터뷰가 있었는지
- proposal이 있었는지
- approval 이후에 생성으로 넘어갔는지

를 확인하기 좋다.

### `findings`

tool-use analyzer finding과 failed verify를 같이 보여준다.

### `scenario`

선택된 시나리오의:

- lifecycle
- type
- labels
- execution profile
- verify 목록
- rubric 목록

을 보여준다.

### `operator`

TUI의 핵심 뷰다.

여기서:

- Codex operator와 대화
- 현재 run 요약 확인
- generated artifact 목록 확인
- patch/diff 초안 preview
- apply candidate 지정
- patch 검증 및 적용

을 한다.

## 6. Tester / Provider / Judge

### Tester

현재 TUI에서 선택 가능한 tester:

- `codex-tester`
- `approval-sensitive`
- `conversation-tester`
- `card-responder`
- `basic-turn-runner`

중요한 점:

- tester를 고른다고 해서 “Netior를 잘 아는 사용자”로 바뀌는 것이 아니다.
- tester는 여전히 **도메인만 알고 Netior 내부 개념은 모르는 사용자**라는 전제를 유지한다.

### Provider

선택 가능한 provider:

- `codex`
- `claude`
- `openai`

### Judge

- `j`로 on/off
- judge를 끄면 deterministic verify + analyzer 중심으로 본다.
- judge를 켜면 LLM 평가까지 수행한다.

## 7. Eval 실행

`e`를 누르면 현재 선택 상태를 바탕으로 임시 `run spec`을 만든 뒤 기존 `narre-eval` CLI를 호출한다.

실행 중 반영되는 항목:

- 선택된 scenario
- 선택된 provider
- 선택된 tester
- judge on/off

실행이 끝나면:

- `runs/latest`
- `runs/history/<run-id>`

가 갱신되고, TUI에서 바로 다시 읽을 수 있다.

## 8. Operator 채팅

### 입력 방식

- `7`로 `operator` 뷰로 이동
- `i`로 compose mode 시작
- `Enter` 전송
- `Esc` 취소
- `Backspace` 삭제
- `Ctrl+U` 전체 삭제

### 세션

operator는 단순 일회성 질의기가 아니다.

- 각 `scenario + run` selection마다 `Codex thread id`를 저장
- 다음 질문은 `codex exec resume`로 이어서 보냄

즉 같은 selection 안에서는 대화 세션이 이어진다.

저장 파일:

- `operator-history.json`
- `operator-session.json`

위치:

- `packages/narre-eval/runs/<run>/scenarios/<scenario>/`

### Operator 로컬 명령

- `/help`
- `/runs`
- `/select-run <latest|index|label>`
- `/generated`
- `/open-generated <index|name>`
- `/validate-generated <index|name>`
- `/candidate-generated <index|name>`
- `/apply-generated <index|name>`
- `/apply-candidate`
- `/rerun`
- `/view <summary|report|transcript|narre|findings|scenario|operator>`
- `/tester <id>`
- `/provider <id>`
- `/judge on|off`
- `/new-session`
- `/draft-scenario-patch [name]`
- `/draft-scenario-diff [name]`
- `/draft-harness-patch [name]`
- `/draft-harness-diff [name]`
- `/save-note [name]`
- `/clear`

## 9. Generated Artifact 흐름

operator는 대화만 하는 게 아니라 산출물을 만든다.

### 생성 가능한 산출물

- 시나리오 패치 초안 `.md`
- 시나리오 unified diff 초안 `.patch`
- 하네스 패치 초안 `.md`
- 하네스 unified diff 초안 `.patch`
- operator note `.md`

### 저장 위치

시나리오 범위:

- `packages/narre-eval/scenarios/<scenario>/results/latest/`

run 범위:

- `packages/narre-eval/runs/<run>/scenarios/<scenario>/`

### 확인 흐름

1. `/generated`
2. `/open-generated 1`
3. 필요하면 `/validate-generated 1`
4. 필요하면 `/candidate-generated 1`
5. 필요하면 `/apply-candidate`

## 10. Patch 적용

`.patch` 파일에 대해서는 TUI 안에서 바로 검증/적용 가능하다.

### 검증

```text
/validate-generated <index|name>
```

내부적으로:

```text
git apply --check <patch>
```

를 사용한다.

### 적용

```text
/apply-generated <index|name>
```

또는

```text
/apply-candidate
```

내부적으로:

1. `git apply --check`
2. 통과 시 `git apply`

순서로 동작한다.

즉, 검증에 실패하면 바로 적용하지 않는다.

## 11. Workspace Status

operator 뷰에는 현재 워크트리 상태도 같이 표시된다.

기준:

```text
git status --short
```

다음 시점에 자동 갱신된다.

- TUI 시작 시
- `r` 새로고침
- `/apply-generated`
- `/apply-candidate`
- `/rerun`

이 덕분에 patch 적용 후 어떤 파일이 dirty 상태가 되었는지 바로 볼 수 있다.

## 12. 현재 구현 범위

지금 TUI는 다음까지 구현되어 있다.

- scenario / run 탐색
- tester / provider / judge 제어
- eval 실행
- report / transcript / Narre-tester transcript / findings 읽기
- Codex operator 인라인 채팅
- operator session reuse
- generated artifact 생성
- generated artifact preview
- generated patch 검증
- generated patch 적용
- workspace status 확인

## 13. 아직 남아 있는 것

아직 남은 것은 주로 UX 보강이다.

- generated artifact 전용 독립 뷰
- apply 후 관련 파일 diff를 더 보기 좋게 요약
- operator가 만든 patch를 다시 Codex에게 review시키는 루프
- fullscreen pane UI를 더 정교하게 다듬기

즉 지금은 **기능은 꽤 많이 들어갔고, 남은 건 주로 사용성 polish**다.
