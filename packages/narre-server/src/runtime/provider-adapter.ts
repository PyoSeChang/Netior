import type { NarreCard, NarreToolCall, NarreToolMetadata } from '@netior/shared/types';

type MaybePromise = void | Promise<void>;

export interface NarreMcpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface NarreProviderRunContext {
  traceId?: string;
  projectId: string;
  projectRootDir?: string | null;
  systemPrompt: string;
  userPrompt: string;
  sessionId: string;
  isResume: boolean;
  signal?: AbortSignal;
  mcpServerConfigs: NarreMcpServerConfig[];
  onText: (text: string) => MaybePromise;
  onToolStart: (tool: string, input: Record<string, unknown>, metadata: NarreToolMetadata) => MaybePromise;
  onToolEnd: (tool: string, result: string, metadata: NarreToolMetadata) => MaybePromise;
  onCard: (card: NarreCard) => MaybePromise;
}

export interface NarreProviderRunResult {
  assistantText: string;
  toolCalls: NarreToolCall[];
}

export interface NarreProviderAdapter {
  readonly name: string;
  resolveUiCall: (toolCallId: string, response: unknown) => boolean;
  run: (context: NarreProviderRunContext) => Promise<NarreProviderRunResult>;
}
