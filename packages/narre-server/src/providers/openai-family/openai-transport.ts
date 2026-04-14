import {
  Agent,
  MCPServerStdio,
  connectMcpServers,
  isOpenAIResponsesRawModelStreamEvent,
  run,
  type RunItem,
  type RunToolCallItem,
  type RunToolCallOutputItem,
} from '@openai/agents';
import { randomUUID } from 'crypto';
import { getNarreToolMetadata } from '@netior/shared/constants';
import type { NarreToolCall } from '@netior/shared/types';
import { OpenAIFileSession } from '../openai-file-session.js';
import type { OpenAIFamilyTransport, OpenAIFamilyTransportRunContext } from './transport.js';
import { createOpenAIFamilyConversationTools } from './tools.js';

export interface OpenAIDirectTransportOptions {
  dataDir: string;
  model?: string;
}

export class OpenAIDirectTransport implements OpenAIFamilyTransport {
  readonly name = 'openai';

  constructor(private readonly options: OpenAIDirectTransportOptions) {}

  async run(context: OpenAIFamilyTransportRunContext) {
    const traceId = context.traceId ?? 'no-trace';
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required when NARRE_PROVIDER=openai');
    }

    console.log(
      `[narre:${this.name}] trace=${traceId} Starting run session=${context.sessionId} project=${context.projectId} ` +
      `resume=${context.isResume ? 'yes' : 'no'} model=${this.options.model ?? 'default'}`,
    );

    const session = new OpenAIFileSession(this.options.dataDir, context.projectId, context.sessionId);
    const servers = await connectMcpServers(
      context.mcpServerConfigs.map((config) => new MCPServerStdio({
        name: config.name,
        command: config.command,
        args: config.args,
        env: config.env,
        cwd: config.cwd,
      })),
      { connectInParallel: true },
    );

    const trackedToolCalls = new Map<string, NarreToolCall>();
    let assistantText = '';

    try {
      const activeNames = servers.active.map((server) => server.name).filter(Boolean).join(', ');
      console.log(
        `[narre:${this.name}] trace=${traceId} MCP connected active=${servers.active.length} failed=${servers.failed.length}` +
        `${activeNames ? ` names=${activeNames}` : ''}`,
      );

      if (servers.failed.length > 0) {
        const failedNames = servers.failed
          .map((server) => server.name)
          .filter((name): name is string => typeof name === 'string' && name.length > 0);
        console.warn(
          `[narre:${this.name}] trace=${traceId} Failed MCP servers: ${failedNames.join(', ') || servers.failed.length}`,
        );
      }

      const agent = new Agent({
        name: 'Narre',
        instructions: context.systemPrompt,
        ...(this.options.model ? { model: this.options.model } : {}),
        tools: createOpenAIFamilyConversationTools(context, context.uiBridge),
        mcpServers: servers.active,
      });

      const result = await run(agent, context.userPrompt, {
        stream: true,
        maxTurns: 30,
        session,
      });

      for await (const event of result) {
        if (isOpenAIResponsesRawModelStreamEvent(event)) {
          const rawEvent = event.data.event;
          if (rawEvent.type === 'response.output_text.delta' && rawEvent.delta) {
            assistantText += rawEvent.delta;
            await context.onText(rawEvent.delta);
          }
          continue;
        }

        if (event.type !== 'run_item_stream_event') {
          continue;
        }

        if (event.name === 'tool_called') {
          const started = extractToolStart(event.item);
          if (!started) {
            continue;
          }

          trackedToolCalls.set(started.callId, started.toolCall);
          console.log(`[narre:${this.name}] trace=${traceId} Tool start ${started.toolCall.tool}`);
          await context.onToolStart(
            started.toolCall.tool,
            started.toolCall.input,
            started.toolCall.metadata ?? getNarreToolMetadata(started.toolCall.tool),
          );
          continue;
        }

        if (event.name === 'tool_output') {
          const completed = extractToolEnd(event.item, trackedToolCalls);
          if (!completed) {
            continue;
          }

          console.log(`[narre:${this.name}] trace=${traceId} Tool end ${completed.tool}`);
          const completedCall = trackedToolCalls.get(completed.callId);
          await context.onToolEnd(
            completed.tool,
            completed.result,
            completedCall?.metadata ?? getNarreToolMetadata(completed.tool),
          );
        }
      }

      await result.completed;

      const finalOutput = stringifyOutput(result.finalOutput);
      const trailingText = resolveTrailingAssistantText(assistantText, finalOutput);
      if (trailingText) {
        assistantText += trailingText;
        await context.onText(trailingText);
      }

      console.log(
        `[narre:${this.name}] trace=${traceId} Run completed session=${context.sessionId} ` +
        `streamedChars=${assistantText.length} finalChars=${finalOutput.length} tools=${trackedToolCalls.size}`,
      );

      return {
        assistantText: finalOutput || assistantText,
        toolCalls: Array.from(trackedToolCalls.values()),
      };
    } catch (error) {
      for (const toolCall of trackedToolCalls.values()) {
        if (toolCall.status !== 'running') {
          continue;
        }

        toolCall.status = 'error';
        toolCall.error = (error as Error).message;
      }

      console.error(
        `[narre:${this.name}] trace=${traceId} Run failed session=${context.sessionId}: ` +
        `${(error as Error).stack ?? (error as Error).message}`,
      );
      throw error;
    } finally {
      await servers.close();
    }
  }
}

function extractToolStart(item: RunItem): { callId: string; toolCall: NarreToolCall } | null {
  if (item.type !== 'tool_call_item') {
    return null;
  }

  const rawItem = (item as RunToolCallItem).rawItem as Record<string, unknown>;
  const tool = extractToolName(rawItem);
  if (!tool) {
    return null;
  }

  return {
    callId: extractCallId(rawItem),
    toolCall: {
      tool,
      input: extractToolInput(rawItem),
      status: 'running',
      metadata: getNarreToolMetadata(tool),
    },
  };
}

function extractToolEnd(
  item: RunItem,
  trackedToolCalls: Map<string, NarreToolCall>,
): { callId: string; tool: string; result: string } | null {
  if (item.type !== 'tool_call_output_item') {
    return null;
  }

  const outputItem = item as RunToolCallOutputItem;
  const rawItem = outputItem.rawItem as Record<string, unknown>;
  const callId = extractCallId(rawItem);
  const tracked = trackedToolCalls.get(callId);
  if (!tracked) {
    return null;
  }

  const result = stringifyOutput(outputItem.output) || 'completed';
  tracked.status = 'success';
  tracked.result = result;

  return {
    callId,
    tool: tracked.tool,
    result,
  };
}

function extractCallId(rawItem: Record<string, unknown>): string {
  if (typeof rawItem.callId === 'string' && rawItem.callId.length > 0) {
    return rawItem.callId;
  }
  if (typeof rawItem.call_id === 'string' && rawItem.call_id.length > 0) {
    return rawItem.call_id;
  }
  if (typeof rawItem.id === 'string' && rawItem.id.length > 0) {
    return rawItem.id;
  }

  return randomUUID();
}

function extractToolName(rawItem: Record<string, unknown>): string | null {
  if (typeof rawItem.name === 'string' && rawItem.name.length > 0) {
    return rawItem.name;
  }
  if (rawItem.type === 'shell_call') {
    return 'shell';
  }
  if (rawItem.type === 'apply_patch_call') {
    return 'apply_patch';
  }
  if (rawItem.type === 'tool_search_call') {
    return 'tool_search';
  }

  return null;
}

function extractToolInput(rawItem: Record<string, unknown>): Record<string, unknown> {
  const argumentsValue = rawItem.arguments;
  if (typeof argumentsValue === 'string' && argumentsValue.length > 0) {
    try {
      const parsed = JSON.parse(argumentsValue) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { raw: argumentsValue };
    }
  }

  if (rawItem.action && typeof rawItem.action === 'object' && !Array.isArray(rawItem.action)) {
    return rawItem.action as Record<string, unknown>;
  }

  if (rawItem.operation && typeof rawItem.operation === 'object' && !Array.isArray(rawItem.operation)) {
    return rawItem.operation as Record<string, unknown>;
  }

  return {};
}

function stringifyOutput(output: unknown): string {
  if (typeof output === 'string') {
    return output;
  }
  if (output === undefined || output === null) {
    return '';
  }

  return JSON.stringify(output);
}

function resolveTrailingAssistantText(streamedText: string, finalOutput: string): string {
  if (!finalOutput) {
    return '';
  }

  if (!streamedText) {
    return finalOutput;
  }

  if (finalOutput.startsWith(streamedText)) {
    return finalOutput.slice(streamedText.length);
  }

  return '';
}
