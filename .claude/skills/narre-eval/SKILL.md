---
name: narre-eval
description: "Evaluate Narre AI assistant quality via scenario-based testing. TRIGGER when: user says '/narre-eval', 'eval narre', 'narre 평가', 'narre 테스트', or asks to test/evaluate Narre's tool calling, conversation quality, or type system management capabilities. Runs real e2e scenarios against agent-server, grades DB outcomes + conversation quality."
---

# Narre Eval

Scenario-based evaluation of Narre (Netior's AI assistant). Run real conversations against agent-server and grade results by checking DB state and conversation quality.

## Workflow

### 1. Setup

Run harness to initialize eval environment:

```bash
# Build dependencies first (if not already built)
pnpm --filter @netior/core build && pnpm --filter @netior/mcp build && pnpm --filter @netior/agent-server build

# Initialize eval DB with seed data (optional seed JSON)
npx tsx .claude/skills/narre-eval/scripts/harness.ts setup [seed.json]

# Start agent-server on port 3199
npx tsx .claude/skills/narre-eval/scripts/harness.ts start-server
```

Seed JSON format:
```json
{
  "project": { "name": "조선시대", "root_dir": "C:/tmp/eval-project" },
  "archetypes": [{ "name": "인물", "icon": "user", "color": "#4A90D9" }],
  "relation_types": [{ "name": "관련", "directed": false }],
  "concepts": [{ "title": "세종대왕", "archetype_name": "인물" }]
}
```

### 2. Run Scenario

Send user messages to Narre via POST to `http://localhost:3199/chat`:

```bash
curl -X POST http://localhost:3199/chat \
  -H "Content-Type: application/json" \
  -d '{"projectId": "<PROJECT_ID>", "message": "역사 프로젝트야. 인물, 사건, 장소 아크타입 만들어줘", "projectMetadata": {"projectName": "조선시대", "archetypes": [], "relationTypes": [], "canvasTypes": []}}' \
  --no-buffer
```

Response is SSE stream. Parse events:
- `text` — assistant response text
- `tool_start` — tool name + input
- `tool_end` — tool result
- `error` — error message
- `done` — stream end

For multi-turn, include `sessionId` from first response in subsequent requests.

### 3. Verify Results

After conversation completes, verify outcomes using netior-mcp MCP tools:
- `list_archetypes` — check created archetypes
- `list_relation_types` — check relation types
- `list_concepts` — check concepts
- `get_project_summary` — overview of project state

Grade on two axes:

**Quantitative (pass/fail):**
- Expected entities exist in DB
- Correct names, properties, counts
- Deleted entities are absent
- No unexpected side effects

**Qualitative (1-5 scale):**
- Accurately fulfilled user request
- Reported results clearly
- Asked for confirmation before destructive actions
- Responded in user's language
- Did not perform unnecessary actions

### 4. Record Results

Write result as `packages/narre-eval/results/{date}_{scenario-id}.md`:

```markdown
# Narre Eval: {scenario-id}
**Date**: {YYYY-MM-DD} | **Duration**: {N}s | **Tool calls**: {N}

## Quantitative

| Check | Result | Detail |
|-------|--------|--------|
| {check description} | PASS/FAIL | {detail} |

## Qualitative

| Rubric | Score | Note |
|--------|-------|------|
| {rubric} | {1-5} | {observation} |

## Result: PASS/FAIL ({judge avg}/5)
```

No transcript in result file — re-run scenario to debug if needed.

### 5. Teardown

```bash
npx tsx .claude/skills/narre-eval/scripts/harness.ts teardown
```

## Scenarios

See [references/scenarios.md](references/scenarios.md) for full scenario definitions with seed data, expected DB states, and rubrics.

Available scenarios: Init Project, Type Update, Cascade Delete.

## Key Files

- Harness script: `.claude/skills/narre-eval/scripts/harness.ts`
- Scenarios: `references/scenarios.md`
- Results: `packages/narre-eval/results/{date}_{scenario}.md`
- Agent-server: `packages/agent-server/` (port 3199 for eval)
- Design doc: `DESIGN-narre-eval.md`
