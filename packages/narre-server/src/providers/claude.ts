import { query } from '@anthropic-ai/claude-agent-sdk';
import { getNarreToolMetadata } from '@netior/shared/constants';
import type { NarreToolCall } from '@netior/shared/types';
import type {
  NarreProviderAdapter,
  NarreProviderRunContext,
  NarreProviderRunResult,
} from '../runtime/provider-adapter.js';
import { createClaudeSdkUiServer } from './shared/claude-sdk-ui-server.js';
import { NarreUiBridge } from './shared/ui-bridge.js';

export class ClaudeProviderAdapter implements NarreProviderAdapter {
  readonly name = 'claude';

  private readonly uiBridge = new NarreUiBridge();

  resolveUiCall(toolCallId: string, response: unknown): boolean {
    return this.uiBridge.resolveResponse(toolCallId, response);
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
      mcpServers: this.buildMcpServers(context),
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
      if (context.signal?.aborted) {
        break;
      }

      if (msg.type === 'assistant' && msg.message?.content) {
        const msgId = (msg as Record<string, unknown>).uuid as string | undefined;
        if (msgId) {
          if (processedMessageIds.has(msgId)) continue;
          processedMessageIds.add(msgId);
        }

        for (const block of msg.message.content) {
          if (context.signal?.aborted) {
            break;
          }

          if ('text' in block && block.text) {
            await context.onText(block.text);
            assistantText += block.text;
          }
          if ('name' in block && block.name) {
            const toolInput = (block.input as Record<string, unknown>) ?? {};
            const metadata = getNarreToolMetadata(block.name);
            await context.onToolStart(block.name, toolInput, metadata);
            toolCalls.push({
              tool: block.name,
              input: toolInput,
              status: 'running',
              metadata,
            });
          }
        }
      } else if (msg.type === 'result') {
        console.log(`[narre:${this.name}] Completed in ${msg.num_turns || 0} turns, cost: $${msg.total_cost_usd?.toFixed(4) || '?'}`);
        for (const toolCall of toolCalls) {
          if (toolCall.status !== 'running') continue;
          toolCall.status = 'success';
          await context.onToolEnd(toolCall.tool, 'completed', toolCall.metadata ?? getNarreToolMetadata(toolCall.tool));
        }
      }
    }

    return { assistantText, toolCalls };
  }

  private buildMcpServers(context: NarreProviderRunContext): Record<string, unknown> {
    return {
      ...Object.fromEntries(context.mcpServerConfigs.map((config) => [
        config.name,
        {
          command: config.command,
          args: config.args,
          env: config.env,
          cwd: config.cwd,
        },
      ])),
      'narre-ui': createClaudeSdkUiServer(context.onCard, this.uiBridge),
    };
  }
}
