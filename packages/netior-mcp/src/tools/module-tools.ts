import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listModules, listModuleDirectories } from '@netior/core';

export function registerModuleTools(server: McpServer): void {
  server.tool(
    'list_modules',
    'List all modules for a project',
    { project_id: z.string().describe('The project ID') },
    async ({ project_id }) => {
      try {
        const result = listModules(project_id);
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
    'list_module_directories',
    'List all directories registered to a module',
    { module_id: z.string().describe('The module ID') },
    async ({ module_id }) => {
      try {
        const result = listModuleDirectories(module_id);
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
