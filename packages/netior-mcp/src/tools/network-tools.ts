import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createNetwork,
  deleteNetwork,
  getAppRootNetwork,
  getNetworkAncestors,
  getNetworkFull,
  getNetworkTree,
  getProjectRootNetwork,
  listNetworks,
  updateNetwork,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';

export function registerNetworkTools(server: McpServer): void {
  server.tool(
    'list_networks',
    'List networks in a project',
    {
      project_id: z.string().describe('The project ID'),
      root_only: z.boolean().optional().describe('Whether to return only root-level networks'),
    },
    async ({ project_id, root_only }) => {
      try {
        const result = await listNetworks(project_id, root_only);
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
    'create_network',
    'Create a network for graph organization and navigation',
    {
      name: z.string().describe('Network name'),
      project_id: z.string().nullable().optional().describe('Project ID or null for app scope'),
      scope: z.string().optional().describe('Optional network scope'),
      parent_network_id: z.string().optional().describe('Parent network ID'),
    },
    async ({ name, project_id, scope, parent_network_id }) => {
      try {
        const result = await createNetwork({
          name,
          project_id: project_id ?? null,
          scope,
          parent_network_id,
        });
        emitChange({ type: 'network', action: 'create', id: result.id });
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
    'update_network',
    'Update a network name, scope, or parent',
    {
      network_id: z.string().describe('The network ID to update'),
      name: z.string().optional().describe('New network name'),
      scope: z.string().optional().describe('New scope'),
      parent_network_id: z.string().nullable().optional().describe('Parent network ID or null'),
    },
    async ({ network_id, name, scope, parent_network_id }) => {
      try {
        const result = await updateNetwork(network_id, {
          name,
          scope,
          parent_network_id,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Network not found: ${network_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'network', action: 'update', id: network_id });
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
    'delete_network',
    'Delete a network',
    { network_id: z.string().describe('The network ID to delete') },
    async ({ network_id }) => {
      try {
        const deleted = await deleteNetwork(network_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Network not found: ${network_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'network', action: 'delete', id: network_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: network_id }) }],
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
    'get_network_full',
    'Get a network with nodes, edges, objects, and layout references',
    { network_id: z.string().describe('The network ID') },
    async ({ network_id }) => {
      try {
        const result = await getNetworkFull(network_id);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Network not found: ${network_id}` }],
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
    'get_app_root_network',
    'Get the app root network',
    {},
    async () => {
      try {
        const result = await getAppRootNetwork();
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
    'get_project_root_network',
    'Get the root network for a project',
    { project_id: z.string().describe('The project ID') },
    async ({ project_id }) => {
      try {
        const result = await getProjectRootNetwork(project_id);
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
    'get_network_tree',
    'Get the network hierarchy tree for a project',
    { project_id: z.string().describe('The project ID') },
    async ({ project_id }) => {
      try {
        const result = await getNetworkTree(project_id);
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
    'get_network_ancestors',
    'Get breadcrumb ancestors for a network',
    { network_id: z.string().describe('The network ID') },
    async ({ network_id }) => {
      try {
        const result = await getNetworkAncestors(network_id);
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
