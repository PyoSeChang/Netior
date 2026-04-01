import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getProjectById,
  listArchetypes,
  listRelationTypes,
  listCanvasTypes,
  getConceptsByProject,
  listCanvases,
} from '@netior/core';

export function registerProjectTools(server: McpServer): void {
  server.tool(
    'get_project_summary',
    'Get a summary of a project including counts and names of archetypes, relation types, canvas types, concepts, and canvases',
    { project_id: z.string().describe('The project ID') },
    async ({ project_id }) => {
      try {
        const project = getProjectById(project_id);
        if (!project) {
          return {
            content: [{ type: 'text' as const, text: `Error: Project not found: ${project_id}` }],
            isError: true,
          };
        }

        const archetypes = listArchetypes(project_id);
        const relationTypes = listRelationTypes(project_id);
        const canvasTypes = listCanvasTypes(project_id);
        const concepts = getConceptsByProject(project_id);
        const canvases = listCanvases(project_id);

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
          canvas_types: {
            count: canvasTypes.length,
            items: canvasTypes.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color })),
          },
          concepts: {
            count: concepts.length,
            items: concepts.map((c) => ({ id: c.id, title: c.title, archetype_id: c.archetype_id })),
          },
          canvases: {
            count: canvases.length,
            items: canvases.map((c) => ({ id: c.id, name: c.name, concept_id: c.concept_id })),
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
