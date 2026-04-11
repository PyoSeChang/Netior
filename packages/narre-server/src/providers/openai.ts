import { OpenAIFamilyProviderAdapter } from './openai-family/provider.js';
import { OpenAIDirectTransport, type OpenAIDirectTransportOptions } from './openai-family/openai-transport.js';

export interface OpenAIProviderAdapterOptions extends OpenAIDirectTransportOptions {}

export class OpenAIProviderAdapter extends OpenAIFamilyProviderAdapter {
  constructor(options: OpenAIProviderAdapterOptions) {
    super(new OpenAIDirectTransport(options));
  }
}
