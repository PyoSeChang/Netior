import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getObject, getObjectByRef } from '../netior-service-client.js';

const objectTypeSchema = z.enum([
  'concept',
  'network',
  'project',
  'archetype',
  'relation_type',
  'agent',
  'context',
  'file',
  'module',
  'folder',
]);

export function registerObjectTools(server: McpServer): void {
  server.tool(
    'get_object',
    'Get a network object record by object ID',
    { object_id: z.string().describe('The object ID') },
    async ({ object_id }) => {
      try {
        const result = await getObject(object_id);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Object not found: ${object_id}` }],
            isError: true,
          };
        }
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
    'get_object_by_ref',
    'Get a network object record from a domain object type and ref ID',
    {
      object_type: objectTypeSchema.describe('The domain object type'),
      ref_id: z.string().describe('The referenced domain object ID'),
    },
    async ({ object_type, ref_id }) => {
      try {
        const result = await getObjectByRef(object_type, ref_id);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Object not found for ${object_type}:${ref_id}` }],
            isError: true,
          };
        }
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
}
