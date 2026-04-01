import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initDatabase, closeDatabase } from '@netior/core';
import { registerAllTools } from './tools/index.js';

async function main(): Promise<void> {
  const dbPath = process.env.MOC_DB_PATH;
  if (!dbPath) {
    console.error('Error: MOC_DB_PATH environment variable is required');
    process.exit(1);
  }

  // Initialize the database
  initDatabase(dbPath);

  // Create MCP server
  const server = new McpServer({
    name: 'netior-mcp',
    version: '0.1.0',
  });

  // Register all tools
  registerAllTools(server);

  // Create stdio transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  const shutdown = (): void => {
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
