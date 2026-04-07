import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { NarreCard } from '@netior/shared/types';
import { randomUUID } from 'crypto';

const proposalCellTypeSchema = z.enum(['text', 'icon', 'color', 'enum', 'boolean', 'readonly']);

// Pending user responses for UI tool calls
const pendingUiCalls = new Map<string, {
  resolve: (result: string) => void;
}>();

/**
 * Resolve a pending UI tool call with the user's response.
 * Called when the desktop-app sends back the user's interaction result.
 */
export function resolveUiCall(callId: string, response: unknown): boolean {
  const pending = pendingUiCalls.get(callId);
  if (!pending) return false;
  pending.resolve(JSON.stringify(response));
  pendingUiCalls.delete(callId);
  return true;
}

/**
 * Create an in-process MCP server that provides UI tools (propose, ask, confirm).
 * These tools send structured cards to the client via SSE and wait for user response.
 */
export function createNarreUiServer(sendCard: (card: NarreCard) => void) {
  return createSdkMcpServer({
    name: 'narre-ui',
    tools: [
      tool(
        'propose',
        'Present a proposal table to the user for review and inline editing. Use this when suggesting archetypes, relation types, or concepts.',
        {
          title: z.string().describe('Title for the proposal (e.g. "Archetype 제안")'),
          columns: z.array(z.object({
            key: z.string(),
            label: z.string(),
            cellType: proposalCellTypeSchema.describe('text | icon | color | enum | boolean | readonly'),
            options: z.array(z.string()).optional(),
          })),
          rows: z.array(z.object({
            id: z.string(),
            values: z.record(z.string(), z.unknown()),
          })),
        },
        async (args) => {
          const callId = randomUUID();
          sendCard({
            type: 'proposal',
            toolCallId: callId,
            title: args.title,
            columns: args.columns,
            rows: args.rows,
          });
          const response = await new Promise<string>((resolve) => {
            pendingUiCalls.set(callId, { resolve });
          });
          return { content: [{ type: 'text' as const, text: response }] };
        },
      ),
      tool(
        'ask',
        'Ask the user a structured question with selectable options. Use for gathering preferences or domain information.',
        {
          question: z.string().describe('The question to ask'),
          options: z.array(z.object({
            label: z.string(),
            description: z.string().optional(),
          })),
          multiSelect: z.boolean().optional().describe('Allow multiple selections'),
        },
        async (args) => {
          const callId = randomUUID();
          sendCard({
            type: 'interview',
            toolCallId: callId,
            question: args.question,
            options: args.options,
            multiSelect: args.multiSelect ?? undefined,
          });
          const response = await new Promise<string>((resolve) => {
            pendingUiCalls.set(callId, { resolve });
          });
          return { content: [{ type: 'text' as const, text: response }] };
        },
      ),
      tool(
        'confirm',
        'Request user confirmation before a destructive or significant action.',
        {
          message: z.string().describe('Description of the action requiring confirmation'),
          actions: z.array(z.object({
            key: z.string(),
            label: z.string(),
            variant: z.enum(['danger', 'default']).optional(),
          })),
        },
        async (args) => {
          const callId = randomUUID();
          sendCard({
            type: 'permission',
            toolCallId: callId,
            message: args.message,
            actions: args.actions,
          });
          const response = await new Promise<string>((resolve) => {
            pendingUiCalls.set(callId, { resolve });
          });
          return { content: [{ type: 'text' as const, text: response }] };
        },
      ),
    ],
  });
}
