import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  listArchetypes,
  createArchetype,
  updateArchetype,
  deleteArchetype,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';

export function registerArchetypeTools(server: McpServer): void {
  server.tool(
    'list_archetypes',
    'List all archetypes for a project',
    { project_id: z.string().describe('The project ID') },
    async ({ project_id }) => {
      try {
        const result = await listArchetypes(project_id);
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

  server.tool(
    'create_archetype',
    'Create a new archetype for a project',
    {
      project_id: z.string().describe('The project ID'),
      name: z.string().describe('Archetype name'),
      icon: z.string().optional().describe('Icon identifier'),
      color: z.string().optional().describe('Color value'),
      node_shape: z.string().optional().describe('Node shape for network rendering'),
      description: z.string().optional().describe('Archetype description'),
    },
    async ({ project_id, name, icon, color, node_shape, description }) => {
      try {
        const result = await createArchetype({
          project_id,
          name,
          icon,
          color,
          node_shape,
          description,
        });
        emitChange({ type: 'archetype', action: 'create', id: result.id });
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

  server.tool(
    'update_archetype',
    'Update an existing archetype',
    {
      archetype_id: z.string().describe('The archetype ID to update'),
      name: z.string().optional().describe('New name'),
      icon: z.string().optional().describe('New icon identifier'),
      color: z.string().optional().describe('New color value'),
      node_shape: z.string().optional().describe('New node shape'),
      description: z.string().optional().describe('New description'),
    },
    async ({ archetype_id, name, icon, color, node_shape, description }) => {
      try {
        const result = await updateArchetype(archetype_id, {
          name,
          icon,
          color,
          node_shape,
          description,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Archetype not found: ${archetype_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'archetype', action: 'update', id: archetype_id });
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

  server.tool(
    'delete_archetype',
    'Delete an archetype',
    { archetype_id: z.string().describe('The archetype ID to delete') },
    async ({ archetype_id }) => {
      try {
        const deleted = await deleteArchetype(archetype_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Archetype not found: ${archetype_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'archetype', action: 'delete', id: archetype_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: archetype_id }) }],
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
