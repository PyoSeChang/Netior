import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SchemaField, NetworkTreeNode, TypeGroup } from '@netior/shared/types';
import {
  getUniverseNetwork,
  getProjectById,
  getProjectOntologyNetwork,
  getNetworkTree,
  listSchemaFields,
  listSchemas,
  listRelationTypes,
  listTypeGroups,
  getConceptsByProject,
  listNetworks,
} from '../netior-service-client.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';
import { toAgentConcept, toAgentFieldType, toAgentTypeGroupKind } from './schema-surface.js';

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
    kind: toAgentTypeGroupKind(group.kind),
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

function mapSchemaFields(
  fields: SchemaField[],
  schemaNames: Map<string, string>,
): Array<{
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  ref_schema_name?: string;
  options_preview?: string[];
}> {
  return fields.map((field) => {
    const optionsPreview = buildOptionsPreview(field.options);

    return {
      id: field.id,
      name: field.name,
      field_type: toAgentFieldType(field.field_type),
      required: field.required,
      ...(field.ref_schema_id
        ? { ref_schema_name: schemaNames.get(field.ref_schema_id) ?? field.ref_schema_id }
        : {}),
      ...(optionsPreview ? { options_preview: optionsPreview } : {}),
    };
  });
}

interface ProjectSummaryNetworkTreeNode {
  id: string;
  name: string;
  kind: string;
  children: ProjectSummaryNetworkTreeNode[];
}

function mapNetworkTree(nodes: NetworkTreeNode[]): ProjectSummaryNetworkTreeNode[] {
  return nodes.map((node) => ({
    id: node.network.id,
    name: node.network.name,
    kind: node.network.kind,
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
          schemas,
          relationTypes,
          concepts,
          networks,
          schemaGroups,
          relationTypeGroups,
          universeNetwork,
          ontologyNetwork,
          networkTree,
        ] = await Promise.all([
          listSchemas(targetProjectId),
          listRelationTypes(targetProjectId),
          getConceptsByProject(targetProjectId),
          listNetworks(targetProjectId),
          listTypeGroups(targetProjectId, 'schema'),
          listTypeGroups(targetProjectId, 'relation_type'),
          getUniverseNetwork(),
          getProjectOntologyNetwork(targetProjectId),
          getNetworkTree(targetProjectId),
        ]);
        const schemaNameMap = new Map<string, string>(schemas.map((schema) => [schema.id, schema.name]));
        const schemaFieldsById = new Map<string, SchemaField[]>(
          await Promise.all(
            schemas.map(async (schema) => [schema.id, await listSchemaFields(schema.id)] as const),
          ),
        );
        const typeGroups = mapTypeGroups([...schemaGroups, ...relationTypeGroups]);

        const summary = {
          project: {
            id: project.id,
            name: project.name,
            root_dir: project.root_dir,
          },
          schemas: {
            count: schemas.length,
            items: schemas.map((schema) => ({
              id: schema.id,
              name: schema.name,
              icon: schema.icon,
              color: schema.color,
              node_shape: schema.node_shape,
              description: schema.description,
              fields: mapSchemaFields(schemaFieldsById.get(schema.id) ?? [], schemaNameMap),
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
            items: concepts.map((concept) => {
              const agentConcept = toAgentConcept(concept);
              return { id: agentConcept.id, title: agentConcept.title, schema_id: agentConcept.schema_id };
            }),
          },
          networks: {
            count: networks.length,
            items: networks.map((n) => ({ id: n.id, name: n.name, kind: n.kind, parent_network_id: n.parent_network_id })),
          },
          system_networks: {
            universe: universeNetwork ? { id: universeNetwork.id, name: universeNetwork.name } : null,
            ontology: ontologyNetwork ? { id: ontologyNetwork.id, name: ontologyNetwork.name } : null,
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
