import type { NarreBehaviorSettings } from '@netior/shared/types';

export interface SystemPromptArchetypeFieldSummary {
  name: string;
  field_type: string;
  required?: boolean;
  ref_archetype_name?: string | null;
  option_source_archetype_name?: string | null;
  options_preview?: string[] | null;
}

export interface SystemPromptArchetypeSummary {
  name: string;
  icon?: string | null;
  color?: string | null;
  node_shape?: string | null;
  description?: string | null;
  fields?: SystemPromptArchetypeFieldSummary[];
}

export interface SystemPromptRelationTypeSummary {
  name: string;
  directed: boolean;
  line_style: string;
  color?: string | null;
  description?: string | null;
}

export interface SystemPromptTypeGroupSummary {
  kind: 'archetype' | 'relation_type';
  path: string;
}

export interface SystemPromptNetworkSummary {
  id: string;
  name: string;
}

export interface SystemPromptNetworkTreeSummary {
  id: string;
  name: string;
  children?: SystemPromptNetworkTreeSummary[];
}

export interface SystemPromptParams {
  projectName: string;
  projectRootDir?: string | null;
  archetypes: SystemPromptArchetypeSummary[];
  relationTypes: SystemPromptRelationTypeSummary[];
  typeGroups?: SystemPromptTypeGroupSummary[];
  appRootNetwork?: SystemPromptNetworkSummary | null;
  projectRootNetwork?: SystemPromptNetworkSummary | null;
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
    '- Your primary job is to manage Netior modeling state: archetypes, relation types, concepts, networks, edges, files, and related schema/instance metadata.',
    '- Treat requests as Netior modeling work by default, not as general software engineering or local coding work.',
    '- Prefer Netior/MCP tools and graph-object operations over browsing arbitrary local workspace files.',
    '- Interpret the user intent before naming implementation details. Start from the user\'s expected outcome, not from internal field or route names.',
    '- Classify each request as schema, instance, graph, organization, or network-view work before choosing tools.',
    '- For schema work, distinguish scalar fields, typed archetype references, and instance-backed choice structures.',
    '- Prefer a small set of primitive families: schema discovery/mutation, instance discovery/mutation, candidate source discovery, and graph discovery/mutation.',
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

function formatFieldSummary(field: SystemPromptArchetypeFieldSummary): string {
  const facets: string[] = [field.field_type];
  facets.push(field.required ? 'required' : 'optional');

  if (field.ref_archetype_name) {
    facets.push(`target=${field.ref_archetype_name}`);
  }

  if (field.option_source_archetype_name) {
    facets.push(`options-from=${field.option_source_archetype_name}`);
  } else if (field.options_preview && field.options_preview.length > 0) {
    facets.push(`options=${field.options_preview.join('|')}`);
  }

  return `${field.name} (${facets.join(', ')})`;
}

function buildArchetypeList(archetypes: SystemPromptArchetypeSummary[]): string {
  if (archetypes.length === 0) {
    return '- (none defined yet)';
  }

  return archetypes.map((archetype) => {
    const details = [
      `icon=${archetype.icon ?? 'none'}`,
      `color=${archetype.color ?? 'none'}`,
      `shape=${archetype.node_shape ?? 'default'}`,
    ];
    if (archetype.description) {
      details.push(`description=${archetype.description}`);
    }

    const fields = archetype.fields ?? [];
    if (fields.length === 0) {
      return `- ${archetype.name}: ${details.join(', ')}; fields=(none yet)`;
    }

    const fieldPreview = fields.slice(0, 6).map(formatFieldSummary).join('; ');
    const overflow = fields.length > 6 ? `; +${fields.length - 6} more fields` : '';
    return `- ${archetype.name}: ${details.join(', ')}; fields=${fieldPreview}${overflow}`;
  }).join('\n');
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
    return `- ${relationType.name}: ${details.join(', ')}`;
  }).join('\n');
}

function buildTypeGroupSection(typeGroups: SystemPromptTypeGroupSummary[] | undefined): string {
  if (!typeGroups || typeGroups.length === 0) {
    return '- (none defined yet)';
  }

  return typeGroups
    .map((group) => `- ${group.kind}: ${group.path}`)
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
    lines.push(`${'  '.repeat(depth)}- ${node.name}`);
    collectNetworkTreeLines(node.children, depth + 1, lines, maxLines);
  }
}

function buildNetworkContextSection(
  appRootNetwork: SystemPromptNetworkSummary | null | undefined,
  projectRootNetwork: SystemPromptNetworkSummary | null | undefined,
  networkTree: SystemPromptNetworkTreeSummary[] | undefined,
): string {
  const lines: string[] = [
    `- app_root=${appRootNetwork?.name ?? 'none'}`,
    `- project_root=${projectRootNetwork?.name ?? 'none'}`,
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
    projectName,
    projectRootDir,
    archetypes,
    relationTypes,
    typeGroups,
    appRootNetwork,
    projectRootNetwork,
    networkTree,
  } = params;

  const archetypeList = buildArchetypeList(archetypes);
  const relationTypeList = buildRelationTypeList(relationTypes);
  const typeGroupList = buildTypeGroupSection(typeGroups);
  const networkContext = buildNetworkContextSection(appRootNetwork, projectRootNetwork, networkTree);

  return `You are Narre, the AI assistant for Netior (Map of Concepts).
You help users organize concepts in their project.

## Current Project: ${projectName}
${projectRootDir ? `Project root directory: ${projectRootDir}` : 'Project root directory: (unknown)'}

## Archetypes (${archetypes.length})
${archetypeList}

## Relation Types (${relationTypes.length})
${relationTypeList}

## Type Groups
${typeGroupList}

## Network Context
${networkContext}

## Interpretation Model
- Start from the user's internal expectation, not from Netior implementation vocabulary.
- First decide whether the request is about schema, instance data, graph relations, organization, or network/view structure.
- For schema work, distinguish three common cases:
  - scalar field: simple property like name, level, price, description
  - typed archetype reference: one archetype structurally has another archetype
  - instance-backed choice: a field chooses from real concepts/objects instead of fixed inline options
- Use natural-language defaults:
  - "A has B", "A has a B sheet/profile" -> typed archetype reference candidate
  - "choose among B", "equip B", "pick from registered B" -> instance-backed choice candidate
  - "belongs to", "references", "connects to" -> graph edge candidate
  - "group these types", "folder-like organization" -> type-group candidate
  - "show under", "root hierarchy", "separate network" -> network/view candidate
- Ask a short confirmation only when the structural meaning can materially diverge:
  - field vs edge
  - inline enum vs instance-backed choice
  - single vs multi
  - required vs optional
  - merge/split/refactor/migration that may change existing data

## Guidelines
- When the project has no types defined, proactively suggest an initialization based on the project topic. Ask what domain the project covers and propose a type system.
- Always confirm before destructive operations (delete, bulk modify).
- When deleting an entity with dependent data, warn about cascading effects.
- Respond in the same language the user uses.
- Be concise and action-oriented.
- Use the available tools to query and modify data. Concept lists should be fetched via the list_concepts tool rather than being memorized.
- Use project/schema discovery tools before making high-impact modeling changes.
- For field-level schema work, inspect archetype field contracts and concept properties before changing relationship structure.
- Before assigning reference or choice values, inspect the candidate set instead of guessing from memory.
- Use graph primitives when the user is talking about network structure, navigation hierarchy, node placement, or independent object-to-object relations in the graph.
- Do not replace a true graph relation with a field just because a field tool exists, and do not replace a field contract with an edge just because a graph tool exists.
- When creating multiple entities, execute tool calls sequentially and report progress.
${buildBehaviorGuidanceSection(behavior)}`;
}
