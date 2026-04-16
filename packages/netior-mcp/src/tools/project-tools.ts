import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ArchetypeField, NetworkTreeNode, TypeGroup } from '@netior/shared/types';
import {
  getAppRootNetwork,
  getProjectById,
  getProjectRootNetwork,
  getNetworkTree,
  listArchetypeFields,
  listArchetypes,
  listRelationTypes,
  listTypeGroups,
  getConceptsByProject,
  listNetworks,
} from '../netior-service-client.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';

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

function mapTypeGroups(groups: TypeGroup[]): Array<{ id: string; kind: string; path: string }> {
  const pathMap = buildTypeGroupPathMap(groups);
  return groups.map((group) => ({
    id: group.id,
    kind: group.kind,
    path: pathMap.get(group.id) ?? group.name,
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
): Array<{
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  ref_archetype_name?: string;
  options_preview?: string[];
}> {
  return fields.map((field) => {
    const optionsPreview = buildOptionsPreview(field.options);

    return {
      id: field.id,
      name: field.name,
      field_type: field.field_type,
      required: field.required,
      ...(field.ref_archetype_id
        ? { ref_archetype_name: archetypeNames.get(field.ref_archetype_id) ?? field.ref_archetype_id }
        : {}),
      ...(optionsPreview ? { options_preview: optionsPreview } : {}),
    };
  });
}

interface ProjectSummaryNetworkTreeNode {
  id: string;
  name: string;
  children: ProjectSummaryNetworkTreeNode[];
}

function mapNetworkTree(nodes: NetworkTreeNode[]): ProjectSummaryNetworkTreeNode[] {
  return nodes.map((node) => ({
    id: node.network.id,
    name: node.network.name,
    children: mapNetworkTree(node.children),
  }));
}

export function registerProjectTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'get_project_summary',
    { project_id: projectIdSchema() },
    async ({ project_id }) => {
      try {
        const targetProjectId = resolveProjectId(project_id);
        const project = await getProjectById(targetProjectId);
        if (!project) {
          return {
            content: [{ type: 'text' as const, text: `Error: Project not found: ${targetProjectId}` }],
            isError: true,
          };
        }

        const [
          archetypes,
          relationTypes,
          concepts,
          networks,
          archetypeGroups,
          relationTypeGroups,
          appRootNetwork,
          projectRootNetwork,
          networkTree,
        ] = await Promise.all([
          listArchetypes(targetProjectId),
          listRelationTypes(targetProjectId),
          getConceptsByProject(targetProjectId),
          listNetworks(targetProjectId),
          listTypeGroups(targetProjectId, 'archetype'),
          listTypeGroups(targetProjectId, 'relation_type'),
          getAppRootNetwork(),
          getProjectRootNetwork(targetProjectId),
          getNetworkTree(targetProjectId),
        ]);
        const archetypeNameMap = new Map<string, string>(archetypes.map((archetype) => [archetype.id, archetype.name]));
        const archetypeFieldsById = new Map<string, ArchetypeField[]>(
          await Promise.all(
            archetypes.map(async (archetype) => [archetype.id, await listArchetypeFields(archetype.id)] as const),
          ),
        );
        const typeGroups = mapTypeGroups([...archetypeGroups, ...relationTypeGroups]);

        const summary = {
          project: {
            id: project.id,
            name: project.name,
            root_dir: project.root_dir,
          },
          archetypes: {
            count: archetypes.length,
            items: archetypes.map((archetype) => ({
              id: archetype.id,
              name: archetype.name,
              icon: archetype.icon,
              color: archetype.color,
              node_shape: archetype.node_shape,
              description: archetype.description,
              fields: mapArchetypeFields(archetypeFieldsById.get(archetype.id) ?? [], archetypeNameMap),
            })),
          },
          relation_types: {
            count: relationTypes.length,
            items: relationTypes.map((relationType) => ({
              id: relationType.id,
              name: relationType.name,
              directed: relationType.directed,
              line_style: relationType.line_style,
              color: relationType.color,
              description: relationType.description,
            })),
          },
          type_groups: {
            count: typeGroups.length,
            items: typeGroups,
          },
          concepts: {
            count: concepts.length,
            items: concepts.map((c) => ({ id: c.id, title: c.title, archetype_id: c.archetype_id })),
          },
          networks: {
            count: networks.length,
            items: networks.map((n) => ({ id: n.id, name: n.name, parent_network_id: n.parent_network_id })),
          },
          root_networks: {
            app_root: appRootNetwork ? { id: appRootNetwork.id, name: appRootNetwork.name } : null,
            project_root: projectRootNetwork ? { id: projectRootNetwork.id, name: projectRootNetwork.name } : null,
          },
          network_tree: mapNetworkTree(networkTree),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
