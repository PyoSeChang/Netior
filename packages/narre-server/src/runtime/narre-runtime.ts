import { randomUUID } from 'crypto';
import { getNarreToolMetadata } from '@netior/shared/constants';
import type {
  NarreActorProvider,
  NarreBehaviorSettings,
  NarreCard,
  NarreMention,
  NarreToolMetadata,
  NarreToolCall,
  NarreToolBlock,
  NarreTranscriptBlock,
  NarreTranscriptTurn,
} from '@netior/shared/types';
import { buildOnboardingPrompt } from '../prompts/onboarding-v2.js';
import { buildIndexTocPrompt } from '../prompts/index-toc.js';
import {
  buildSystemPrompt,
  DEFAULT_NARRE_BEHAVIOR_SETTINGS,
  type SystemPromptParams,
} from '../system-prompt.js';
import { parseCommand } from '../command-router.js';
import { SessionStore } from '../session-store.js';
import type { NarreMcpServerConfig, NarreProviderAdapter } from './provider-adapter.js';

const commandPromptBuilders: Record<string, (params: SystemPromptParams, behavior: NarreBehaviorSettings) => string> = {
  onboarding: buildOnboardingPrompt,
  index: buildIndexTocPrompt,
};

export interface NarreRuntimeChatRequest {
  traceId?: string;
  sessionId?: string;
  projectId: string;
  message: string;
  mentions?: NarreMention[];
  projectMetadata?: SystemPromptParams;
}

export interface NarreRuntimeEvents {
  onText: (text: string) => void | Promise<void>;
  onToolStart: (tool: string, input: Record<string, unknown>, metadata: NarreToolMetadata) => void | Promise<void>;
  onToolEnd: (tool: string, result: string, metadata: NarreToolMetadata) => void | Promise<void>;
  onCard: (card: NarreCard) => void | Promise<void>;
  onError: (error: string) => void;
}

export interface NarreRuntimeConfig {
  sessionStore: SessionStore;
  provider: NarreProviderAdapter;
  resolveMcpServerPath: () => string | null;
  behaviorSettings?: NarreBehaviorSettings;
}

export class NarreRuntime {
  constructor(private readonly config: NarreRuntimeConfig) {}

  resolveUiCall(toolCallId: string, response: unknown): boolean {
    return this.config.provider.resolveUiCall(toolCallId, response);
  }

  async runChat(
    request: NarreRuntimeChatRequest,
    events: NarreRuntimeEvents,
    signal?: AbortSignal,
  ): Promise<{ sessionId: string }> {
    const traceId = request.traceId ?? 'no-trace';
    const runStartedAt = Date.now();
    const parsedCommand = parseCommand(request.message);
    const isAborted = (): boolean => signal?.aborted === true;

    if (parsedCommand && parsedCommand.command.type === 'system') {
      throw new Error('Use /command endpoint for system commands');
    }

    let activeSessionId = request.sessionId;
    if (!activeSessionId) {
      const session = await this.config.sessionStore.createSession(request.projectId, request.message.slice(0, 60));
      activeSessionId = session.id;
    }
    if (!activeSessionId) {
      throw new Error('Failed to resolve Narre session id');
    }
    const resolvedSessionId = activeSessionId;

    const metadata = request.projectMetadata ?? {
      projectName: request.projectId,
      projectRootDir: null,
      archetypes: [],
      relationTypes: [],
    };
    const behaviorSettings = this.config.behaviorSettings ?? DEFAULT_NARRE_BEHAVIOR_SETTINGS;
    const promptBuilder = parsedCommand?.command.name
      ? commandPromptBuilders[parsedCommand.command.name]
      : undefined;
    const systemPrompt = promptBuilder
      ? promptBuilder(metadata, behaviorSettings)
      : buildSystemPrompt(metadata, behaviorSettings);

    const processedMessage = this.buildPromptMessage(request.message, request.mentions);

    const userTurn = buildUserTurn(request.message, request.mentions, parsedCommand);
    await this.config.sessionStore.appendTurn(resolvedSessionId, request.projectId, userTurn);

    const mcpServerPath = this.config.resolveMcpServerPath();
    if (!mcpServerPath) {
      console.error(`[narre:runtime] trace=${traceId} stage=mcp.missing session=${resolvedSessionId}`);
      events.onError('Could not find netior-mcp server. Run: pnpm --filter @netior/mcp build');
      return { sessionId: resolvedSessionId };
    }

    const sessionData = await this.config.sessionStore.getSession(resolvedSessionId, request.projectId);
    const historyTurns = sessionData?.transcript?.turns ?? [];
    const isResume = historyTurns.length > 1;
    const mcpServerConfigs = this.buildMcpServerConfigs(mcpServerPath);
    console.log(
      `[narre:runtime] trace=${traceId} stage=run.start session=${resolvedSessionId} ` +
      `project=${request.projectId} resume=${isResume ? 'yes' : 'no'} mentions=${request.mentions?.length ?? 0}`,
    );
    for (const config of mcpServerConfigs) {
      console.log(
        `[narre:runtime] trace=${traceId} stage=mcp.config name=${config.name} command=${config.command} ` +
        `args=${JSON.stringify(config.args ?? [])} cwd=${config.cwd ?? '(default)'}`,
      );
    }
    const assistantBlocks: NarreTranscriptBlock[] = [];
    const assistantTurnId = buildTurnId();
    const assistantTurnCreatedAt = new Date().toISOString();
    let checkpointPromise: Promise<void> = Promise.resolve();
    let activeTextBlock: Extract<NarreTranscriptBlock, { type: 'rich_text' }> | null = null;

    const buildAssistantTurn = (): NarreTranscriptTurn => ({
      id: assistantTurnId,
      role: 'assistant',
      createdAt: assistantTurnCreatedAt,
      actor: {
        provider: resolveActorProvider(this.config.provider.name),
        label: this.config.provider.name,
      },
      blocks: structuredClone(assistantBlocks),
    });

    const queueAssistantCheckpoint = (): void => {
      if (assistantBlocks.length === 0) {
        return;
      }

      const snapshot = buildAssistantTurn();
      checkpointPromise = checkpointPromise
        .then(() => this.config.sessionStore.upsertTurn(resolvedSessionId, request.projectId, snapshot))
        .catch((error) => {
          console.error('[narre:runtime] failed to checkpoint assistant turn', error);
        });
    };

    const appendText = (text: string): void => {
      if (!text || isAborted()) {
        return;
      }

      if (!activeTextBlock) {
        activeTextBlock = {
          id: buildBlockId(),
          type: 'rich_text',
          text,
        };
        assistantBlocks.push(activeTextBlock);
        queueAssistantCheckpoint();
        return;
      }

      activeTextBlock.text += text;
    };

    const closeTextBlock = (): void => {
      activeTextBlock = null;
    };

    const beginTool = (tool: string, input: Record<string, unknown>): void => {
      if (isAborted()) {
        return;
      }

      const metadata = getNarreToolMetadata(tool);
      closeTextBlock();
      assistantBlocks.push({
        id: buildBlockId(),
        type: 'tool',
        toolKey: tool,
        metadata,
        input,
      });
      queueAssistantCheckpoint();
    };

    const completeTool = (tool: string, result: string): void => {
      if (isAborted()) {
        return;
      }
      closeTextBlock();
      const openTool = [...assistantBlocks]
        .reverse()
        .find((block): block is NarreToolBlock =>
          block.type === 'tool' && block.toolKey === tool && !block.output && !block.error,
        );

      if (!openTool) {
        const metadata = getNarreToolMetadata(tool);
        assistantBlocks.push({
          id: buildBlockId(),
          type: 'tool',
          toolKey: tool,
          metadata,
          input: {},
          ...(result.startsWith('Error') ? { error: result } : { output: result }),
        });
        queueAssistantCheckpoint();
        return;
      }

      if (result.startsWith('Error')) {
        openTool.error = result;
        queueAssistantCheckpoint();
        return;
      }

      openTool.output = result;
      queueAssistantCheckpoint();
    };

    const appendCard = (card: NarreCard): void => {
      if (isAborted()) {
        return;
      }
      closeTextBlock();
      assistantBlocks.push({
        id: buildBlockId(),
        type: 'card',
        card,
      });
      queueAssistantCheckpoint();
    };

    let result;
    try {
      result = await this.config.provider.run({
        traceId,
        projectId: request.projectId,
        projectRootDir: metadata.projectRootDir ?? null,
        systemPrompt,
        userPrompt: processedMessage,
        sessionId: resolvedSessionId,
        isResume,
        signal,
        mcpServerConfigs,
        onText: async (text) => {
          appendText(text);
          await checkpointPromise;
          if (!isAborted()) {
            await events.onText(text);
          }
        },
        onToolStart: async (tool, input) => {
          const metadata = getNarreToolMetadata(tool);
          beginTool(tool, input);
          await checkpointPromise;
          if (!isAborted()) {
            await events.onToolStart(tool, input, metadata);
          }
        },
        onToolEnd: async (tool, resultText) => {
          const metadata = getNarreToolMetadata(tool);
          completeTool(tool, resultText);
          await checkpointPromise;
          if (!isAborted()) {
            await events.onToolEnd(tool, resultText, metadata);
          }
        },
        onCard: async (card) => {
          appendCard(card);
          await checkpointPromise;
          if (!isAborted()) {
            await events.onCard(card);
          }
        },
      });
    } catch (error) {
      if (!isAborted()) {
        throw error;
      }

      await checkpointPromise;

      if (assistantBlocks.length === 0) {
        await this.config.sessionStore.removeTurn(resolvedSessionId, request.projectId, userTurn.id);
        return { sessionId: resolvedSessionId };
      }

      await this.config.sessionStore.upsertTurn(resolvedSessionId, request.projectId, buildAssistantTurn());
      return { sessionId: resolvedSessionId };
    }

    if (isAborted()) {
      if (assistantBlocks.length === 0) {
        await this.config.sessionStore.removeTurn(resolvedSessionId, request.projectId, userTurn.id);
        return { sessionId: resolvedSessionId };
      }
    } else if (assistantBlocks.length === 0) {
      if (result.assistantText) {
        appendText(result.assistantText);
      }

      for (const toolCall of result.toolCalls) {
        assistantBlocks.push(toolCallToBlock(toolCall));
      }
    }

    await checkpointPromise;

    if (assistantBlocks.length > 0) {
      await this.config.sessionStore.upsertTurn(resolvedSessionId, request.projectId, buildAssistantTurn());
    }

    console.log(
      `[narre:runtime] trace=${traceId} stage=run.completed session=${resolvedSessionId} ` +
      `assistantChars=${result.assistantText.length} tools=${result.toolCalls.length} ` +
      `elapsedMs=${Date.now() - runStartedAt}`,
    );

    return { sessionId: resolvedSessionId };
  }

  private buildMcpServerConfigs(mcpServerPath: string): NarreMcpServerConfig[] {
    const runningInsideElectronNode = Boolean(process.versions.electron) || process.env.ELECTRON_RUN_AS_NODE === '1';
    const mcpCommand = process.execPath;
    const mcpEnv: Record<string, string> = {
      NETIOR_SERVICE_URL: process.env.NETIOR_SERVICE_URL ?? `http://127.0.0.1:${process.env.NETIOR_SERVICE_PORT ?? '3201'}`,
    };

    if (runningInsideElectronNode) {
      mcpEnv.ELECTRON_RUN_AS_NODE = '1';
    }

    return [
      {
        name: 'netior',
        command: mcpCommand,
        args: [mcpServerPath],
        env: mcpEnv,
      },
    ];
  }

  private buildPromptMessage(message: string, mentions?: NarreMention[]): string {
    let processedMessage = message;

    if (!mentions || mentions.length === 0) {
      return processedMessage;
    }

    for (const mention of mentions) {
      const tag = buildMentionTag(mention);
      if (mention.display && processedMessage.includes(mention.display)) {
        processedMessage = processedMessage.replace(mention.display, tag);
      } else {
        processedMessage += `\n${tag}`;
      }
    }

    return processedMessage;
  }
}

function buildTurnId(): string {
  return `turn-${randomUUID()}`;
}

function buildBlockId(): string {
  return `block-${randomUUID()}`;
}

function resolveActorProvider(name: string): NarreActorProvider {
  switch (name) {
    case 'claude':
    case 'openai':
    case 'codex':
    case 'narre':
      return name;
    default:
      return 'custom';
  }
}

function extractIndexCommandArgs(message: string): Record<string, string> {
  const match = message.match(/\[toc_params\]([\s\S]*?)\[\/toc_params\]/);
  if (!match) {
    return {};
  }

  try {
    const parsed = JSON.parse(match[1]) as Partial<{
      startPage: number;
      endPage: number;
      overviewPages: number[];
    }>;

    const args: Record<string, string> = {};
    if (typeof parsed.startPage === 'number') {
      args.startPage = String(parsed.startPage);
    }
    if (typeof parsed.endPage === 'number') {
      args.endPage = String(parsed.endPage);
    }
    if (Array.isArray(parsed.overviewPages) && parsed.overviewPages.length > 0) {
      args.overviewPages = parsed.overviewPages.join(', ');
    }
    return args;
  } catch {
    return {};
  }
}

function buildUserTurn(
  message: string,
  mentions: NarreMention[] | undefined,
  parsedCommand: ReturnType<typeof parseCommand>,
): NarreTranscriptTurn {
  const blocks: NarreTranscriptBlock[] = [];

  if (parsedCommand?.command.type === 'conversation') {
    const args = parsedCommand.command.name === 'index'
      ? { ...parsedCommand.args, ...extractIndexCommandArgs(message) }
      : parsedCommand.args;

    blocks.push({
      id: buildBlockId(),
      type: 'command',
      name: parsedCommand.command.name,
      label: `/${parsedCommand.command.name}`,
      ...(Object.keys(args).length > 0 ? { args } : {}),
      ...(mentions && mentions.length > 0 ? { refs: mentions } : {}),
    });
  } else {
    blocks.push({
      id: buildBlockId(),
      type: 'rich_text',
      text: message,
      ...(mentions && mentions.length > 0 ? { mentions } : {}),
    });
  }

  return {
    id: buildTurnId(),
    role: 'user',
    createdAt: new Date().toISOString(),
    blocks,
  };
}

function toolCallToBlock(toolCall: NarreToolCall): NarreToolBlock {
  return {
    id: buildBlockId(),
    type: 'tool',
    toolKey: toolCall.tool,
    ...(toolCall.metadata ? { metadata: toolCall.metadata } : {}),
    input: toolCall.input,
    ...(toolCall.result ? { output: toolCall.result } : {}),
    ...(toolCall.error ? { error: toolCall.error } : {}),
  };
}

function buildMentionTag(mention: NarreMention): string {
  const mentionType = mention.type as string;

  if (mentionType === 'concept') {
    return `[concept:id=${mention.id}, title="${mention.display}"]`;
  }
  if (mentionType === 'network' || mentionType === 'canvas') {
    return `[${mentionType}:id=${mention.id}, name="${mention.display}"]`;
  }
  if (mentionType === 'edge') {
    return `[edge:id=${mention.id}]`;
  }
  if (mentionType === 'archetype') {
    return `[archetype:id=${mention.id}, name="${mention.display}"]`;
  }
  if (mentionType === 'relationType' || mentionType === 'canvasType') {
    return `[${mentionType}:id=${mention.id}, name="${mention.display}"]`;
  }
  if (mentionType === 'module') {
    return `[module:path="${mention.path}"]`;
  }
  if (mentionType === 'file') {
    return `[file:path="${mention.path}"]`;
  }

  return mention.display;
}
