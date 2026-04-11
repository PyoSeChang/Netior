import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { NarreCard, NarreToolCall } from '@netior/shared/types';
import type {
  NarreProviderAdapter,
  NarreProviderRunContext,
  NarreProviderRunResult,
} from '../runtime/provider-adapter.js';
import { PendingUiResponses } from '../tools/pending-ui-responses.js';

const proposalCellTypeSchema = z.enum(['text', 'icon', 'color', 'enum', 'boolean', 'readonly']);

export class ClaudeProviderAdapter implements NarreProviderAdapter {
  readonly name = 'claude';

  private readonly pendingUiResponses = new PendingUiResponses();

  createConversationMcpServers(sendCard: (card: NarreCard) => void): Record<string, unknown> {
    return {
      'narre-ui': createSdkMcpServer({
        name: 'narre-ui',
        tools: [
          tool(
            'propose',
            'Present a proposal table to the user for review and inline editing. Use this when suggesting archetypes, relation types, or concepts.',
            {
              title: z.string().describe('Title for the proposal'),
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
              const response = await this.pendingUiResponses.waitForResponse(callId);
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
              const response = await this.pendingUiResponses.waitForResponse(callId);
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
              const response = await this.pendingUiResponses.waitForResponse(callId);
              return { content: [{ type: 'text' as const, text: response }] };
            },
          ),
        ],
      }),
    };
  }

  resolveUiCall(toolCallId: string, response: unknown): boolean {
    return this.pendingUiResponses.resolve(toolCallId, response);
  }

  async run(context: NarreProviderRunContext): Promise<NarreProviderRunResult> {
    const prompt = context.isResume
      ? context.userPrompt
      : `${context.systemPrompt}\n\n${context.userPrompt}`;

    const queryOptions: Record<string, unknown> = {
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 30,
      tools: [],
      model: 'sonnet',
      mcpServers: context.mcpServers,
    };

    if (context.isResume) {
      queryOptions.resume = context.sessionId;
    } else {
      queryOptions.sessionId = context.sessionId;
    }

    let assistantText = '';
    const toolCalls: NarreToolCall[] = [];
    const processedMessageIds = new Set<string>();

    for await (const msg of query({
      prompt,
      options: queryOptions as Parameters<typeof query>[0]['options'],
    })) {
      if (msg.type === 'assistant' && msg.message?.content) {
        const msgId = (msg as Record<string, unknown>).uuid as string | undefined;
        if (msgId) {
          if (processedMessageIds.has(msgId)) continue;
          processedMessageIds.add(msgId);
        }

        for (const block of msg.message.content) {
          if ('text' in block && block.text) {
            context.onText(block.text);
            assistantText += block.text;
          }
          if ('name' in block && block.name) {
            const toolInput = (block.input as Record<string, unknown>) ?? {};
            context.onToolStart(block.name, toolInput);
            toolCalls.push({ tool: block.name, input: toolInput, status: 'running' });
          }
        }
      } else if (msg.type === 'result') {
        console.log(`[narre:${this.name}] Completed in ${msg.num_turns || 0} turns, cost: $${msg.total_cost_usd?.toFixed(4) || '?'}`);
        for (const toolCall of toolCalls) {
          if (toolCall.status !== 'running') continue;
          toolCall.status = 'success';
          context.onToolEnd(toolCall.tool, 'completed');
        }
      }
    }

    return { assistantText, toolCalls };
  }
}
