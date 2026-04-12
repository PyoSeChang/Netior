import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createEdge,
  deleteEdge,
  getEdge,
  updateEdge,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';

const systemContractSchema = z.enum([
  'core:contains',
  'core:entry_portal',
  'core:hierarchy_parent',
]);

export function registerEdgeTools(server: McpServer): void {
  server.tool(
    'create_edge',
    'Create an edge between two network nodes',
    {
      network_id: z.string().describe('The network ID'),
      source_node_id: z.string().describe('Source node ID'),
      target_node_id: z.string().describe('Target node ID'),
      relation_type_id: z.string().optional().describe('Optional relation type ID'),
      system_contract: systemContractSchema.optional().describe('Optional system contract'),
      description: z.string().optional().describe('Optional edge description'),
    },
    async ({ network_id, source_node_id, target_node_id, relation_type_id, system_contract, description }) => {
      try {
        const result = await createEdge({
          network_id,
          source_node_id,
          target_node_id,
          relation_type_id,
          system_contract,
          description,
        });
        emitChange({ type: 'edge', action: 'create', id: result.id });
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
    'get_edge',
    'Get an edge by ID',
    { edge_id: z.string().describe('The edge ID') },
    async ({ edge_id }) => {
      try {
        const result = await getEdge(edge_id);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Edge not found: ${edge_id}` }],
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
    'update_edge',
    'Update an edge relation type, system contract, or description',
    {
      edge_id: z.string().describe('The edge ID'),
      relation_type_id: z.string().nullable().optional().describe('Relation type ID or null'),
      system_contract: systemContractSchema.nullable().optional().describe('System contract or null'),
      description: z.string().nullable().optional().describe('Edge description or null'),
    },
    async ({ edge_id, relation_type_id, system_contract, description }) => {
      try {
        const result = await updateEdge(edge_id, {
          relation_type_id,
          system_contract,
          description,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Edge not found: ${edge_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'edge', action: 'update', id: edge_id });
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
    'delete_edge',
    'Delete an edge',
    { edge_id: z.string().describe('The edge ID') },
    async ({ edge_id }) => {
      try {
        const deleted = await deleteEdge(edge_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Edge not found: ${edge_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'edge', action: 'delete', id: edge_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: edge_id }) }],
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
