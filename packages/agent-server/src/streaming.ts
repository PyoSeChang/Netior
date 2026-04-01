import type { Response } from 'express';
import type { NarreStreamEvent } from '@netior/shared/types';

/**
 * Initialize an Express response for Server-Sent Events (SSE).
 */
export function initSSE(res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
}

/**
 * Send a single SSE event to the client.
 */
export function sendSSEEvent(res: Response, event: NarreStreamEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * End the SSE stream.
 */
export function endSSE(res: Response): void {
  res.end();
}
