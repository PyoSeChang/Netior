import type {
  AgentAttentionReason,
  AgentNameEvent,
  AgentSessionEvent,
  AgentSessionSnapshot,
  AgentStatusEvent,
  AgentTurnEvent,
  AgentUxState,
} from '@netior/shared/types';
import { useEditorStore } from '../stores/editor-store';

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

function syncTerminalTabTitle(state: AgentSessionState, name: string | null): void {
  if (!name || state.surface.kind !== 'terminal') {
    return;
  }

  useEditorStore.getState().updateTitle(`terminal:${state.surface.id}`, name);
}

function toSessionState(snapshot: AgentSessionSnapshot): AgentSessionState {
  const attentionReason = toAttentionReason(snapshot.reason);
  return {
    provider: snapshot.provider,
    sessionId: snapshot.sessionId,
    surface: snapshot.surface,
    externalSessionId: snapshot.externalSessionId ?? null,
    status: snapshot.status,
    uxState: toUxState(snapshot.status, attentionReason),
    attentionReason,
    name: snapshot.name,
    turnState: snapshot.turnState,
  };
}

function hydrateSnapshot(snapshots: AgentSessionSnapshot[]): void {
  if (snapshots.length === 0) {
    return;
  }

  let changed = false;
  const next = new Map(agentSessions);

  for (const snapshot of snapshots) {
    const key = getSessionKey(snapshot.provider, snapshot.sessionId);
    const state = toSessionState(snapshot);
    const prev = next.get(key);
    if (
      prev
      && prev.provider === state.provider
      && prev.sessionId === state.sessionId
      && prev.surface.kind === state.surface.kind
      && prev.surface.id === state.surface.id
      && prev.externalSessionId === state.externalSessionId
      && prev.status === state.status
      && prev.uxState === state.uxState
      && prev.attentionReason === state.attentionReason
      && prev.name === state.name
      && prev.turnState === state.turnState
    ) {
      continue;
    }

    next.set(key, state);
    syncTerminalTabTitle(state, state.name);
    changed = true;
  }

  if (!changed) {
    return;
  }

  agentSessions = next;
  notify();
}

export async function refreshAgentSessionStore(): Promise<void> {
  const snapshots = await window.electron.agent.getSnapshot();
  hydrateSnapshot(snapshots);
}

function handleSessionEvent(event: AgentSessionEvent): void {
  const key = getSessionKey(event.provider, event.sessionId);

  if (event.type === 'start') {
    const prev = agentSessions.get(key);
    const next = new Map(agentSessions);
    next.set(key, {
      provider: event.provider,
      sessionId: event.sessionId,
      surface: event.surface,
      externalSessionId: event.externalSessionId ?? prev?.externalSessionId ?? null,
      status: prev?.status ?? 'idle',
      uxState: prev?.uxState ?? 'idle',
      attentionReason: prev?.attentionReason ?? null,
      name: prev?.name ?? null,
      turnState: prev?.turnState ?? 'idle',
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
  const key = getSessionKey(event.provider, event.sessionId);
  updateEntry(key, (prev) => ({
    ...prev,
    name: event.name,
  }));

  const state = agentSessions.get(key);
  if (state) {
    syncTerminalTabTitle(state, event.name);
  }
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
  void refreshAgentSessionStore().catch(() => {});
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
