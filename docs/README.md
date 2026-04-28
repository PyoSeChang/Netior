# Netior Docs

Netior 문서는 목적과 도메인 기준으로 나눈다. 새 문서를 추가할 때는 "무엇을 설명하는가"보다 "어디서 쓰이는가"를 먼저 기준으로 잡는다.

## 빠른 길

- 전체 런타임 구조: [architecture/runtime.md](architecture/runtime.md)
- desktop-app 구조: [architecture/desktop-app/main-and-preload.md](architecture/desktop-app/main-and-preload.md), [architecture/desktop-app/renderer-logic.md](architecture/desktop-app/renderer-logic.md), [architecture/desktop-app/components.md](architecture/desktop-app/components.md)
- 제품 기능 범위: [product/feature-list-ko.md](product/feature-list-ko.md)
- Narre 책임 표면: [narre/architecture/responsibility-surface-ko.md](narre/architecture/responsibility-surface-ko.md)
- Narre eval 사용법: [narre/eval/guide-ko.md](narre/eval/guide-ko.md)
- 다음 단계 계획: [plans/next-phase/next-phase-implementation-plan.md](plans/next-phase/next-phase-implementation-plan.md)
- 작업 중 문제/운영 노트: [operations/worktree-debugging.md](operations/worktree-debugging.md)

## 폴더 체계

```text
docs/
  README.md
  architecture/        현재 코드 구조, 런타임, 패키지 레퍼런스
  product/             제품 정체성, 기능 범위, 개념 언어
  features/            캔버스, 레이아웃, 터미널 등 기능별 설계/계획
  narre/               Narre 전용 아키텍처, eval, 리팩터링 계획
  plans/               여러 영역에 걸친 실행 계획
  reference/           정적 자료와 에셋
  operations/          디버깅, 이슈, 운영 메모
  research/            탐색적 아이디어와 장기 연구 메모
```

## 작성 규칙

- 현재 동작을 설명하는 문서는 `architecture/` 또는 `narre/architecture/`에 둔다.
- 기능 하나의 설계/리팩터링 계획은 `features/{domain}/`에 둔다.
- Narre 전용 문서는 `narre/` 아래에 둔다. eval 관련 문서는 `narre/eval/`, 리팩터링 계획은 `narre/plans/`를 쓴다.
- 제품 언어, 정체성, 기능 범위는 `product/`에 둔다.
- 여러 패키지나 제품 방향을 한 번에 건드리는 계획은 `plans/`에 둔다.
- 임시 운영 메모, 디버깅 기록, 조사성 이슈는 `operations/`에 둔다.
- 브랜드 시안, SVG, HTML 미리보기 같은 에셋은 `reference/branding/`에 둔다.
- 내부 링크는 절대 경로 대신 상대 경로를 쓴다.

## Architecture

- [runtime.md](architecture/runtime.md)
- [desktop-app/components.md](architecture/desktop-app/components.md)
- [desktop-app/main-and-preload.md](architecture/desktop-app/main-and-preload.md)
- [desktop-app/renderer-logic.md](architecture/desktop-app/renderer-logic.md)
- [desktop-app/shortcuts.md](architecture/desktop-app/shortcuts.md)
- [packages/narre-server.md](architecture/packages/narre-server.md)

## Product

- [feature-list-ko.md](product/feature-list-ko.md)
- [identity-ko.md](product/identity-ko.md)
- [identity-internal.md](product/identity-internal.md)
- [manifesto-draft.md](product/manifesto-draft.md)
- [networkics-ko.md](product/networkics-ko.md)

## Features

Canvas:

- [canvas/app-root-canvas-implementation-plan-ko.md](features/canvas/app-root-canvas-implementation-plan-ko.md)
- [canvas/group-tree-implementation-plan.md](features/canvas/group-tree-implementation-plan.md)

Calendar:

- [calendar/recurring-v1-ko.md](features/calendar/recurring-v1-ko.md)

Layout:

- [layout/layout-plugin-direction-ko.md](features/layout/layout-plugin-direction-ko.md)
- [layout/network-ui-rebuild-plan.md](features/layout/network-ui-rebuild-plan.md)

Meaning Model:

- [semantics/model-meaning-field-agent-contract-ko.md](features/semantics/model-meaning-field-agent-contract-ko.md)
- [semantics/meaning-slot-binding-model-ko.md](features/semantics/meaning-slot-binding-model-ko.md)
- [semantics/development-plan-ko.md](features/semantics/development-plan-ko.md)
- [semantics/implementation-plan-ko.md](features/semantics/implementation-plan-ko.md)
- [semantics/models-v1-ko.md](features/semantics/models-v1-ko.md)

Terminal:

- [terminal/refactor-plan.md](features/terminal/refactor-plan.md)
- [terminal/hyper-fork-plan.md](features/terminal/hyper-fork-plan.md)

## Narre

Architecture:

- [architecture/responsibility-surface-ko.md](narre/architecture/responsibility-surface-ko.md)
- [architecture/mcp-coverage-ko.md](narre/architecture/mcp-coverage-ko.md)
- [architecture/mcp-coverage-by-surface-ko.md](narre/architecture/mcp-coverage-by-surface-ko.md)

Eval:

- [eval/guide-ko.md](narre/eval/guide-ko.md)
- [eval/reference-ko.md](narre/eval/reference-ko.md)
- [eval/package-and-config.md](narre/eval/package-and-config.md)
- [eval/tui-guide-ko.md](narre/eval/tui-guide-ko.md)
- [eval/tui-spec-ko.md](narre/eval/tui-spec-ko.md)
- [eval/scenario-index-ko.md](narre/eval/scenario-index-ko.md)
- [eval/scenario-index-by-surface-ko.md](narre/eval/scenario-index-by-surface-ko.md)
- [eval/codex-owned-loop-ko.md](narre/eval/codex-owned-loop-ko.md)
- [eval/tester-refactor-plan-ko.md](narre/eval/tester-refactor-plan-ko.md)
- [eval/v2-refactor-plan-ko.md](narre/eval/v2-refactor-plan-ko.md)

Plans:

- [plans/mcp-expansion-plan.md](narre/plans/mcp-expansion-plan.md)
- [plans/openai-refactor-plan.md](narre/plans/openai-refactor-plan.md)
- [plans/prompting-refactor-plan-ko.md](narre/plans/prompting-refactor-plan-ko.md)
- [plans/prompting-strategy-redesign-ko.md](narre/plans/prompting-strategy-redesign-ko.md)
- [plans/responsibility-surface-refactor-plan-ko.md](narre/plans/responsibility-surface-refactor-plan-ko.md)
- [plans/scenario-driven-design-ko.md](narre/plans/scenario-driven-design-ko.md)

## Plans

Agent Supervisor:

- [agent-supervisor/orchestration-plan-ko.md](plans/agent-supervisor/orchestration-plan-ko.md)
- [agent-supervisor/skill-unification-plan-ko.md](plans/agent-supervisor/skill-unification-plan-ko.md)

Next Phase:

- [next-phase/network-object-domain-definition-ko.md](plans/next-phase/network-object-domain-definition-ko.md)
- [next-phase/next-phase-comprehensive-ko.md](plans/next-phase/next-phase-comprehensive-ko.md)
- [next-phase/next-phase-implementation-plan.md](plans/next-phase/next-phase-implementation-plan.md)

## Reference

- Branding assets: [reference/branding/](reference/branding/)

## Operations

- [agent-runtime-issue.md](operations/agent-runtime-issue.md)
- [worktree-debugging.md](operations/worktree-debugging.md)

## Research

- [predictive-context-architecture.md](research/predictive-context-architecture.md)
