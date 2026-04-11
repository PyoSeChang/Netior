import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listModules } from '../netior-service-client.js';

export function registerModuleTools(server: McpServer): void {
  server.tool(
    'list_modules',
    'List all modules for a project',
    { project_id: z.string().describe('The project ID') },
    async ({ project_id }) => {
      try {
        const result = await listModules(project_id);
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
