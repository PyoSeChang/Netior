import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  DEFAULT_NETIOR_MCP_TOOL_PROFILE,
  getNetiorMcpToolSpec,
  isNetiorMcpToolEnabledForProfile,
  type NetiorMcpToolKey,
} from '@netior/shared/constants';
import type { NetiorMcpToolProfile } from '@netior/shared/types';
import { z } from 'zod';

type NetiorMcpToolSchema = z.ZodRawShape;

export function getActiveNetiorMcpToolProfile(): NetiorMcpToolProfile {
  const raw = process.env.NETIOR_MCP_TOOL_PROFILE?.trim();
  switch (raw) {
    case 'core':
    case 'discovery':
    case 'onboarding-skill':
    case 'index-skill':
      return raw;
    default:
      return DEFAULT_NETIOR_MCP_TOOL_PROFILE;
  }
}

export function projectIdSchema(): z.ZodOptional<z.ZodString> {
  return z.string().optional().describe('Project ID. Omit to use the current active project.');
}

export function projectIdOrNullSchema(description: string): z.ZodOptional<z.ZodNullable<z.ZodString>> {
  return z.string().nullable().optional().describe(`${description}. Omit to use the current active project.`);
}

export function resolveProjectId(projectId?: string | null): string {
  const explicit = typeof projectId === 'string' ? projectId.trim() : '';
  if (explicit) {
    return explicit;
  }

  const fallback = process.env.NETIOR_MCP_DEFAULT_PROJECT_ID?.trim();
  if (fallback) {
    return fallback;
  }

  throw new Error('project_id is required because no current active project is bound');
}

export function resolveNullableProjectId(projectId?: string | null): string | null {
  if (projectId === null) {
    return null;
  }

  return resolveProjectId(projectId);
}

export function registerNetiorTool<TSchema extends NetiorMcpToolSchema>(
  server: McpServer,
  toolKey: NetiorMcpToolKey,
  schema: TSchema,
  handler: (args: z.infer<z.ZodObject<TSchema>>) => Promise<unknown> | unknown,
): void {
  const profile = getActiveNetiorMcpToolProfile();
  if (!isNetiorMcpToolEnabledForProfile(toolKey, profile)) {
    return;
  }

  const spec = getNetiorMcpToolSpec(toolKey);
  server.tool(spec.key, spec.description, schema, handler as never);
}
