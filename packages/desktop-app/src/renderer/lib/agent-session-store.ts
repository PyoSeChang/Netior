import type {
  AgentAttentionReason,
  AgentNameEvent,
  AgentSessionEvent,
  AgentStatusEvent,
  AgentTurnEvent,
  AgentUxState,
} from '@netior/shared/types';

export interface AgentSessionState {
  provider: AgentSessionEvent['provider'];
  sessionId: string;
  surface: AgentSessionEvent['surface'];
  externalSessionId: string | null;
  status: AgentStatusEvent['status'];
  uxState: AgentUxState;
  attentionReason: AgentAttentionReason | null;
  name: string | null;
  turnState: 'idle' | 'working';
}

let agentSessions = new Map<string, AgentSessionState>();
const listeners = new Set<() => void>();
let initialized = false;
let version = 0;

function getSessionKey(provider: AgentSessionEvent['provider'], sessionId: string): string {
  return `${provider}:${sessionId}`;
}

function notify(): void {
  version++;
  for (const fn of listeners) fn();
}

function toAttentionReason(reason?: AgentStatusEvent['reason']): AgentAttentionReason | null {
  if (reason === 'approval' || reason === 'user_input' || reason === 'unknown') {
    return reason;
  }

  return null;
}

function toUxState(
  status: AgentStatusEvent['status'],
  attentionReason: AgentAttentionReason | null,
): AgentUxState {
  if (status === 'error') {
    return 'error';
  }
  if (status === 'offline') {
    return 'offline';
  }
  if (status === 'blocked' || attentionReason) {
    return 'needs_attention';
  }
  if (status === 'working') {
    return 'working';
  }
  return 'idle';
}

function updateEntry(
  key: string,
  updater: (prev: AgentSessionState) => AgentSessionState,
): void {
  const prev = agentSessions.get(key);
  if (!prev) return;

  const next = new Map(agentSessions);
  next.set(key, updater(prev));
  agentSessions = next;
  notify();
}

function handleSessionEvent(event: AgentSessionEvent): void {
  const key = getSessionKey(event.provider, event.sessionId);

  if (event.type === 'start') {
    const next = new Map(agentSessions);
    next.set(key, {
      provider: event.provider,
      sessionId: event.sessionId,
      surface: event.surface,
      externalSessionId: event.externalSessionId ?? null,
      status: 'idle',
      uxState: 'idle',
      attentionReason: null,
      name: null,
      turnState: 'idle',
    });
    agentSessions = next;
    notify();
    return;
  }

  if (agentSessions.has(key)) {
    const next = new Map(agentSessions);
    next.delete(key);
    agentSessions = next;
    notify();
  }
}

function handleStatusEvent(event: AgentStatusEvent): void {
  const attentionReason = toAttentionReason(event.reason);
  updateEntry(getSessionKey(event.provider, event.sessionId), (prev) => ({
    ...prev,
    status: event.status,
    uxState: toUxState(event.status, attentionReason),
    attentionReason,
  }));
}

function handleNameEvent(event: AgentNameEvent): void {
  updateEntry(getSessionKey(event.provider, event.sessionId), (prev) => ({
    ...prev,
    name: event.name,
  }));
}

function handleTurnEvent(event: AgentTurnEvent): void {
  updateEntry(getSessionKey(event.provider, event.sessionId), (prev) => ({
    ...prev,
    turnState: event.type === 'start' ? 'working' : 'idle',
  }));
}

export function initAgentSessionStore(): void {
  if (initialized) return;
  initialized = true;

  window.electron.agent.onSessionEvent(handleSessionEvent);
  window.electron.agent.onStatusEvent(handleStatusEvent);
  window.electron.agent.onNameChanged(handleNameEvent);
  window.electron.agent.onTurnEvent(handleTurnEvent);
}

export function getAgentSessionStoreVersion(): number {
  return version;
}

export function subscribeAgentSessionStore(callback: () => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function setAgentSessionName(
  provider: AgentSessionEvent['provider'],
  sessionId: string,
  name: string | null,
): void {
  updateEntry(getSessionKey(provider, sessionId), (prev) => ({
    ...prev,
    name,
  }));
}

export function getAgentSessionStateByTerminal(terminalSessionId: string): AgentSessionState | null {
  for (const state of agentSessions.values()) {
    if (state.surface.kind === 'terminal' && state.surface.id === terminalSessionId) {
      return state;
    }
  }
  return null;
}

export function getAllAgentTerminalStates(): AgentSessionState[] {
  return Array.from(agentSessions.values()).filter((state) => state.surface.kind === 'terminal');
}
