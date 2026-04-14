import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getConceptsByProject,
  searchConcepts,
  createConcept,
  updateConcept,
  deleteConcept,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';

export function registerConceptTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_concepts',
    {
      project_id: z.string().describe('The project ID'),
      query: z.string().optional().describe('Search query to filter concepts by title'),
    },
    async ({ project_id, query }) => {
      try {
        const result = query
          ? await searchConcepts(project_id, query)
          : await getConceptsByProject(project_id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  registerNetiorTool(
    server,
    'create_concept',
    {
      project_id: z.string().describe('The project ID'),
      title: z.string().describe('Concept title'),
      archetype_id: z.string().optional().describe('Archetype ID to assign'),
      color: z.string().optional().describe('Color value'),
      icon: z.string().optional().describe('Icon identifier'),
    },
    async ({ project_id, title, archetype_id, color, icon }) => {
      try {
        const result = await createConcept({
          project_id,
          title,
          archetype_id,
          color,
          icon,
        });
        emitChange({ type: 'concept', action: 'create', id: result.id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  registerNetiorTool(
    server,
    'update_concept',
    {
      concept_id: z.string().describe('The concept ID to update'),
      title: z.string().optional().describe('New title'),
      archetype_id: z.string().optional().describe('New archetype ID'),
      color: z.string().optional().describe('New color value'),
      icon: z.string().optional().describe('New icon identifier'),
    },
    async ({ concept_id, title, archetype_id, color, icon }) => {
      try {
        const result = await updateConcept(concept_id, {
          title,
          archetype_id,
          color,
          icon,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Concept not found: ${concept_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'concept', action: 'update', id: concept_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  registerNetiorTool(
    server,
    'delete_concept',
    { concept_id: z.string().describe('The concept ID to delete') },
    async ({ concept_id }) => {
      try {
        const deleted = await deleteConcept(concept_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Concept not found: ${concept_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'concept', action: 'delete', id: concept_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: concept_id }) }],
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
