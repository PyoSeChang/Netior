import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getObject, getObjectByRef } from '../netior-service-client.js';
import { registerNetiorTool } from './shared-tool-registry.js';
import { fromAgentObjectType, toAgentObject, type AgentObjectType } from './schema-surface.js';

const objectTypeSchema = z.enum([
  'concept',
  'network',
  'project',
  'schema',
  'model',
  'type_group',
  'agent',
  'context',
  'file',
  'module',
  'folder',
]);

export function registerObjectTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'get_object',
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
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentObject(result), null, 2) }],
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
    'get_object_by_ref',
    {
      object_type: objectTypeSchema.describe('The domain object type'),
      ref_id: z.string().describe('The referenced domain object ID'),
    },
    async ({ object_type, ref_id }) => {
      try {
        const result = await getObjectByRef(fromAgentObjectType(object_type as AgentObjectType), ref_id);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Object not found for ${object_type}:${ref_id}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentObject(result), null, 2) }],
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
