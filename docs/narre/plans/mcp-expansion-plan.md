# Narre MCP Expansion Plan

Written: 2026-04-12

## 1. Worktree

- Worktree path: `.claude/worktrees/narre-mcp-enhancement`
- Branch: `worktree-narre-mcp-enhancement`
- Base: `HEAD` from `master` at worktree creation time

This document defines the first alignment pass between the current Netior data model and the Narre agent surface.

## 2. Goal

Bring `narre-server` and `netior-mcp` up to date with the post-`1.xx` Netior model so that Narre can perform graph CRUD without relying on outdated assumptions.

The immediate target is not a full UX redesign. The target is contract parity:

- Narre prompt input matches the current model.
- `netior-mcp` exposes the CRUD surface already available in `netior-service`.
- Narre mentions and prompts reflect `network`, root networks, type groups, relational schemas, and current graph semantics.
- Eval coverage expands beyond schema-only flows.

## 3. Current Model Baseline

Netior already contains these model changes:

- `canvas` is now `network`.
- `network_nodes` point to `objects`, not directly to `concept_id` or `file_id`.
- `edges` support `relation_meaning`.
- projects auto-create an app-root project object, a project-root network, and a project node in the app root.
- `modules.path` is the meaning directory path and `module_directories` is effectively normalized to one directory per module, but modules are still user-defined context boundaries rather than agent-managed graph objects in this phase.
- `type_groups` organize schemas and relation types into folder-like hierarchies.
- `schema_fields` support `field_type = 'schema_ref'` and `ref_schema_id`.
- `concept_properties` stores field values separately from concept rows.
- `contexts` are first-class graph objects, but they are outside the agent-owned surface for this phase.

This means the data model Narre should reason about is no longer:

- project -> concepts + relation types + canvases + loose module dirs

It is now closer to:

- app root network
- project root network
- nested project networks
- objects and object-backed nodes
- grouped schemas and relation types
- relational schema fields
- user-defined modules that act as context boundaries outside the agent CRUD scope for this phase

## 4. Current Gap Summary

### 4.1 `netior-service` is ahead of `netior-mcp`

`netior-service` already exposes routes for:

- schema fields
- relation types
- type groups
- concept properties
- objects
- contexts
- modules and module directories
- app root network
- project root network
- network tree
- networks
- network nodes
- edges
- layouts

`netior-mcp` currently registers only:

- schema tools
- relation type tools
- concept tools
- project summary
- module list
- filesystem tools
- PDF tools

Result: Narre can inspect or create a narrow subset of the graph, but it cannot manage the full model.

Module routes exist in `netior-service`, but module CRUD is intentionally not treated as part of the agent-owned surface in this phase.
Context routes also exist in `netior-service`, but context CRUD is intentionally not treated as part of the agent-owned surface in this phase.

### 4.2 Narre prompt input is too shallow

Current `SystemPromptParams` only passes:

- project name
- project root dir
- schema summaries
- relation type summaries

It does not pass:

- root networks
- network tree digest
- type group digest
- schema field digest
- relational schema information

### 4.3 Mention search is too narrow

Current Narre mention search returns:

- concept
- schema
- relation type
- network
- file

It does not return:

- project

The shared mention type also does not support:

- project
- type group

### 4.4 Prompt language still contains old terms

Legacy terms still appear in Narre code and prompts:

- `networks/canvases`
- `canvas`
- `canvasType`

This weakens tool selection and keeps old mental models alive.

### 4.5 Eval coverage is too small

Current Narre eval scenarios are mostly schema-centric:

- init project
- type update
- cascade delete

They do not verify:

- root network awareness
- network hierarchy CRUD
- type group CRUD
- relational schema creation
- concept property writes

## 5. Contract Principles

1. `netior-mcp` should mirror `netior-service` capability groups, not invent a second reduced model.
2. Narre should reason in `network` terms only. Do not preserve `canvas` as a primary term.
3. Tool names should stay explicit and low-ambiguity.
4. Prompt metadata should be summarized, not raw-dumped.
5. Mention types should cover the objects the user can realistically reference in chat.
6. Relational schemas must be treated as first-class modeling operations, not edge cases.
7. Modules are user-owned context boundaries. Narre may eventually consume them as context or permission hints, but it must not create or manage them in this phase.
8. Contexts are part of the current Netior model, but Narre must not create or manage them in this phase.

## 6. MCP Tool Expansion

### 6.1 Schema Field Tools

| Tool | Input | Service route | Notes |
| --- | --- | --- | --- |
| `list_schema_fields` | `schema_id` | `GET /schema-fields?schemaId=...` | Required for relational schema inspection |
| `create_schema_field` | `schema_id`, `name`, `field_type`, `sort_order`, optional `options`, optional `required`, optional `default_value`, optional `ref_schema_id` | `POST /schema-fields` | Must support `schema_ref` |
| `update_schema_field` | `field_id`, optional field updates | `PATCH /schema-fields/:id` | Must expose `ref_schema_id` |
| `delete_schema_field` | `field_id` | `DELETE /schema-fields/:id` | Confirm before delete |
| `reorder_schema_fields` | `schema_id`, `ordered_ids` | `PATCH /schema-fields/reorder` | Needed for clean schema authoring |

### 6.2 Type Group Tools

| Tool | Input | Service route | Notes |
| --- | --- | --- | --- |
| `list_type_groups` | `project_id`, `kind` | `GET /type-groups?projectId=...&kind=...` | `kind` is `schema` or `relation_type` |
| `create_type_group` | `project_id`, `kind`, `name`, optional `scope`, optional `parent_group_id`, optional `sort_order` | `POST /type-groups` | Represents the folder hierarchy for types |
| `update_type_group` | `group_id`, optional `name`, optional `parent_group_id`, optional `sort_order` | `PATCH /type-groups/:id` | Needed for folder restructuring |
| `delete_type_group` | `group_id` | `DELETE /type-groups/:id` | Confirm before delete |

### 6.3 Concept Property Tools

| Tool | Input | Service route | Notes |
| --- | --- | --- | --- |
| `get_concept_properties` | `concept_id` | `GET /concept-properties?conceptId=...` | Required to inspect relational field state |
| `upsert_concept_property` | `concept_id`, `field_id`, `value` | `POST /concept-properties` | Required to populate schema field values |
| `delete_concept_property` | `concept_property_id` | `DELETE /concept-properties/:id` | Confirm before delete |

### 6.4 Object Tools

| Tool | Input | Service route | Notes |
| --- | --- | --- | --- |
| `get_object` | `object_id` | `GET /objects/:id` | Useful for object-backed network node workflows |
| `get_object_by_ref` | `object_type`, `ref_id` | `GET /objects/by-ref?objectType=...&refId=...` | Critical for creating nodes around existing entities |

### 6.5 Network Tools

| Tool | Input | Service route | Notes |
| --- | --- | --- | --- |
| `get_app_root_network` | none | `GET /networks/app-root` | Needed for app-level navigation and project graph reasoning |
| `get_project_root_network` | `project_id` | `GET /networks/project-root?projectId=...` | Needed for project graph entry |
| `get_network_tree` | `project_id` | `GET /networks/tree?projectId=...` | Needed for hierarchy-aware planning |
| `list_networks` | `project_id`, optional `root_only` | `GET /networks?projectId=...&rootOnly=...` | Basic fetch |
| `create_network` | `project_id`, `name`, optional `scope`, optional `parent_network_id` | `POST /networks` | Parent-aware creation is required |
| `update_network` | `network_id`, optional `name`, optional `scope`, optional `parent_network_id` | `PATCH /networks/:id` | Reparenting is a first-class operation |
| `delete_network` | `network_id` | `DELETE /networks/:id` | Confirm before delete |
| `get_network_full` | `network_id` | `GET /networks/:id/full` | Needed for node-edge reasoning |
| `get_network_ancestors` | `network_id` | `GET /networks/:id/ancestors` | Useful for breadcrumb-aware replies |

### 6.6 Network Node Tools

| Tool | Input | Service route | Notes |
| --- | --- | --- | --- |
| `add_network_node` | `network_id`, `object_id`, optional `node_type`, optional `parent_node_id` | `POST /network-nodes` | Narre must think in object IDs, not raw concept IDs |
| `update_network_node` | `node_id`, optional `node_type`, optional `parent_node_id`, optional `metadata` | `PATCH /network-nodes/:id` | Needed for group and hierarchy edits |
| `remove_network_node` | `node_id` | `DELETE /network-nodes/:id` | Confirm before delete |

### 6.7 Edge Tools

| Tool | Input | Service route | Notes |
| --- | --- | --- | --- |
| `create_edge` | `network_id`, `source_node_id`, `target_node_id`, optional `relation_type_id`, optional `relation_meaning`, optional `description` | `POST /edges` | Must expose `relation_meaning` |
| `get_edge` | `edge_id` | `GET /edges/:id` | Basic fetch |
| `update_edge` | `edge_id`, optional `relation_type_id`, optional `relation_meaning`, optional `description` | `PATCH /edges/:id` | Required for hierarchy and semantic updates |
| `delete_edge` | `edge_id` | `DELETE /edges/:id` | Confirm before delete |

### 6.8 Layout Tools

| Tool | Input | Service route | Notes |
| --- | --- | --- | --- |
| `get_layout_by_network` | `network_id` | `GET /layouts/by-network?networkId=...` | Required for network editing workflows |
| `update_layout` | `layout_id`, optional `layout_type`, optional `layout_config_json`, optional `viewport_json` | `PATCH /layouts/:id` | Needed for field mappings and viewport state |
| `get_layout_node_positions` | `layout_id` | `GET /layouts/:id/nodes` | Needed for placement-aware actions |
| `set_layout_node_position` | `layout_id`, `node_id`, `position_json` | `PUT /layouts/:id/nodes/:nodeId` | Optional for future Narre layout edits |
| `remove_layout_node_position` | `layout_id`, `node_id` | `DELETE /layouts/:id/nodes/:nodeId` | Optional cleanup |
| `get_layout_edge_visuals` | `layout_id` | `GET /layouts/:id/edges` | Needed for visual edit inspection |
| `set_layout_edge_visual` | `layout_id`, `edge_id`, `visual_json` | `PUT /layouts/:id/edges/:edgeId` | Optional for future Narre layout edits |
| `remove_layout_edge_visual` | `layout_id`, `edge_id` | `DELETE /layouts/:id/edges/:edgeId` | Optional cleanup |

## 7. Tool Naming Rules

Use one naming rule consistently:

- list = collection fetch
- get = single fetch
- create = create row
- update = partial update
- delete or remove = destructive delete
- add = append relation or membership
- set = idempotent overwrite
- reorder = explicit ordering mutation

Avoid overloaded names such as:

- `manage_network`
- `save_type_group`

## 8. Narre Prompt Metadata Expansion

`SystemPromptParams` should be expanded beyond schema and relation type summaries.

Recommended additions:

```ts
interface SystemPromptParams {
  projectName: string;
  projectRootDir?: string | null;
  schemas: Array<{ id: string; name: string; group_id?: string | null; icon?: string | null; color?: string | null; node_shape?: string | null }>;
  relationTypes: Array<{ id: string; name: string; group_id?: string | null; directed: boolean; line_style: string; color?: string | null }>;
  schemaGroups?: Array<{ id: string; name: string; parent_group_id: string | null }>;
  relationTypeGroups?: Array<{ id: string; name: string; parent_group_id: string | null }>;
  appRootNetwork?: { id: string; name: string } | null;
  projectRootNetwork?: { id: string; name: string } | null;
  networkTree?: Array<{ id: string; name: string; parent_network_id: string | null; scope: string }>;
  relationalSchemas?: Array<{ schema_id: string; field_count: number; refs: Array<{ field_id: string; field_name: string; ref_schema_id: string }> }>;
}
```

The prompt does not need full raw rows. It needs enough context to guide tool selection.

Modules are intentionally excluded from the first-pass prompt contract. Their long-term role is closer to user-defined context, permission scope, and responsibility boundaries, especially once multi-agent behavior is introduced.
Contexts are also intentionally excluded from the first-pass prompt contract.

## 9. Mention Expansion

### 9.1 Shared mention type

Expand `NarreMention` to include:

- `project`

Type groups do not need to be mentionable in the first pass if the agent can search and list them through tools. They can be added later if users need direct mention-driven edits.

### 9.2 Mention search sources

The desktop IPC mention search should include:

- project root network
- app root network when relevant

Recommended first-pass mention result types:

- concept
- network
- project
- schema
- relationType
- file

### 9.3 Mention tag normalization

Remove previous tag handling for:

- `canvas`
- `canvasType`

Keep all internal prompt tags in the current vocabulary:

- `[network:id=...]`
- `[project:id=...]`
- `[file:path=...]`

## 10. Prompt Updates for Relational Schemas

The system prompt and onboarding prompt should explicitly teach Narre that relational modeling now includes schema fields, not only edges.

The prompt should make these distinctions clear:

- use relation types and edges for graph relationships between nodes
- use `schema_ref` fields when the schema itself needs a typed reference slot
- use concept properties to populate field values after fields exist
- use type groups when the user asks for folders or organization of schemas or relation types
- use root networks and network hierarchy for structural navigation, not as an implementation detail
- do not treat modules as agent-managed entities in this phase; they are user-defined context boundaries
- do not treat contexts as agent-managed entities in this phase

Recommended explicit guidance:

- "When the user asks to build a relational schema, inspect or create schema fields before creating concepts."
- "If a concept property depends on an schema field, ensure the field exists first."
- "When the user asks for schema folders or relation type folders, use type groups rather than inventing pseudo-folder concepts."

## 11. Implementation Order

### Phase A. Expand the MCP client and register new tools

Add missing request wrappers in `packages/netior-mcp/src/netior-service-client.ts` and register tool files for:

- schema fields
- type groups
- concept properties
- objects
- networks
- network nodes
- edges
- layouts

Deliverable:

- `netior-mcp` exposes the same CRUD surface categories already present in `netior-service`

### Phase B. Upgrade Narre metadata and mention search

Update:

- `desktop-app/src/main/ipc/narre-ipc.ts`
- `narre-server/src/system-prompt.ts`
- `narre-server/src/runtime/narre-runtime.ts`
- shared `NarreMention` type
- Narre mention picker UI

Deliverable:

- Narre receives current-model summaries and can mention current-model entities

### Phase C. Rewrite Narre modeling guidance

Update:

- system prompt
- onboarding prompt
- any provider-specific scaffolding that relies on old object assumptions

Deliverable:

- Narre speaks in `network` terms and understands relational schema workflows

### Phase D. Add eval scenarios for the new model

Add at least these scenarios:

- create a project and confirm root network awareness
- create an schema folder tree and move schemas into groups
- create relational schemas with `schema_ref` fields
- create concept properties for relational fields
- create nested networks and reparent them

Deliverable:

- eval catches regressions in the new contract

## 12. First Implementation Slice

The best first slice is not full parity at once. It is the smallest slice that unlocks useful graph CRUD for Narre.

Recommended order:

1. schema field tools
2. type group tools
3. concept property tools
4. network tools
5. network node and edge tools
6. prompt and mention updates
7. eval expansion

This order unlocks:

- relational schema design
- type folder management
- root network and hierarchy-aware planning

before spending time on optional layout editing.

## 13. Acceptance Criteria

This work is complete when all of the following are true:

- Narre can create, inspect, update, and delete type groups through MCP.
- Narre can create and edit `schema_ref` fields through MCP.
- Narre can write concept properties through MCP.
- Narre can inspect app root and project root networks.
- Narre can create child networks using `parent_network_id`.
- Narre can add nodes by object ID and connect them with edges.
- Narre prompts no longer treat `canvas` as a primary domain term.
- Mention search can return project entries.
- Eval coverage includes at least one scenario for network hierarchy, type groups, and relational schemas.

## 14. Non-Goals for This Pass

- agent-authored freeform layout design
- broad UI redesign of Narre chat
- introducing a new generic graph DSL
- making every object type mentionable on day one
- replacing desktop-app IPC flows that already work unless required for the new contract
- module creation, update, deletion, or module-directory management by the agent
- module-based permission or responsibility design before multi-agent support exists
- context creation, update, deletion, or context-member management by the agent

## 15. Concrete Next Step

Implement Phase A first:

- add missing request wrappers in `packages/netior-mcp/src/netior-service-client.ts`
- split new MCP tool files by domain
- register them in `packages/netior-mcp/src/tools/index.ts`
- keep destructive tools confirmation-friendly through prompt guidance rather than hidden behavior

After that, move immediately to Phase B so Narre can actually use the new tools with the right mental model.
