import type { NarreCard } from '@netior/shared/types';
import { NarreUiBridge } from './providers/shared/ui-bridge.js';
import { createClaudeSdkUiServer } from './providers/shared/claude-sdk-ui-server.js';

const legacyUiBridge = new NarreUiBridge();

export function resolveUiCall(callId: string, response: unknown): boolean {
  return legacyUiBridge.resolveResponse(callId, response);
}

export function createNarreUiServer(sendCard: (card: NarreCard) => void) {
  return createClaudeSdkUiServer(sendCard, legacyUiBridge);
}
