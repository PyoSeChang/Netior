import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './tools/index.js';
import { getNetiorServiceUrl } from './netior-service-client.js';
import { getActiveNetiorMcpToolProfile } from './tools/shared-tool-registry.js';

// MCP stdio transport requires stdout to stay protocol-only.
console.log = (...args: unknown[]) => {
  console.error(...args);
};

async function main(): Promise<void> {
  await ensureNetiorServiceIsReachable();

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
  console.error(
    `[netior-mcp] profile=${getActiveNetiorMcpToolProfile()} ` +
    `defaultProject=${process.env.NETIOR_MCP_DEFAULT_PROJECT_ID ?? '(none)'} ` +
    `service=${getNetiorServiceUrl()}`,
  );

  // Graceful shutdown
  const shutdown = (): void => {
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

async function ensureNetiorServiceIsReachable(): Promise<void> {
  const baseUrl = getNetiorServiceUrl();
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new Error(`Netior service health check failed at ${baseUrl}`);
  }
}
