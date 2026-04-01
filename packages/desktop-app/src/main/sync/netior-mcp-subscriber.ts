import type { BrowserWindow } from 'electron';

/**
 * Placeholder for netior-mcp SSE subscription.
 * Will connect to netior-mcp's /events SSE endpoint when HTTP transport is implemented.
 * For now, the agent-server-manager can directly notify the renderer after tool calls.
 */
export function startMocMcpSubscriber(_mainWindow: BrowserWindow): void {
  // TODO: Connect to netior-mcp SSE /events endpoint
  // For MVP: agent-server tool calls will trigger store refresh via narre:streamEvent handler
  console.log('[netior-sync] Subscriber placeholder initialized');
}

export function stopMocMcpSubscriber(): void {
  // TODO: Disconnect SSE
}
