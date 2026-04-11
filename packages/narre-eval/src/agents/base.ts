import type { NarreCard, NarreStreamEvent } from '@netior/shared/types';
import type { ToolCallRecord, AgentInfo } from '../types.js';

// ── Run context provided to adapter on setup ──

export type AgentRuntimeType = 'http' | 'cli' | 'sdk';

export interface EvalRunContext {
  runId: string;
  port: number;
  dbPath: string;
  dataDir: string;
  serviceUrl: string;
  env: Record<string, string | undefined>;
}

// ── Card handling ──

/**
 * Called by the adapter during the live SSE stream when a card event arrives.
 * Returns the response to submit back to the agent, or null to skip.
 */
export type CardHandler = (card: NarreCard) => unknown;

// ── Turn I/O ──

export interface SendTurnInput {
  sessionId: string | null;
  projectId: string;
  message: string;
  mentions?: unknown[];
  projectMetadata?: Record<string, unknown>;
  /** If provided, called inline during the SSE stream for each card event. */
  onCard?: CardHandler;
}

export interface AdapterTurnResult {
  sessionId: string | null;
  assistantText: string;
  toolCalls: ToolCallRecord[];
  events: NarreStreamEvent[];
  errors: string[];
  cardResponseCount: number;
}

// ── Adapter interface ──

export interface EvalAgentAdapter {
  readonly agentId: string;
  readonly agentName: string;
  readonly runtimeType: AgentRuntimeType;
  readonly capabilities: string[];

  /** Returns AgentInfo for embedding in results. */
  getAgentInfo(): AgentInfo;

  /** Start the agent runtime (server, process, etc.). */
  setup(ctx: EvalRunContext): Promise<void>;

  /**
   * Send a single user turn and stream the response.
   *
   * Session creation is implicit on first call when sessionId is null.
   * If `onCard` is provided, the adapter calls it inline during the live
   * stream when card events arrive, then submits the response back to the
   * agent before continuing to read the stream.
   */
  sendTurn(input: SendTurnInput): Promise<AdapterTurnResult>;

  /** Stop the agent runtime and clean up resources. */
  teardown(): Promise<void>;
}
