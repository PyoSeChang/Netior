import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createNetworkNode,
  deleteNetworkNode,
  updateNetworkNode,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';

const nodeTypeSchema = z.enum(['basic', 'portal', 'group', 'hierarchy']);

export function registerNetworkNodeTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'create_network_node',
    {
      network_id: z.string().describe('The network ID'),
      object_id: z.string().describe('The object record ID'),
      node_type: nodeTypeSchema.optional().describe('The node type'),
      parent_node_id: z.string().optional().describe('Optional parent node ID'),
    },
    async ({ network_id, object_id, node_type, parent_node_id }) => {
      try {
        const result = await createNetworkNode({
          network_id,
          object_id,
          node_type,
          parent_node_id,
        });
        emitChange({ type: 'networkNode', action: 'create', id: result.id });
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
    'update_network_node',
    {
      node_id: z.string().describe('The network node ID'),
      node_type: nodeTypeSchema.optional().describe('New node type'),
      parent_node_id: z.string().nullable().optional().describe('Parent node ID or null'),
      metadata: z.string().nullable().optional().describe('Node metadata JSON string or null'),
    },
    async ({ node_id, node_type, parent_node_id, metadata }) => {
      try {
        const result = await updateNetworkNode(node_id, {
          node_type,
          parent_node_id,
          metadata,
        });
        emitChange({ type: 'networkNode', action: 'update', id: node_id });
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
    'delete_network_node',
    { node_id: z.string().describe('The network node ID') },
    async ({ node_id }) => {
      try {
        const deleted = await deleteNetworkNode(node_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Network node not found: ${node_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'networkNode', action: 'delete', id: node_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: node_id }) }],
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
