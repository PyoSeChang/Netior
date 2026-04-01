# Narre Eval Scenarios

## Scenario Format

Each scenario defines: seed data, user turns, expected DB state, and qualitative rubrics.

---

## 01: Onboarding — Empty Project

**Seed**: empty project (no archetypes, relation types, canvas types, no modules)

```json
{
  "project": { "name": "조선시대", "root_dir": "C:/tmp/eval-project" }
}
```

**Turns**:
1. User: "/onboarding"
2. (Narre should ask about domain via `ask` tool since no files exist)
3. User responds with domain info (e.g., selects "역사 연구")
4. (Narre proposes archetypes via `propose` tool)
5. User confirms proposal
6. (Narre proposes relation types)
7. User confirms
8. (Narre proposes canvas types)
9. User confirms

**Expected DB**:
- `list_archetypes`: 2+ archetypes created
- `list_relation_types`: 1+ relation types created
- `list_canvas_types`: 1+ canvas types created

**Qualitative Rubrics**:
1. Used `ask` tool to gather domain info (not plain text question) (1-5)
2. Used `propose` tool for each stage (not plain text tables) (1-5)
3. Proposed sensible types for the given domain (1-5)
4. Followed the 4-stage order (Archetype → RelationType → CanvasType → Concept) (1-5)
5. Responded in Korean (matching user language) (1-5)

---

## 02: Onboarding — Project with Files

**Seed**: project with modules and sample files

```json
{
  "project": { "name": "게임기획", "root_dir": "C:/tmp/eval-game" },
  "modules": [
    { "name": "기획서", "directories": ["C:/tmp/eval-game/docs"] }
  ]
}
```

Pre-populate `C:/tmp/eval-game/docs/` with sample markdown files:
- `characters/warrior.md` — "# 전사\n용맹한 근접 전투원..."
- `characters/mage.md` — "# 마법사\n원거리 마법 공격..."
- `skills/slash.md` — "# 베기\n전사의 기본 공격 스킬..."
- `quests/tutorial.md` — "# 튜토리얼\n게임 시작 퀘스트..."

**Turns**:
1. User: "/onboarding"
2. (Narre should explore files via list_modules → list_module_directories → glob_files → read_file)
3. (Narre proposes archetypes based on file analysis)
4. User confirms
5. Continue through stages...

**Expected DB**:
- `list_archetypes`: includes types matching file categories (e.g., 캐릭터, 스킬, 퀘스트)
- Archetypes should reflect file content, not generic templates

**Qualitative Rubrics**:
1. Used filesystem tools to analyze project content (1-5)
2. Proposed archetypes that reflect actual file categories (1-5)
3. Used `propose` tool (not plain text) (1-5)
4. Inferred relationships from file content (1-5)

---

## 03: Onboarding — Partial Types

**Seed**: project with some existing archetypes

```json
{
  "project": { "name": "소프트웨어", "root_dir": "C:/tmp/eval-sw" },
  "archetypes": [
    { "name": "모듈", "icon": "box", "color": "#4A90D9" },
    { "name": "API", "icon": "globe", "color": "#E74C3C" }
  ]
}
```

**Turns**:
1. User: "/onboarding"
2. (Narre should recognize existing archetypes and propose additions/relation types)

**Expected DB**:
- Existing archetypes preserved (모듈, API still exist)
- New relation types created (e.g., 의존, 호출)
- Canvas types created

**Qualitative Rubrics**:
1. Recognized and preserved existing types (1-5)
2. Proposed complementary additions (not duplicates) (1-5)
3. Started from Stage 2 or proposed only missing archetypes in Stage 1 (1-5)

---

## Adding New Scenarios

Follow this format:
1. **Seed** — JSON for harness setup
2. **Turns** — sequential user messages (respond dynamically to Narre's questions)
3. **Expected DB** — what to verify with netior-mcp tools after conversation
4. **Expected Response** — keywords, error checks
5. **Qualitative Rubrics** — 1-5 scale criteria for conversation quality
