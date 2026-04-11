import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getProjectById,
  listArchetypes,
  listRelationTypes,
  getConceptsByProject,
  listNetworks,
} from '../netior-service-client.js';

export function registerProjectTools(server: McpServer): void {
  server.tool(
    'get_project_summary',
    'Get a summary of a project including counts and names of archetypes, relation types, concepts, and networks',
    { project_id: z.string().describe('The project ID') },
    async ({ project_id }) => {
      try {
        const project = await getProjectById(project_id);
        if (!project) {
          return {
            content: [{ type: 'text' as const, text: `Error: Project not found: ${project_id}` }],
            isError: true,
          };
        }

        const archetypes = await listArchetypes(project_id);
        const relationTypes = await listRelationTypes(project_id);
        const concepts = await getConceptsByProject(project_id);
        const networks = await listNetworks(project_id);

        const summary = {
          project: {
            id: project.id,
            name: project.name,
            root_dir: project.root_dir,
          },
          archetypes: {
            count: archetypes.length,
            items: archetypes.map((a) => ({ id: a.id, name: a.name, icon: a.icon, color: a.color })),
          },
          relation_types: {
            count: relationTypes.length,
            items: relationTypes.map((r) => ({ id: r.id, name: r.name, directed: r.directed, line_style: r.line_style })),
          },
          concepts: {
            count: concepts.length,
            items: concepts.map((c) => ({ id: c.id, title: c.title, archetype_id: c.archetype_id })),
          },
          networks: {
            count: networks.length,
            items: networks.map((n) => ({ id: n.id, name: n.name, parent_network_id: n.parent_network_id })),
          },
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
