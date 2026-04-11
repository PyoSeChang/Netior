import type { NarreProviderAdapter, NarreProviderRunContext, NarreProviderRunResult } from '../../runtime/provider-adapter.js';
import type { OpenAIFamilyTransport } from './transport.js';
import { NarreUiBridge } from '../shared/ui-bridge.js';

export class OpenAIFamilyProviderAdapter implements NarreProviderAdapter {
  readonly name: string;

  private readonly uiBridge = new NarreUiBridge();

  constructor(private readonly transport: OpenAIFamilyTransport) {
    this.name = transport.name;
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
