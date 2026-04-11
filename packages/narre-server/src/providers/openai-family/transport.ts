import type { NarreProviderRunContext, NarreProviderRunResult } from '../../runtime/provider-adapter.js';
import type { OpenAIFamilyUiBridge } from './ui-bridge.js';

export interface OpenAIFamilyTransportRunContext extends NarreProviderRunContext {
  uiBridge: OpenAIFamilyUiBridge;
}

export interface OpenAIFamilyTransport {
  readonly name: string;
  run: (context: OpenAIFamilyTransportRunContext) => Promise<NarreProviderRunResult>;
}
