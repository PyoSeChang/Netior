import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getNetiorMcpToolSpec, type NetiorMcpToolKey } from '@netior/shared/constants';
import { z } from 'zod';

type NetiorMcpToolSchema = z.ZodRawShape;

export function registerNetiorTool<TSchema extends NetiorMcpToolSchema>(
  server: McpServer,
  toolKey: NetiorMcpToolKey,
  schema: TSchema,
  handler: (args: z.infer<z.ZodObject<TSchema>>) => Promise<unknown> | unknown,
): void {
  const spec = getNetiorMcpToolSpec(toolKey);
  server.tool(spec.key, spec.description, schema, handler as never);
}
