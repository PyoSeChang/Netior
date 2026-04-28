# Agent Supervisor와 Skill 통합 개발 계획

## 목적

Netior의 agent 시스템을 하나의 control plane 아래에 둔다.

이번 계획의 핵심은 단순한 세션 목록 통합이 아니다. 목표는 다음 세 가지를 함께 정리하는 것이다.

1. Agent taxonomy를 명확히 한다.
2. 기존 command 개념을 skill로 완전히 대체한다.
3. Narre, Codex CLI, Claude Code 세션을 supervisor가 관측하고 이후 조정할 수 있게 한다.

초기 구현은 orchestration 완성이 아니라 기반 구조 확립이다.

## 1. Agent Taxonomy

최상위 분기는 `NarreAgent`와 `TerminalAgent`다.

```text
Agent
├─ NarreAgent
│  ├─ SystemAgent
│  │  ├─ NetworkBuilder
│  │  ├─ NetworkFinder
│  │  └─ AgentOperator
│  │
│  └─ UserAgent
│     ├─ GlobalUserAgent
│     └─ ProjectUserAgent
│
└─ TerminalAgent
   ├─ CodexCli
   └─ ClaudeCode
```

중요한 제약:

- `system/user`는 Narre branch 안의 분기다.
- `global/project`도 Narre `UserAgent` 안의 분기다.
- `CodexCli`, `ClaudeCode` 같은 `TerminalAgent`는 `system/user/global/project` 값을 갖지 않는다.
- Narre의 backend provider가 `codex`여도 supervisor에서의 정체성은 `NarreAgent`다.
- Terminal에서 실행되는 Codex CLI는 `TerminalAgent/CodexCli`다.

즉 `codex`라는 이름만으로 agent 정체성을 판단하지 않는다.

## 2. Agent Definition과 Session

Agent Definition과 Session은 분리한다.

```text
AgentDefinition = 어떤 agent인가
AgentSession    = 지금 실행 중인 agent instance인가
```

예시:

- `NetworkBuilder`는 system agent definition이다.
- 사용자가 network bootstrap 작업을 시작하면 session이 생긴다.
- 터미널에서 Codex CLI가 감지되면 `TerminalAgent/CodexCli` session으로 등록된다.

초기 방침:

- NarreAgent는 definition과 session을 둘 다 가진다.
- TerminalAgent는 초기에는 session 관측 중심으로 둔다.
- TerminalAgent preset/definition은 supervisor가 launch까지 맡는 단계에서 확장한다.

## 3. Command 제거와 Skill 완전 대체

기존 `Command` 개념은 제거하고 `Skill`로 대체한다.

사용자가 `/bootstrap`을 입력하는 것은 command 실행이 아니라 slash trigger로 skill을 invoke하는 것이다.

기존 구조:

```text
SlashCommand
└─ promptSkillKey
   └─ NarrePromptSkill
```

목표 구조:

```text
SlashTrigger
└─ SkillInvocation
   └─ Skill
```

따라서 제품 개념으로서의 command는 사라진다. Slash는 skill invocation 방식 중 하나일 뿐이다.

용어 전환:

| 기존 | 목표 |
|---|---|
| `SlashCommand` | 제거 |
| `CommandArg` | `SkillArg` |
| `CommandType` | 제거 |
| `NarrePromptSkillKey` | `SkillId` |
| `prompt-skills/` | `skills/` |
| `parseCommand()` | `parseSkillInvocation()` |
| `loadPromptSkill()` | `loadSkill()` |
| `SLASH_COMMANDS` | skill registry에서 파생 |

## 4. Skill Model

Skill은 실행 계약이다.

최소 속성:

```ts
interface SkillDefinition {
  id: string;
  name: string;
  source: 'builtin' | 'file';
  trigger?: SkillTrigger;
  args?: SkillArg[];
  requiredMentionTypes?: string[];
  toolProfiles?: string[];
  instructions?: string;
}
```

Slash trigger 예시:

```ts
{
  type: 'slash',
  name: 'bootstrap'
}
```

`/bootstrap`, `/index`는 built-in skill로 이전한다.

```text
Built-in Skill
├─ bootstrap
│  └─ slash trigger: /bootstrap
└─ index
   └─ slash trigger: /index
```

Narre system agent도 built-in skill을 사용할 수 있다.

```text
System Agent
├─ NetworkBuilder
├─ NetworkFinder
└─ AgentOperator
```

## 5. User Agent Skill Storage

User agent skill은 로컬 파일 기반 `SKILL.md` 디렉터리 패키지로 저장한다.

Claude Code, Codex가 쓰는 skill 방식과 맞춘다.

ProjectUserAgent:

```text
{projectRoot}/.netior/agents/{agentId}/skills/{skillId}/SKILL.md
```

GlobalUserAgent:

```text
%APPDATA%/netior/agents/{agentId}/skills/{skillId}/SKILL.md
```

패키지 구조:

```text
skills/
└─ {skillId}/
   ├─ SKILL.md
   ├─ references/
   ├─ scripts/
   └─ assets/
```

경로에는 `agent.name`이 아니라 `agent.id`를 쓴다.

이유:

- `name`은 사용자가 바꿀 수 있다.
- 파일시스템에 안전하지 않은 문자가 들어갈 수 있다.
- rename 때 skill 경로가 깨질 수 있다.

초기 구현 범위:

- `SKILL.md`만 읽어 prompt instructions로 사용한다.
- `references/`, `scripts/`, `assets/`는 구조만 인정한다.
- script 실행, asset attachment, reference indexing은 후속 단계로 둔다.

## 6. Built-in Skill과 File Skill

Skill source는 두 종류다.

```text
Skill
├─ Built-in Skill
│  └─ narre-server 코드/패키지 안에 존재
└─ File Skill
   └─ UserAgent local SKILL.md 패키지
```

Built-in skill:

- product-owned
- `bootstrap`, `index`, system agent skill에 사용
- 사용자가 임의로 core 계약을 바꾸지 않는다.

File skill:

- user-owned
- GlobalUserAgent 또는 ProjectUserAgent에 연결된다.
- 같은 skill package 규격을 쓴다.

Runtime은 built-in skill과 file skill을 같은 `SkillDefinition` 인터페이스로 다룬다.

## 7. Skill Invocation Flow

사용자 입력이 `/`로 시작하면 skill invocation으로 해석한다.

```text
User message
└─ parseSkillInvocation()
   └─ resolveSkillBySlashTrigger()
      └─ loadSkill()
         ├─ normalize args
         ├─ validate required mentions
         ├─ resolve tool profiles
         └─ build prompt overlay
```

Narre runtime 적용:

```text
base system prompt
+ active agent instructions
+ invoked skill instructions
+ user message
```

초기에는 prompt overlay만 적용한다.

후속 단계에서 skill별 MCP tool profile, approval policy, output contract를 더 강하게 적용한다.

## 8. Supervisor 책임

`narre-server`가 supervisor 역할을 맡는다.

초기 책임:

- agent definition registry
- skill registry
- skill invocation resolution
- session registry
- session status aggregation
- supervisor event stream

초기에는 in-memory registry로 시작한다.

후속 단계:

- user agent definition DB 저장
- remote/mobile attach
- supervisor가 desktop executor에 command 전송
- AgentOperator 기반 orchestration

## 9. Desktop Executor 책임

`desktop-app`은 terminal executor다.

초기 책임:

- PTY 소유
- Codex CLI terminal session 관측
- Claude Code terminal session 관측
- terminal agent session 상태를 supervisor에 보고

초기에는 supervisor가 terminal agent를 제어하지 않는다.

즉 다음은 후속 단계다.

- supervisor가 terminal launch
- supervisor가 input/interrupt 전송
- supervisor가 terminal session close 요청

## 10. 구현 Slice

### Slice 1. Shared Skill/Agent Contract

목표:

- agent taxonomy를 shared type으로 고정한다.
- command를 대체할 skill type을 추가한다.

작업:

- `AgentDefinition`
- `NarreAgentDefinition`
- `TerminalAgentDefinition`
- `SkillDefinition`
- `SkillTrigger`
- `SkillInvocation`
- `SkillArg`
- `UserAgentSkillPackage`

### Slice 2. Built-in Skill Registry

목표:

- `/bootstrap`, `/index`를 command가 아니라 built-in skill로 이전한다.

작업:

- `prompt-skills/`를 `skills/`로 전환
- `loadPromptSkill()`을 `loadSkill()`로 대체
- `parseCommand()`를 `parseSkillInvocation()`으로 대체
- `SLASH_COMMANDS`를 skill registry에서 파생

호환 방침:

- UI 동작은 그대로 유지한다.
- 내부 모델만 command에서 skill로 바꾼다.

### Slice 3. User Skill Loader

목표:

- UserAgent의 local `SKILL.md` 패키지를 로드한다.

작업:

- ProjectUserAgent skill root resolve
- GlobalUserAgent skill root resolve
- `skills/{skillId}/SKILL.md` scan/load
- frontmatter 또는 metadata parsing 방식 확정
- loaded skill을 `SkillDefinition`으로 normalize

초기 범위:

- `SKILL.md` body를 instructions로 사용
- references/scripts/assets는 후순위

### Slice 4. Narre Runtime Skill Invocation 적용

목표:

- Narre 실행이 command가 아니라 skill invocation을 사용한다.

작업:

- `NarreRuntime.runChat()`에서 skill invocation 파싱
- resolved skill prompt overlay 생성
- skill args normalize
- required mention validation
- skill tool profile 적용

### Slice 5. Supervisor Registry

목표:

- `narre-server`가 agent/session 상태의 단일 조회 지점이 된다.

작업:

- `narre-server/src/supervisor/` 추가
- system agent registry 추가
- skill registry와 연결
- session registry 추가
- HTTP API 추가

초기 API:

```text
GET  /supervisor/agents
GET  /supervisor/skills
GET  /supervisor/sessions
GET  /supervisor/events
POST /supervisor/sessions/report
```

### Slice 6. Existing Narre Session 편입

목표:

- 기존 Narre chat session을 supervisor session으로 등록한다.

작업:

- `/chat` 시작 시 supervisor session 생성 또는 연결
- `narreSessionId`를 supervisor session metadata로 저장
- streaming lifecycle에 따라 status update

### Slice 7. TerminalAgent Mirror

목표:

- Codex CLI, Claude Code terminal session을 supervisor가 볼 수 있게 한다.

작업:

- desktop executor bridge 추가
- `AgentRuntimeManager` event를 supervisor에 report
- provider mapping

```text
codex  -> TerminalAgent/CodexCli
claude -> TerminalAgent/ClaudeCode
```

### Slice 8. Read-only Unified UI

목표:

- renderer가 supervisor 상태를 읽어 agent session을 한 목록에서 볼 수 있게 한다.

초기 범위:

- session list
- status 표시
- agent kind 표시
- 제어 버튼 없음

## 11. 비목표

초기 개발에서 하지 않는다.

- multi-agent orchestration 완성
- AgentOperator가 자동으로 다른 agent 실행
- terminal agent launch/control
- user skill script 실행
- references/assets indexing
- user agent definition DB persistence
- mobile/remote attach

## 12. 검증 기준

각 slice마다 최소 검증을 둔다.

공통:

```text
pnpm --filter @netior/shared typecheck
pnpm --filter @netior/shared test
pnpm --filter @netior/narre-server typecheck
pnpm --filter @netior/narre-server build
```

runtime 변경이 들어간 뒤:

```text
pnpm --filter @netior/desktop-app typecheck
pnpm --filter @netior/desktop-app test
```

핵심 회귀 체크:

- `/bootstrap` UX가 유지된다.
- `/index` UX가 유지된다.
- 내부적으로는 command가 아니라 skill invocation으로 처리된다.
- ProjectUserAgent skill path가 `{projectRoot}/.netior/agents/{agentId}/skills`로 계산된다.
- GlobalUserAgent skill path가 `%APPDATA%/netior/agents/{agentId}/skills`로 계산된다.
- TerminalAgent는 `system/user/global/project` 값을 갖지 않는다.

## 13. 최종 방향

이 작업의 최종 방향은 다음 문장으로 정리한다.

Netior의 agent system은 command 중심이 아니라 skill 중심이다. NarreAgent는 skill을 가진 정의 가능한 agent이고, TerminalAgent는 Codex CLI와 Claude Code 같은 terminal runtime을 supervisor가 관측하는 agent다. `narre-server`는 supervisor가 되고, `desktop-app`은 terminal executor가 된다.
