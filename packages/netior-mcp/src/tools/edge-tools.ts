import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createEdge,
  deleteEdge,
  getEdge,
  updateEdge,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';

export function registerEdgeTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'create_edge',
    {
      network_id: z.string().describe('The network ID'),
      source_node_id: z.string().describe('Source node ID'),
      target_node_id: z.string().describe('Target node ID'),
      model_id: z.string().optional().describe('Optional edge model ID'),
      description: z.string().optional().describe('Optional edge description'),
    },
    async ({ network_id, source_node_id, target_node_id, model_id, description }) => {
      try {
        const result = await createEdge({
          network_id,
          source_node_id,
          target_node_id,
          model_id,
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

  registerNetiorTool(
    server,
    'get_edge',
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

  registerNetiorTool(
    server,
    'update_edge',
    {
      edge_id: z.string().describe('The edge ID'),
      model_id: z.string().nullable().optional().describe('Edge model ID or null'),
      description: z.string().nullable().optional().describe('Edge description or null'),
    },
    async ({ edge_id, model_id, description }) => {
      try {
        const result = await updateEdge(edge_id, {
          model_id,
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

  registerNetiorTool(
    server,
    'delete_edge',
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
