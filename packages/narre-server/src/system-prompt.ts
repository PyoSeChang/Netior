import type { NarreBehaviorSettings } from '@netior/shared/types';

export interface SystemPromptSchemaFieldSummary {
  name: string;
  field_type: string;
  required?: boolean;
  meaning_bindings?: string[];
  generated_by_model?: boolean;
  ref_schema_name?: string | null;
  option_source_schema_name?: string | null;
  options_preview?: string[] | null;
}

export interface SystemPromptSchemaMeaningSummary {
  key: string;
  label?: string | null;
  source?: string | null;
  source_model?: string | null;
  fields?: Array<{
    binding_id: string;
    field_id: string;
    required?: boolean;
  }>;
}

export interface SystemPromptSchemaSummary {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  node_shape?: string | null;
  description?: string | null;
  models?: string[];
  semantic_models?: string[];
  meanings?: SystemPromptSchemaMeaningSummary[];
  fields?: SystemPromptSchemaFieldSummary[];
}

export interface SystemPromptModelSummary {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  category?: string | null;
  meaning_keys?: string[];
  built_in?: boolean;
  recipe_meanings?: Array<{
    key: string;
    name: string;
    representation: string;
    fields: Array<{
      key: string;
      name: string;
      field_types: string[];
      required?: boolean;
    }>;
  }>;
}

export interface SystemPromptRelationTypeSummary {
  id: string;
  name: string;
  directed: boolean;
  line_style: string;
  color?: string | null;
  description?: string | null;
}

export interface SystemPromptTypeGroupSummary {
  id: string;
  kind: 'schema' | 'relation_type';
  path: string;
}

export interface SystemPromptNetworkSummary {
  id: string;
  name: string;
}

export interface SystemPromptNetworkTreeSummary {
  id: string;
  name: string;
  kind?: string;
  children?: SystemPromptNetworkTreeSummary[];
}

export interface SystemPromptParams {
  projectId: string;
  projectName: string;
  projectRootDir?: string | null;
  models: SystemPromptModelSummary[];
  schemas: SystemPromptSchemaSummary[];
  relationTypes: SystemPromptRelationTypeSummary[];
  typeGroups?: SystemPromptTypeGroupSummary[];
  universeNetwork?: SystemPromptNetworkSummary | null;
  ontologyNetwork?: SystemPromptNetworkSummary | null;
  networkTree?: SystemPromptNetworkTreeSummary[];
}

export const DEFAULT_NARRE_BEHAVIOR_SETTINGS: NarreBehaviorSettings = {
  graphPriority: 'strict',
  discourageLocalWorkspaceActions: true,
  extraInstructions: '',
};

export function normalizeNarreBehaviorSettings(value: unknown): NarreBehaviorSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NARRE_BEHAVIOR_SETTINGS };
  }

  const source = value as Record<string, unknown>;
  const graphPriority = source.graphPriority === 'balanced' ? 'balanced' : 'strict';
  const discourageLocalWorkspaceActions = source.discourageLocalWorkspaceActions !== false;
  const extraInstructions = typeof source.extraInstructions === 'string'
    ? source.extraInstructions.trim()
    : '';

  return {
    graphPriority,
    discourageLocalWorkspaceActions,
    extraInstructions,
  };
}

export function buildBehaviorGuidanceSection(behavior: NarreBehaviorSettings): string {
  return [
    '- Your primary job is to manage Netior modeling state: schemas, models, meanings, fields, relation types, concepts, networks, edges, files, and related instance metadata.',
    '- Treat requests as Netior modeling work by default, not as general software engineering or local coding work.',
    '- Prefer Netior/MCP tools and graph-object operations over browsing arbitrary local workspace files.',
    '- Interpret the user intent before naming implementation details. Start from the user\'s expected outcome, not from internal field or route names.',
    '- Classify each request as schema/model, instance, graph, organization, or network-view work before choosing tools.',
    '- For schema work, distinguish scalar fields, typed schema references, instance-backed choice structures, and model-backed meanings.',
    '- Prefer a small set of primitive families: schema/model discovery and mutation, instance discovery and mutation, candidate source discovery, and graph discovery and mutation.',
    '- Do not proactively create or manage modules or contexts in this phase. They are out of scope for Narre-owned changes.',
    behavior.graphPriority === 'strict'
      ? '- Stay anchored to the project graph. Do not drift into generic repo analysis unless the user explicitly asks for local file inspection.'
      : '- Keep the project graph as the default center of gravity, even when discussing nearby files or documents.',
    behavior.discourageLocalWorkspaceActions
      ? '- Do not inspect, edit, or reason about unrelated local workspace files unless the user explicitly requests that file-level work.'
      : '- Use local workspace inspection only when it materially helps with the requested Netior task.',
    ...(behavior.extraInstructions ? [`- Additional Narre instructions: ${behavior.extraInstructions}`] : []),
  ].join('\n');
}

const SEARCHABLE_FIELD_TYPES = new Set([
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi-select',
  'radio',
  'relation',
  'url',
  'rating',
  'tags',
  'schema_ref',
]);

function isRelationalField(field: SystemPromptSchemaFieldSummary): boolean {
  return field.field_type === 'relation' || field.field_type === 'schema_ref' || !!field.ref_schema_name;
}

function isSearchableField(field: SystemPromptSchemaFieldSummary): boolean {
  return (field.meaning_bindings?.length ?? 0) > 0 || SEARCHABLE_FIELD_TYPES.has(field.field_type);
}

function formatFieldType(fieldType: string): string {
  return fieldType === 'schema_ref' ? 'schema_ref' : fieldType;
}

function formatFieldSummary(field: SystemPromptSchemaFieldSummary): string {
  const models: string[] = [formatFieldType(field.field_type)];
  models.push(field.required ? 'required' : 'optional');

  if (field.meaning_bindings && field.meaning_bindings.length > 0) {
    models.push(`meanings=${field.meaning_bindings.join('|')}`);
  }

  if (field.generated_by_model) {
    models.push('model-generated');
  }

  if (field.ref_schema_name) {
    models.push(`target=${field.ref_schema_name}`);
  }

  if (field.option_source_schema_name) {
    models.push(`options-from=${field.option_source_schema_name}`);
  } else if (field.options_preview && field.options_preview.length > 0) {
    models.push(`options=${field.options_preview.join('|')}`);
  }

  return `${field.name} (${models.join(', ')})`;
}

function buildSchemaList(schemas: SystemPromptSchemaSummary[]): string {
  if (schemas.length === 0) {
    return '- (none defined yet)';
  }

  return schemas.map((schema) => {
    const fields = schema.fields ?? [];
    const propertyFields = fields.filter((field) => !isRelationalField(field));
    const relationalFields = fields.filter((field) => isRelationalField(field));
    const searchSurface = Array.from(new Set([
      'concept_title',
      ...fields
        .filter((field) => isSearchableField(field))
        .flatMap((field) => field.meaning_bindings && field.meaning_bindings.length > 0 ? field.meaning_bindings : [field.name]),
    ]));

    const profile = [
      `icon=${schema.icon ?? 'none'}`,
      `color=${schema.color ?? 'none'}`,
      `shape=${schema.node_shape ?? 'default'}`,
      ...(schema.description ? [`description=${schema.description}`] : []),
    ].join(', ');
    const overflow = fields.length > 10 ? `\n- more_fields=+${fields.length - 10}` : '';

    return [
      `### ${schema.name} [id=${schema.id}]`,
      `- profile=${profile}`,
      `- models=${schema.models && schema.models.length > 0 ? schema.models.join('|') : '(none)'}`,
      `- meanings=${schema.meanings && schema.meanings.length > 0 ? schema.meanings.map((meaning) => meaning.label ?? meaning.key).join('|') : '(none)'}`,
      `- properties=${propertyFields.length > 0 ? propertyFields.slice(0, 6).map(formatFieldSummary).join('; ') : '(none yet)'}`,
      `- field_relations=${relationalFields.length > 0 ? relationalFields.slice(0, 6).map(formatFieldSummary).join('; ') : '(none yet)'}`,
      `- search_surface=${searchSurface.join(', ')}`,
      overflow,
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function buildModelList(models: SystemPromptModelSummary[]): string {
  if (models.length === 0) {
    return '- (none defined yet)';
  }

  return models.map((model) => {
    const meaningLabels = model.recipe_meanings && model.recipe_meanings.length > 0
      ? model.recipe_meanings.map((meaning) => {
        const fields = meaning.fields.length > 0
          ? ` fields=${meaning.fields.map((field) => `${field.name}:${field.field_types.join('|')}`).join(',')}`
          : '';
        return `${meaning.name}(${meaning.representation}${fields})`;
      }).join('; ')
      : model.meaning_keys && model.meaning_keys.length > 0
        ? model.meaning_keys.join('|')
        : '(none)';
    const details = [
      `key=${model.key}`,
      `category=${model.category ?? 'none'}`,
      model.built_in ? 'built_in=true' : 'built_in=false',
      ...(model.description ? [`description=${model.description}`] : []),
    ];
    return `- ${model.name} [id=${model.id}]: ${details.join(', ')}; meanings=${meaningLabels}`;
  }).join('\n');
}

function buildRelationalSchemaSection(schemas: SystemPromptSchemaSummary[]): string {
  const lines: string[] = [];

  for (const schema of schemas) {
    for (const field of schema.fields ?? []) {
      if (!isRelationalField(field)) {
        continue;
      }

      const models = [
        `type=${formatFieldType(field.field_type)}`,
        field.required ? 'required' : 'optional',
        ...(field.meaning_bindings && field.meaning_bindings.length > 0 ? [`meanings=${field.meaning_bindings.join('|')}`] : []),
        ...(field.generated_by_model ? ['model-generated'] : []),
      ];
      lines.push(
        `- ${schema.name}.${field.name} -> ${field.ref_schema_name ?? 'untyped'} [${models.join(', ')}]`,
      );
    }
  }

  if (lines.length === 0) {
    return '- (none modeled yet)';
  }

  return lines.join('\n');
}

function buildRelationTypeList(relationTypes: SystemPromptRelationTypeSummary[]): string {
  if (relationTypes.length === 0) {
    return '- (none defined yet)';
  }

  return relationTypes.map((relationType) => {
    const details = [
      `directed=${relationType.directed}`,
      `style=${relationType.line_style}`,
      `color=${relationType.color ?? 'none'}`,
    ];
    if (relationType.description) {
      details.push(`description=${relationType.description}`);
    }
    return `- ${relationType.name} [id=${relationType.id}]: ${details.join(', ')}`;
  }).join('\n');
}

function buildTypeGroupSection(typeGroups: SystemPromptTypeGroupSummary[] | undefined): string {
  if (!typeGroups || typeGroups.length === 0) {
    return '- (none defined yet)';
  }

  return typeGroups
    .map((group) => `- ${group.kind === 'schema' ? 'schema' : group.kind} [id=${group.id}]: ${group.path}`)
    .join('\n');
}

function collectNetworkTreeLines(
  nodes: SystemPromptNetworkTreeSummary[] | undefined,
  depth: number,
  lines: string[],
  maxLines: number,
): void {
  if (!nodes || nodes.length === 0 || lines.length >= maxLines) {
    return;
  }

  for (const node of nodes) {
    if (lines.length >= maxLines) {
      return;
    }
    const kind = node.kind ? `, kind=${node.kind}` : '';
    lines.push(`${'  '.repeat(depth)}- ${node.name} [id=${node.id}${kind}]`);
    collectNetworkTreeLines(node.children, depth + 1, lines, maxLines);
  }
}

function buildNetworkContextSection(
  universeNetwork: SystemPromptNetworkSummary | null | undefined,
  ontologyNetwork: SystemPromptNetworkSummary | null | undefined,
  networkTree: SystemPromptNetworkTreeSummary[] | undefined,
): string {
  const lines: string[] = [
    `- universe=${universeNetwork ? `${universeNetwork.name} [id=${universeNetwork.id}]` : 'none'}`,
    `- ontology=${ontologyNetwork ? `${ontologyNetwork.name} [id=${ontologyNetwork.id}]` : 'none'}`,
    '- universe_role=app-wide project portal network; do not edit it like a normal network',
    '- ontology_role=project type network for schemas, models, relation types, type groups, and their relations',
  ];

  const treeLines: string[] = [];
  collectNetworkTreeLines(networkTree, 0, treeLines, 12);
  lines.push(treeLines.length > 0 ? '- tree_preview:' : '- tree_preview: (none yet)');
  if (treeLines.length > 0) {
    lines.push(...treeLines);
    const hasOverflow = JSON.stringify(networkTree ?? []).length > 0 && treeLines.length === 12;
    if (hasOverflow) {
      lines.push('- ...');
    }
  }

  return lines.join('\n');
}

export function buildSystemPrompt(
  params: SystemPromptParams,
  behavior: NarreBehaviorSettings = DEFAULT_NARRE_BEHAVIOR_SETTINGS,
): string {
  const {
    projectId,
    projectName,
    projectRootDir,
    models,
    schemas,
    relationTypes,
    typeGroups,
    networkTree,
  } = params;
  const universeNetwork = params.universeNetwork;
  const ontologyNetwork = params.ontologyNetwork;

  const modelList = buildModelList(models);
  const schemaList = buildSchemaList(schemas);
  const relationalSchema = buildRelationalSchemaSection(schemas);
  const relationTypeList = buildRelationTypeList(relationTypes);
  const typeGroupList = buildTypeGroupSection(typeGroups);
  const networkContext = buildNetworkContextSection(universeNetwork, ontologyNetwork, networkTree);

  return `You are Narre, the AI assistant for Netior (Map of Concepts).
You help users model and organize a Netior project graph.

## Current Execution
- current_project_id=${projectId}
- current_project_name=${projectName}
- current_project_root=${projectRootDir ?? '(unknown)'}

The active project is already fixed for this run. Do not search for which project to use unless the user explicitly asks for cross-project work.

## Project Modeling Digest
Use this digest as the primary search surface before calling tools.

## Models (${models.length})
${modelList}

## Schema Search Surfaces (${schemas.length})
${schemaList}

## Field Relation Map
${relationalSchema}

## Relation Types (${relationTypes.length})
${relationTypeList}

## Type Groups
${typeGroupList}

## Network Context
${networkContext}

## Search Strategy
- Start from the modeling digest in this prompt: models, meanings, fields, meaning bindings, field relations, relation types, and network hierarchy.
- For bootstrap or early-structure work, reason ontology-first: infer entity kinds, relation kinds, artifact kinds, and workflow structure before deciding network splits or schemas.
- Treat networks as a workspace projection of inferred ontology, not as the first thing the user must specify.
- Before searching concepts, infer these three things first:
  1. likely target schema
  2. likely fields or meaning bindings
  3. whether another schema must be resolved first through a typed reference
- Treat field relations like an ORM map:
  - if Task.owner -> Person exists, resolve Person first when the user searches by owner
  - if Document.supersedes -> Document exists, use that typed field before inventing a graph edge search
- Distinguish these layers:
  - object, schema, or model change
  - concept instance search or mutation
  - node placement or network structure change
  - layout/view change
  - type organization change
- Use relation types for graph-edge meaning.
- Use schema fields for concept property filtering, typed references, and type-level relations.
- Ask a short confirmation only when the structural meaning can materially diverge:
  - field vs edge
  - inline enum vs instance-backed choice
  - single vs multi
  - required vs optional
  - merge/split/refactor/migration that may change existing data

## Tool Policy
- Stable project schemas, models, field search surfaces, and network hierarchy index are already in this prompt. Do not broad-search for them again unless the live state may have diverged.
- Prefer this decision order:
  1. mentioned object
  2. prompt digest
  3. targeted lookup
  4. broad discovery
- Use tools for live state, IDs that are still missing, membership, current values, ambiguity resolution, candidate sets, and destructive-change verification.
- Do not re-fetch schema lists, model lists, relation type lists, type groups, or network hierarchy just because those tools exist.
- The active project is already bound for this run. Do not search for project identity or pass raw 'project_id' values unless the user explicitly asks for cross-project work.
- When a tool supports default project binding, omit 'project_id' and use the current project by default.
- Prefer one precise inspection over multiple exploratory searches.

## Guidelines
- When the project has little or no structure, proactively suggest a bootstrap based on the project topic. Start from the domain, infer ontology first, then project it into likely networks, schemas, models, meanings, and fields. Avoid making the user choose Netior-internal structures prematurely.
- Always confirm before destructive operations (delete, bulk modify).
- When deleting an entity with dependent data, warn about cascading effects.
- Respond in the same language the user uses.
- Be concise and action-oriented.
- Before searching or mutating concepts, identify the target schema and likely fields or meaning bindings from the modeling digest first.
- For field-level schema work, inspect fields, meanings, and concept properties before changing relationship structure.
- Before assigning reference or choice values, inspect the candidate set instead of guessing from memory.
- Use graph primitives when the user is talking about network structure, navigation hierarchy, node placement, or independent object-to-object relations in the graph.
- Do not replace a true graph relation with a field just because a field tool exists, and do not replace a schema field with an edge just because a graph tool exists.
- When creating multiple entities, execute tool calls sequentially and report progress.
${buildBehaviorGuidanceSection(behavior)}`;
}
