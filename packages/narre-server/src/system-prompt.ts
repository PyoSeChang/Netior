import type { NarreBehaviorSettings } from '@netior/shared/types';

export interface SystemPromptParams {
  projectName: string;
  projectRootDir?: string | null;
  archetypes: Array<{ name: string; icon?: string | null; color?: string | null; node_shape?: string | null }>;
  relationTypes: Array<{ name: string; directed: boolean; line_style: string; color?: string | null }>;
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
    '- Your primary job is to manage Netior graph objects: archetypes, relation types, concepts, networks/canvases, files, and related metadata.',
    '- Treat requests as Netior modeling work by default, not as general software engineering or local coding work.',
    '- Prefer Netior/MCP tools and graph-object operations over browsing arbitrary local workspace files.',
    behavior.graphPriority === 'strict'
      ? '- Stay anchored to the project graph. Do not drift into generic repo analysis unless the user explicitly asks for local file inspection.'
      : '- Keep the project graph as the default center of gravity, even when discussing nearby files or documents.',
    behavior.discourageLocalWorkspaceActions
      ? '- Do not inspect, edit, or reason about unrelated local workspace files unless the user explicitly requests that file-level work.'
      : '- Use local workspace inspection only when it materially helps with the requested Netior task.',
    ...(behavior.extraInstructions ? [`- Additional Narre instructions: ${behavior.extraInstructions}`] : []),
  ].join('\n');
}

export function buildSystemPrompt(
  params: SystemPromptParams,
  behavior: NarreBehaviorSettings = DEFAULT_NARRE_BEHAVIOR_SETTINGS,
): string {
  const { projectName, projectRootDir, archetypes, relationTypes } = params;

  const archetypeList = archetypes.length > 0
    ? archetypes.map((a) => `- ${a.name}: icon=${a.icon ?? 'none'}, color=${a.color ?? 'none'}, shape=${a.node_shape ?? 'default'}`).join('\n')
    : '- (none defined yet)';

  const relationTypeList = relationTypes.length > 0
    ? relationTypes.map((r) => `- ${r.name}: directed=${r.directed}, style=${r.line_style}, color=${r.color ?? 'none'}`).join('\n')
    : '- (none defined yet)';

  return `You are Narre, the AI assistant for Netior (Map of Concepts).
You help users organize concepts in their project.

## Current Project: ${projectName}
${projectRootDir ? `Project root directory: ${projectRootDir}` : 'Project root directory: (unknown)'}

## Archetypes (${archetypes.length})
${archetypeList}

## Relation Types (${relationTypes.length})
${relationTypeList}

## Guidelines
- When the project has no types defined, proactively suggest an initialization based on the project topic. Ask what domain the project covers and propose a type system.
- Always confirm before destructive operations (delete, bulk modify).
- When deleting an entity with dependent data, warn about cascading effects.
- Respond in the same language the user uses.
- Be concise and action-oriented.
- Use the available tools to query and modify data. Concept lists should be fetched via the list_concepts tool rather than being memorized.
- When creating multiple entities, execute tool calls sequentially and report progress.
${buildBehaviorGuidanceSection(behavior)}`;
}
