import type { NarreCard, NarreToolCall } from '@netior/shared/types';

export interface NarreMcpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface NarreProviderRunContext {
  projectId: string;
  projectRootDir?: string | null;
  systemPrompt: string;
  userPrompt: string;
  sessionId: string;
  isResume: boolean;
  mcpServers: Record<string, unknown>;
  mcpServerConfigs: NarreMcpServerConfig[];
  onText: (text: string) => void;
  onToolStart: (tool: string, input: Record<string, unknown>) => void;
  onToolEnd: (tool: string, result: string) => void;
  onCard: (card: NarreCard) => void;
}

export interface NarreProviderRunResult {
  assistantText: string;
  toolCalls: NarreToolCall[];
}

export interface NarreProviderAdapter {
  readonly name: string;
  createConversationMcpServers: (sendCard: (card: NarreCard) => void) => Record<string, unknown>;
  resolveUiCall: (toolCallId: string, response: unknown) => boolean;
  run: (context: NarreProviderRunContext) => Promise<NarreProviderRunResult>;
}
