import type { NarreBehaviorSettings, NarreCard, NarreMention } from '@netior/shared/types';
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
  sessionId?: string;
  projectId: string;
  message: string;
  mentions?: NarreMention[];
  projectMetadata?: SystemPromptParams;
}

export interface NarreRuntimeEvents {
  onText: (text: string) => void;
  onToolStart: (tool: string, input: Record<string, unknown>) => void;
  onToolEnd: (tool: string, result: string) => void;
  onCard: (card: NarreCard) => void;
  onError: (error: string) => void;
}

export interface NarreRuntimeConfig {
  mcpDbPath: string;
  electronPath?: string;
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

  async runChat(request: NarreRuntimeChatRequest, events: NarreRuntimeEvents): Promise<{ sessionId: string }> {
    const parsedCommand = parseCommand(request.message);

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

    await this.config.sessionStore.appendMessage(resolvedSessionId, request.projectId, {
      role: 'user',
      content: request.message,
      mentions: request.mentions,
      timestamp: new Date().toISOString(),
    });

    const mcpServerPath = this.config.resolveMcpServerPath();
    if (!mcpServerPath) {
      events.onError('Could not find netior-mcp server. Run: pnpm --filter @netior/mcp build');
      return { sessionId: resolvedSessionId };
    }

    const sessionData = await this.config.sessionStore.getSession(resolvedSessionId, request.projectId);
    const history = sessionData?.messages ?? [];
    const isResume = history.length > 1;
    const mcpServers = this.buildLegacyMcpServers(mcpServerPath, events.onCard);
    const mcpServerConfigs = this.buildMcpServerConfigs(mcpServerPath);
    for (const config of mcpServerConfigs) {
      console.log(
        `[narre] MCP config ${config.name} command=${config.command} ` +
        `args=${JSON.stringify(config.args ?? [])} cwd=${config.cwd ?? '(default)'}`,
      );
    }
    const result = await this.config.provider.run({
      projectId: request.projectId,
      projectRootDir: metadata.projectRootDir ?? null,
      systemPrompt,
      userPrompt: processedMessage,
      sessionId: resolvedSessionId,
      isResume,
      mcpServers,
      mcpServerConfigs,
      onText: events.onText,
      onToolStart: events.onToolStart,
      onToolEnd: events.onToolEnd,
      onCard: events.onCard,
    });

    if (result.assistantText || result.toolCalls.length > 0) {
      await this.config.sessionStore.appendMessage(resolvedSessionId, request.projectId, {
        role: 'assistant',
        content: result.assistantText,
        tool_calls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
        timestamp: new Date().toISOString(),
      });
    }

    return { sessionId: resolvedSessionId };
  }

  private buildLegacyMcpServers(mcpServerPath: string, sendCard: (card: NarreCard) => void): Record<string, unknown> {
    const [netiorConfig] = this.buildMcpServerConfigs(mcpServerPath);

    return {
      netior: {
        command: netiorConfig.command,
        args: netiorConfig.args,
        env: netiorConfig.env,
      },
      ...this.config.provider.createConversationMcpServers(sendCard),
    };
  }

  private buildMcpServerConfigs(mcpServerPath: string): NarreMcpServerConfig[] {
    const runningInsideElectronNode = Boolean(process.versions.electron) || process.env.ELECTRON_RUN_AS_NODE === '1';
    const mcpCommand = runningInsideElectronNode
      ? (this.config.electronPath || process.execPath)
      : process.execPath;
    const mcpEnv: Record<string, string> = { MOC_DB_PATH: this.config.mcpDbPath };

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
