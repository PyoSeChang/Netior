import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@netior/shared/constants';
import type {
  AgentNameEvent,
  AgentProvider,
  AgentSessionEvent,
  AgentSessionSnapshot,
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
  setSessionName?(terminalSessionId: string, name: string): Promise<boolean>;
}

class AgentRuntimeManager implements AgentRuntimeSink {
  private readonly terminalAdapters = new Map<string, AgentRuntimeAdapter[]>();
  private readonly sessionSnapshots = new Map<string, AgentSessionSnapshot>();

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
    this.applySessionEvent(event);
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
    this.applyStatusEvent(event);
    this.broadcast(IPC_CHANNELS.AGENT_STATUS_EVENT, event);

    if (event.provider === 'claude' && (event.status === 'idle' || event.status === 'working')) {
      this.broadcast(IPC_CHANNELS.CLAUDE_STATUS_EVENT, {
        ptySessionId: event.sessionId,
        status: event.status,
      });
    }
  }

  emitNameEvent(event: AgentNameEvent): void {
    this.applyNameEvent(event);
    this.broadcast(IPC_CHANNELS.AGENT_NAME_CHANGED, event);

    if (event.provider === 'claude') {
      this.broadcast(IPC_CHANNELS.CLAUDE_NAME_CHANGED, {
        ptySessionId: event.sessionId,
        sessionName: event.name,
      });
    }
  }

  emitTurnEvent(event: AgentTurnEvent): void {
    this.applyTurnEvent(event);
    this.broadcast(IPC_CHANNELS.AGENT_TURN_EVENT, event);
  }

  getSessionSnapshots(): AgentSessionSnapshot[] {
    return Array.from(this.sessionSnapshots.values(), (snapshot) => ({ ...snapshot }));
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

  async setTerminalSessionName(terminalSessionId: string, name: string): Promise<boolean> {
    const adapters = this.terminalAdapters.get(terminalSessionId);
    if (!adapters || adapters.length === 0) {
      return false;
    }

    let handled = false;
    for (const adapter of adapters) {
      if (!adapter.setSessionName) {
        continue;
      }
      handled = (await adapter.setSessionName(terminalSessionId, name)) || handled;
    }

    return handled;
  }

  private getSessionKey(provider: AgentProvider, sessionId: string): string {
    return `${provider}:${sessionId}`;
  }

  private applySessionEvent(event: AgentSessionEvent): void {
    const key = this.getSessionKey(event.provider, event.sessionId);
    if (event.type === 'stop') {
      this.sessionSnapshots.delete(key);
      return;
    }

    const prev = this.sessionSnapshots.get(key);
    this.sessionSnapshots.set(key, {
      provider: event.provider,
      sessionId: event.sessionId,
      surface: event.surface,
      externalSessionId: event.externalSessionId ?? prev?.externalSessionId ?? null,
      status: prev?.status ?? 'idle',
      reason: prev?.reason ?? null,
      name: prev?.name ?? null,
      turnState: prev?.turnState ?? 'idle',
    });
  }

  private applyStatusEvent(event: AgentStatusEvent): void {
    const key = this.getSessionKey(event.provider, event.sessionId);
    const prev = this.sessionSnapshots.get(key);
    if (!prev) {
      return;
    }

    this.sessionSnapshots.set(key, {
      ...prev,
      status: event.status,
      reason: event.reason ?? null,
    });
  }

  private applyNameEvent(event: AgentNameEvent): void {
    const key = this.getSessionKey(event.provider, event.sessionId);
    const prev = this.sessionSnapshots.get(key);
    if (!prev) {
      return;
    }

    this.sessionSnapshots.set(key, {
      ...prev,
      name: event.name,
    });
  }

  private applyTurnEvent(event: AgentTurnEvent): void {
    const key = this.getSessionKey(event.provider, event.sessionId);
    const prev = this.sessionSnapshots.get(key);
    if (!prev) {
      return;
    }

    this.sessionSnapshots.set(key, {
      ...prev,
      turnState: event.type === 'start' ? 'working' : 'idle',
    });
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
