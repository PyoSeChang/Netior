export interface ChangeEvent {
  type: string;
  action: string;
  id: string;
}

export function emitChange(event: ChangeEvent): void {
  // For now, just log. Actual SSE broadcasting will be added
  // when HTTP transport is needed.
  console.error(`[netior-mcp] change: ${event.type}.${event.action} id=${event.id}`);
}
