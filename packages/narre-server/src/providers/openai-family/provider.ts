import type { NarreCard } from '@netior/shared/types';
import type { NarreProviderAdapter, NarreProviderRunContext, NarreProviderRunResult } from '../../runtime/provider-adapter.js';
import type { OpenAIFamilyTransport } from './transport.js';
import { OpenAIFamilyUiBridge } from './ui-bridge.js';

export class OpenAIFamilyProviderAdapter implements NarreProviderAdapter {
  readonly name: string;

  private readonly uiBridge = new OpenAIFamilyUiBridge();

  constructor(private readonly transport: OpenAIFamilyTransport) {
    this.name = transport.name;
  }

  createConversationMcpServers(_sendCard: (card: NarreCard) => void): Record<string, unknown> {
    return {};
  }

  resolveUiCall(toolCallId: string, response: unknown): boolean {
    return this.uiBridge.resolveResponse(toolCallId, response);
  }

  run(context: NarreProviderRunContext): Promise<NarreProviderRunResult> {
    return this.transport.run({
      ...context,
      uiBridge: this.uiBridge,
    });
  }
}
