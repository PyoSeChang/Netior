import type { ClaudeCodeStatus } from '@netior/shared/types';

export interface ClaudeTerminalState {
  ptySessionId: string;
  claudeSessionId: string;
  status: ClaudeCodeStatus;
  sessionName: string | null;
}

let claudeTerminals = new Map<string, ClaudeTerminalState>();
const listeners = new Set<() => void>();
let initialized = false;
let version = 0;

function notify(): void {
  version++;
  for (const fn of listeners) fn();
}

/** Immutably update a single entry in the map */
function updateEntry(ptySessionId: string, updater: (prev: ClaudeTerminalState) => ClaudeTerminalState): void {
  const prev = claudeTerminals.get(ptySessionId);
  if (!prev) return;
  const next = new Map(claudeTerminals);
  next.set(ptySessionId, updater(prev));
  claudeTerminals = next;
  notify();
}

export function initClaudeTerminalTracker(): void {
  if (initialized) return;
  initialized = true;

  window.electron.claude.onSessionEvent((event) => {
    if (event.type === 'start' && event.claudeSessionId) {
      const next = new Map(claudeTerminals);
      next.set(event.ptySessionId, {
        ptySessionId: event.ptySessionId,
        claudeSessionId: event.claudeSessionId,
        status: 'idle',
        sessionName: null,
      });
      claudeTerminals = next;
      notify();
    } else if (event.type === 'stop') {
      const next = new Map(claudeTerminals);
      next.delete(event.ptySessionId);
      claudeTerminals = next;
      notify();
    }
  });

  window.electron.claude.onStatusEvent((event) => {
    updateEntry(event.ptySessionId, (prev) => ({ ...prev, status: event.status }));
  });

  window.electron.claude.onNameChanged((event) => {
    updateEntry(event.ptySessionId, (prev) => ({ ...prev, sessionName: event.sessionName }));
  });
}

export function getClaudeTerminalState(ptySessionId: string): ClaudeTerminalState | null {
  return claudeTerminals.get(ptySessionId) ?? null;
}

export function getAllClaudeTerminalStates(): ClaudeTerminalState[] {
  return Array.from(claudeTerminals.values());
}

export function getClaudeTrackerVersion(): number {
  return version;
}

export function isClaudeTerminal(ptySessionId: string): boolean {
  return claudeTerminals.has(ptySessionId);
}

export function subscribeClaudeTracker(callback: () => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
