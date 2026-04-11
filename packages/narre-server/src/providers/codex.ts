import { OpenAIFamilyProviderAdapter } from './openai-family/provider.js';
import { CodexTransport, type CodexTransportOptions } from './openai-family/codex-transport.js';

export interface CodexProviderAdapterOptions extends CodexTransportOptions {}

export class CodexProviderAdapter extends OpenAIFamilyProviderAdapter {
  constructor(options: CodexProviderAdapterOptions) {
    super(new CodexTransport(options));
  }
}
