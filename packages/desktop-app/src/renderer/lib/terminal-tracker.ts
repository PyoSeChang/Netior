const exitedSessions = new Set<string>();
let initialized = false;

export function initTerminalTracker(): void {
  if (initialized) return;
  initialized = true;
  window.electron.terminal.onStateChanged((sessionId, state) => {
    if (state === 'running' || state === 'starting' || state === 'created') {
      exitedSessions.delete(sessionId);
      return;
    }
    if (state === 'exited') {
      exitedSessions.add(sessionId);
    }
  });
}

export function isTerminalAlive(sessionId: string): boolean {
  return !exitedSessions.has(sessionId);
}

export function clearTerminalSession(sessionId: string): void {
  exitedSessions.delete(sessionId);
}
