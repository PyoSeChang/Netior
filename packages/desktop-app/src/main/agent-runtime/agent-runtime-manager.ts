import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@netior/shared/constants';
import type {
  AgentNameEvent,
  AgentProvider,
  AgentSessionEvent,
  AgentStatusEvent,
  TerminalLaunchConfig,
  AgentTurnEvent,
} from '@netior/shared/types';
import { ClaudeHookAdapter } from './adapters/claude-hook-adapter';
import { CodexAppServerAdapter } from './adapters/codex-app-server-adapter';

export interface AgentRuntimeSink {
  emitSessionEvent(event: AgentSessionEvent): void;
  emitStatusEvent(event: AgentStatusEvent): void;
  emitNameEvent(event: AgentNameEvent): void;
  emitTurnEvent(event: AgentTurnEvent): void;
}

export type TerminalCleanupReason = 'exit' | 'shutdown';

export interface AgentRuntimeAdapter {
  readonly provider: AgentProvider;
  start(sink: AgentRuntimeSink): Promise<void>;
  stop(): void;
  prepareTerminalLaunch?(
    terminalSessionId: string,
    launchConfig: TerminalLaunchConfig,
  ): Promise<{ launchConfig: TerminalLaunchConfig; active: boolean }>;
  cleanupTerminalLaunch?(terminalSessionId: string, reason: TerminalCleanupReason, exitCode: number | null): void;
}

class AgentRuntimeManager implements AgentRuntimeSink {
  private readonly terminalAdapters = new Map<string, AgentRuntimeAdapter[]>();

  constructor(private readonly adapters: AgentRuntimeAdapter[]) {}

  async start(): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.start(this);
    }
  }

  stop(): void {
    for (const adapter of this.adapters) {
      adapter.stop();
    }
  }

  emitSessionEvent(event: AgentSessionEvent): void {
    this.broadcast(IPC_CHANNELS.AGENT_SESSION_EVENT, event);

    if (event.provider === 'claude' && event.surface.kind === 'terminal') {
      this.broadcast(IPC_CHANNELS.CLAUDE_SESSION_EVENT, {
        ptySessionId: event.surface.id,
        claudeSessionId: event.externalSessionId ?? null,
        type: event.type,
      });
    }
  }

  emitStatusEvent(event: AgentStatusEvent): void {
    this.broadcast(IPC_CHANNELS.AGENT_STATUS_EVENT, event);

    if (event.provider === 'claude' && (event.status === 'idle' || event.status === 'working')) {
      this.broadcast(IPC_CHANNELS.CLAUDE_STATUS_EVENT, {
        ptySessionId: event.sessionId,
        status: event.status,
      });
    }
  }

  emitNameEvent(event: AgentNameEvent): void {
    this.broadcast(IPC_CHANNELS.AGENT_NAME_CHANGED, event);

    if (event.provider === 'claude') {
      this.broadcast(IPC_CHANNELS.CLAUDE_NAME_CHANGED, {
        ptySessionId: event.sessionId,
        sessionName: event.name,
      });
    }
  }

  emitTurnEvent(event: AgentTurnEvent): void {
    this.broadcast(IPC_CHANNELS.AGENT_TURN_EVENT, event);
  }

  async prepareTerminalLaunch(
    terminalSessionId: string,
    launchConfig: TerminalLaunchConfig,
  ): Promise<TerminalLaunchConfig> {
    let resolvedLaunchConfig = launchConfig;
    const activeAdapters: AgentRuntimeAdapter[] = [];

    for (const adapter of this.adapters) {
      if (!adapter.prepareTerminalLaunch) {
        continue;
      }

      const preparedLaunch = await adapter.prepareTerminalLaunch(terminalSessionId, resolvedLaunchConfig);
      resolvedLaunchConfig = preparedLaunch.launchConfig;
      if (preparedLaunch.active) {
        activeAdapters.push(adapter);
      }
    }

    if (activeAdapters.length > 0) {
      this.terminalAdapters.set(terminalSessionId, activeAdapters);
    }

    return resolvedLaunchConfig;
  }

  cleanupTerminalLaunch(
    terminalSessionId: string,
    reason: TerminalCleanupReason,
    exitCode: number | null = null,
  ): void {
    const adapters = this.terminalAdapters.get(terminalSessionId);
    if (!adapters || adapters.length === 0) {
      return;
    }

    for (const adapter of adapters) {
      adapter.cleanupTerminalLaunch?.(terminalSessionId, reason, exitCode);
    }
    this.terminalAdapters.delete(terminalSessionId);
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  }
}

export const agentRuntimeManager = new AgentRuntimeManager([
  new ClaudeHookAdapter(),
  new CodexAppServerAdapter(),
]);
