# Narre OpenAI Refactor Plan

작성일: 2026-04-10

## 1. Worktree

- Worktree path: `.claude/worktrees/narre-openai-refactor`
- Branch: `worktree-narre-openai-refactor`
- Base: `HEAD` from `master` at worktree creation time

이 작업은 루트 checkout이 이미 dirty 상태이므로, Narre provider/runtime 리팩터링을 별도 worktree에서 진행한다.
이 문서는 해당 worktree의 구현 기준 문서다.

## 2. Goal

`packages/narre-server`를 provider-neutral 구조로 리팩터링하고, 기존 Claude Agent SDK 경로는 유지한 채 OpenAI Agents SDK 경로를 추가한다.

동시에 Narre가 전제하는 데이터 모델과 tool contract를 현재 Netior 구조에 맞게 정리한다.

## 3. Current Problems

### 3.1 Provider coupling

- `narre-server`의 실행 루프가 Claude SDK `query()`에 직접 결합되어 있다.
- `narre-ui` MCP bridge도 Claude SDK의 `createSdkMcpServer()`에 직접 결합되어 있다.
- desktop-app 설정도 `anthropic_api_key` 하나만 전제로 한다.

### 3.2 Mixed session ownership

- desktop-app main IPC와 narre-server가 각각 세션 파일을 읽고 쓴다.
- provider가 늘어나면 session metadata와 resume state의 저장 책임이 더 꼬일 가능성이 높다.

### 3.3 Old domain assumptions

- Narre mention/type/prompt/tool 흐름이 `network`, `module` 중심의 예전 모델 가정을 아직 포함한다.
- 현재 Netior의 중심 개념과 Narre가 보는 입력 모델을 다시 맞춰야 한다.

### 3.4 Contract risk

- renderer는 현재 SSE + card + tool log 계약에 맞춰 구현되어 있다.
- provider를 추가하더라도 renderer 계약은 되도록 유지해야 회귀 범위를 줄일 수 있다.

## 4. Refactor Principles

1. Claude 경로는 제거하지 않는다.
2. OpenAI 경로는 최신 공식 `@openai/agents` 기준으로 붙인다.
3. provider 교체보다 먼저 runtime abstraction을 만든다.
4. renderer/IPC의 외부 계약은 가능한 한 유지한다.
5. 세션 저장 책임은 한 곳으로 모은다.
6. prompt/tool/mention 계약은 현재 Netior 도메인 기준으로 다시 정의한다.

## 5. In Scope

- `packages/narre-server` runtime/provider 분리
- Claude adapter 추출
- OpenAI Agents SDK adapter 추가
- session storage 정리
- Narre mention/project metadata/tool contract 재정의
- desktop-app 설정/API key/provider 선택 구조 정리
- 관련 문서와 테스트 보강

## 6. Out of Scope

- Narre UI 전체 재디자인
- Claude 경로 삭제
- eval harness 전면 재설계
- Netior 전체 데이터 모델 개편

## 7. Target Architecture

### 7.1 narre-server

예상 디렉터리 구조:

- `src/runtime/narre-runtime.ts`
- `src/runtime/provider-adapter.ts`
- `src/providers/claude.ts`
- `src/providers/openai.ts`
- `src/tools/ui-tool-bridge.ts`
- `src/session/session-repository.ts`

### 7.2 Common contract

공통 runtime이 담당할 것:

- session resolve/create
- prompt assembly
- mention preprocessing
- netior MCP server 연결
- SSE event emission
- assistant/tool/card 결과를 Narre stream event로 변환

provider adapter가 담당할 것:

- 실제 agent run 호출
- provider-specific streaming event 파싱
- approval/card tool 연결 방식
- provider-specific resume metadata 보관

## 8. Milestones

### Milestone A. Worktree bootstrap

- dedicated worktree 생성
- 계획 문서 추가

완료 기준:

- worktree와 branch가 생성되어 있고 독립적으로 커밋 가능하다
- 구현 기준 문서가 존재한다

### Milestone B. Runtime abstraction

- Claude SDK 직접 의존부를 adapter로 추출
- Express route는 공통 runtime을 호출하도록 정리
- 현재 동작을 유지한 상태에서 구조만 분리

주요 파일:

- `packages/narre-server/src/index.ts`
- `packages/narre-server/src/ui-tools.ts`
- 신규 runtime/provider 파일들

완료 기준:

- Claude 경로가 기존과 동일하게 동작한다
- provider-specific 코드는 adapter 내부로 격리된다

### Milestone C. OpenAI adapter

- `@openai/agents` 의존 추가
- OpenAI provider adapter 구현
- stdio MCP 서버를 OpenAI agent에 연결
- `propose/ask/confirm` UI tools를 OpenAI 경로에서 동작시킨다

완료 기준:

- OpenAI API key가 있을 때 Narre 대화가 end-to-end로 돈다
- tool log, text streaming, card 응답이 renderer에서 보인다

### Milestone D. Domain contract alignment

- `NarreMention`과 mention search 결과를 현재 모델 기준으로 정리
- `projectMetadata` shape 재정의
- 오래된 `network/module` 전제를 prompt와 tool usage에서 제거 또는 축소

완료 기준:

- Narre prompt가 현재 Netior 개념 체계를 기준으로 동작한다
- 구식 모델 흔적이 공용 타입/프롬프트의 핵심 경로에서 제거된다

### Milestone E. Desktop integration

- provider 선택 설정 추가
- `anthropic_api_key`, `openai_api_key` 분리
- server manager와 IPC를 provider-aware하게 수정

완료 기준:

- desktop-app에서 provider를 선택하고 기동할 수 있다
- 기존 Claude 경로와 OpenAI 경로를 모두 실행 가능하다

### Milestone F. Verification

- narre-server build/typecheck
- desktop-app typecheck
- smoke test: 일반 채팅, `/index`, card 응답, session resume
- provider별 회귀 체크리스트 문서화

완료 기준:

- 최소 smoke test가 두 provider 모두 통과한다
- 알려진 제한사항이 문서에 남아 있다

## 9. First File Targets

초기 착수 파일:

- `packages/narre-server/src/index.ts`
- `packages/narre-server/src/ui-tools.ts`
- `packages/narre-server/src/session-store.ts`
- `packages/desktop-app/src/main/ipc/narre-ipc.ts`
- `packages/desktop-app/src/main/process/narre-server-manager.ts`
- `packages/shared/src/types/index.ts`

## 10. Working Rules For This Worktree

1. 큰 기능 변경 전에 provider-neutral contract를 먼저 만든다.
2. root checkout의 unrelated 변경은 건드리지 않는다.
3. 문서와 코드 변경은 이 worktree branch 안에서만 진행한다.
4. Claude 경로를 깨뜨리는 변경은 OpenAI 추가보다 우선순위가 낮다.
5. provider별 차이는 adapter 경계 밖으로 새지 않게 유지한다.

## 11. Immediate Next Steps

## 12. Progress Notes (2026-04-10)

- `packages/narre-server` now has a provider abstraction plus a Claude adapter.
- `@openai/agents` was added and pinned to `0.8.3`.
- An OpenAI adapter was added with `Agent`, streaming `run(...)`, `MCPServerStdio`, UI function tools, and file-backed provider session storage.
- `pnpm --filter @netior/narre-server typecheck` passes in this worktree.
- `pnpm --filter @netior/narre-server build` passes in this worktree.

## 13. Runtime Blocker

- `@openai/agents` 0.8.3 requires Node.js 22 or later.
- The desktop app currently runs `narre-server` through Electron 28 with `ELECTRON_RUN_AS_NODE=1`.
- The OpenAI provider is therefore not desktop-default-ready until the runtime path is upgraded or split out to Node 22.

## 14. Data Service Slice (2026-04-10)

- Added a new `@netior/service` package as the first long-term extraction target for `@netior/core`.
- The service currently owns DB bootstrap, a health endpoint, config read/write endpoints, and project CRUD endpoints.
- Desktop main now starts the service process on app boot and stops it on shutdown.
- `config` and `project` IPC handlers now prefer the service path and fall back to local `@netior/core` if the service is unavailable.
- Other IPC handlers still call `@netior/core` directly. This slice establishes the boundary without forcing a full migration in one step.
- Validation in this worktree:
- `pnpm --filter @netior/core build`
- `pnpm --filter @netior/service typecheck`
- `pnpm --filter @netior/service build`
- `pnpm --filter @netior/narre-server typecheck`

## 15. Service Migration Slice 2 (2026-04-10)

- Extended `@netior/service` to cover concept CRUD/search, network CRUD/tree/full/root/breadcrumb reads, network node mutations, edge CRUD, and layout reads/mutations.
- Added a desktop service client for the new endpoints so main-process IPC handlers can stay thin and provider-neutral.
- `concept`, `network`, and `layout` IPC handlers now prefer the service path and fall back to local `@netior/core` when the service is unavailable.
- Renderer-facing IPC contracts were kept unchanged. Broadcast refresh events still fire from desktop main after mutations.
- Validation in this worktree:
- `pnpm --filter @netior/service typecheck`
- `pnpm --filter @netior/service build`
- `pnpm --filter @netior/desktop-app typecheck` still fails on pre-existing renderer-side errors unrelated to this slice

## 16. Service Migration Slice 3 (2026-04-10)

- Extended `@netior/service` again for lower-risk CRUD groups: schemas, schema fields, relation types, type groups, concept properties, editor prefs, and object lookups.
- Added matching desktop service-client calls and switched the corresponding main-process IPC handlers to service-first with local fallback.
- This removes more routine metadata reads and writes from Electron main without touching renderer-facing contracts.
- Validation in this worktree:
- `pnpm --filter @netior/service typecheck`
- `pnpm --filter @netior/service build`
- `pnpm --filter @netior/desktop-app typecheck` still fails on the same pre-existing renderer-side errors

## 18. Narre IPC Service Slice (2026-04-10)

- Added service-backed project lookup for Narre metadata composition and switched `narre-ipc` DB-backed reads to prefer `@netior/service`.
- Added Narre server session lookup/delete support without a caller-supplied `projectId`, then switched `narre-ipc` session list/create/get/delete to prefer the Narre server endpoints when the server is running.
- `narre-ipc` now prefers service-backed config reads/writes for the API key and service-backed mention search inputs when the data service is available.
- Validation in this worktree:
- `pnpm --filter @netior/service typecheck`
- `pnpm --filter @netior/service build`
- `pnpm --filter @netior/narre-server typecheck`
- `pnpm --filter @netior/narre-server build`
- `pnpm --filter @netior/desktop-app typecheck` still fails on the same pre-existing renderer-side errors

## 17. Service Migration Slice 4 (2026-04-10)

- Extended `@netior/service` for contexts, files, modules, module directories, and concept-content sync endpoints.
- Added matching desktop service-client methods and switched `context`, `file`, `module`, and `concept-content` IPC handlers to service-first with local fallback.
- The concept content sync logic now has a service path, which removes another direct `getDatabase()` composition flow from Electron main when the service is active.
- Validation in this worktree:
- `pnpm --filter @netior/service typecheck`
- `pnpm --filter @netior/service build`
- `pnpm --filter @netior/desktop-app typecheck` still fails on the same pre-existing renderer-side errors

1. `narre-server`의 Claude 결합부를 runtime/provider layer로 분리한다.
2. session ownership을 server 쪽 repository 하나로 모을 설계를 확정한다.
3. OpenAI adapter에 필요한 streaming/tool/session 매핑을 작은 스파이크로 검증한다.
4. 이후 desktop provider settings와 Narre domain contract 정리에 들어간다.
## 19. Narre Runtime Sync Slice (2026-04-10)

- Added `packages/desktop-app/src/main/narre/narre-config.ts` as the shared source of truth for Narre provider selection, provider-specific API key lookup, OpenAI model lookup, and runtime sync.
- Desktop app startup now uses the shared Narre config loader instead of duplicating provider/key/model resolution in `main/index.ts`.
- `config:set` now re-syncs the Narre process when Narre-managed settings change (`narre.provider`, `narre.openai.model`, `anthropic_api_key`, `openai_api_key`).
- `narre-ipc` now uses the same shared Narre config helpers and no longer hardcodes `localhost:3100` for `/chat`, `/chat/respond`, or `/command`; requests now follow the manager-provided base URL.
- Validation in this worktree:
- `pnpm --filter @netior/desktop-app typecheck` still fails only on the same pre-existing renderer-side errors (`MinimizedEditorTabs.tsx`, `NetworkEditor.tsx`, `NetworkWorkspace.tsx`, `network-store.ts`)

## 20. Remaining Work

- Make `narre-server-manager` logging cleanup and packaged runtime selection more explicit. The provider-aware runtime path works, but the launch path still needs final cleanup for production packaging.
- Finish the bundled Node 22 runtime path for both `@netior/service` and `narre-server`, then remove the remaining assumption that Electron must host those processes.
- Reduce or remove local `@netior/core` fallback paths in desktop main once the service path is stable enough for default use.

## 21. Desktop Main Boundary Cleanup (2026-04-11)

- Added `packages/desktop-app/src/main/process/sidecar-runtime.ts` so both service and Narre sidecars resolve runtimes the same way: explicit env override, dev Node, bundled runtime, then Electron fallback.
- Reworked `netior-service-manager.ts` and `narre-server-manager.ts` around the shared resolver. OpenAI Narre now enforces Node 22+ at the runtime boundary instead of failing later inside the provider.
- Removed runtime `@netior/core` usage from Electron main. Main-process IPC handlers now call the HTTP data service for config, project, concept, network, layout, context, file, module, concept-content, and Narre metadata/search paths.
- Desktop startup now depends on the service being available and no longer initializes or closes the SQLite connection inside Electron main.
- Cleaned up renderer/typecheck fallout introduced during the migration so `pnpm --filter @netior/desktop-app typecheck` passes again.

## 22. Validation Snapshot (2026-04-11)

- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- Runtime smoke check:
- Started `@netior/service` against a fresh temporary SQLite DB and verified `/health`, config round-trip via `/config/narre.provider`, project creation via `/projects`, and project root network lookup via `/networks/project-root`.
- Started `@netior/narre-server` against the same temporary DB and verified `/health`, session create/list/get/delete, and on-disk session storage under `MOC_DATA_DIR/narre/<projectId>/`.

## 23. Packaged Node Runtime Slice (2026-04-11)

- Added `packages/desktop-app/scripts/prepare-node-runtime.js` to copy the current Node executable into `packages/desktop-app/resources/node-runtime/` and emit a small manifest before packaging.
- Updated desktop packaging scripts so `package` and `package:win` always prepare the sidecar runtime first.
- Added `extraResources` packaging so the generated runtime is shipped into `resources/node-runtime/` inside the packaged app.
- Validation in this worktree:
- `pnpm --filter @netior/desktop-app run prepare:node-runtime`
- `pnpm --filter @netior/desktop-app typecheck`
- `pnpm --filter @netior/desktop-app build`
- `pnpm --filter @netior/desktop-app package:win`
- Verified `packages/desktop-app/release/win-unpacked/resources/node-runtime/node.exe -v` returns `v22.14.0`
