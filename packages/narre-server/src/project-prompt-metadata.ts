import type { ArchetypeField, NetworkTreeNode, TypeGroup } from '@netior/shared/types';
import type { SystemPromptParams, SystemPromptTypeGroupSummary } from './system-prompt.js';
import {
  getProjectOntologyNetwork,
  getNetworkTree,
  getProjectById,
  getUniverseNetwork,
  listArchetypeFields,
  listArchetypes,
  listRelationTypes,
  listTypeGroups,
} from './netior-service-client.js';

function buildTypeGroupPathMap(groups: TypeGroup[]): Map<string, string> {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const cache = new Map<string, string>();

  const resolvePath = (group: TypeGroup): string => {
    const cached = cache.get(group.id);
    if (cached) {
      return cached;
    }

    const parent = group.parent_group_id ? byId.get(group.parent_group_id) : null;
    const path = parent ? `${resolvePath(parent)}/${group.name}` : group.name;
    cache.set(group.id, path);
    return path;
  };

  for (const group of groups) {
    resolvePath(group);
  }

  return cache;
}

function mapTypeGroups(groups: TypeGroup[]): SystemPromptTypeGroupSummary[] {
  const pathMap = buildTypeGroupPathMap(groups);
  return groups.map((group) => ({
    id: group.id,
    kind: group.kind,
    path: pathMap.get(group.id) ?? group.name,
  }));
}

function mapNetworkTree(nodes: NetworkTreeNode[]): NonNullable<SystemPromptParams['networkTree']> {
  return nodes.map((node) => ({
    id: node.network.id,
    name: node.network.name,
    kind: node.network.kind,
    children: mapNetworkTree(node.children),
  }));
}

function buildOptionsPreview(options: string | null): string[] | undefined {
  if (!options) {
    return undefined;
  }

  const values = options
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return undefined;
  }

  return values.slice(0, 5);
}

function mapArchetypeFields(
  fields: ArchetypeField[],
  archetypeNames: Map<string, string>,
): NonNullable<SystemPromptParams['archetypes'][number]['fields']> {
  return fields.map((field) => {
    const optionsPreview = buildOptionsPreview(field.options);

    return {
      name: field.name,
      field_type: field.field_type,
      required: field.required,
      ...(field.semantic_annotation ? { semantic_annotation: field.semantic_annotation } : {}),
      ...(field.system_slot ? { system_slot: field.system_slot } : {}),
      ...(field.generated_by_trait ? { generated_by_trait: true } : {}),
      ...(field.ref_archetype_id
        ? { ref_archetype_name: archetypeNames.get(field.ref_archetype_id) ?? field.ref_archetype_id }
        : {}),
      ...(optionsPreview ? { options_preview: optionsPreview } : {}),
    };
  });
}

export async function buildProjectPromptMetadata(projectId: string): Promise<SystemPromptParams> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const [
    archetypes,
    relationTypes,
    archetypeGroups,
    relationTypeGroups,
    universeNetwork,
    ontologyNetwork,
    networkTree,
  ] = await Promise.all([
    listArchetypes(projectId),
    listRelationTypes(projectId),
    listTypeGroups(projectId, 'archetype'),
    listTypeGroups(projectId, 'relation_type'),
    getUniverseNetwork(),
    getProjectOntologyNetwork(projectId),
    getNetworkTree(projectId),
  ]);

  const archetypeNameMap = new Map<string, string>(archetypes.map((archetype) => [archetype.id, archetype.name]));
  const archetypeFieldsById = new Map<string, ArchetypeField[]>(
    await Promise.all(
      archetypes.map(async (archetype) => [archetype.id, await listArchetypeFields(archetype.id)] as const),
    ),
  );
  const typeGroups = mapTypeGroups([...archetypeGroups, ...relationTypeGroups]);

  return {
    projectId,
    projectName: project.name,
    projectRootDir: project.root_dir,
    archetypes: archetypes.map((archetype) => ({
      id: archetype.id,
      name: archetype.name,
      icon: archetype.icon,
      color: archetype.color,
      node_shape: archetype.node_shape,
      description: archetype.description,
      facets: archetype.facets ?? archetype.semantic_traits,
      semantic_traits: archetype.semantic_traits,
      fields: mapArchetypeFields(archetypeFieldsById.get(archetype.id) ?? [], archetypeNameMap),
    })),
    relationTypes: relationTypes.map((relationType) => ({
      id: relationType.id,
      name: relationType.name,
      directed: relationType.directed,
      line_style: relationType.line_style,
      color: relationType.color,
      description: relationType.description,
    })),
    typeGroups,
    universeNetwork: universeNetwork
      ? { id: universeNetwork.id, name: universeNetwork.name }
      : null,
    ontologyNetwork: ontologyNetwork
      ? { id: ontologyNetwork.id, name: ontologyNetwork.name }
      : null,
    networkTree: mapNetworkTree(networkTree),
  };
}
