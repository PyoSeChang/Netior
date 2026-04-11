import type { AgentInputItem, Session } from '@openai/agents';
import { OpenAIFamilyProviderStateFile } from './openai-family/provider-state-file.js';

interface OpenAIFileSessionData {
  sessionId: string;
  items: AgentInputItem[];
}

export class OpenAIFileSession implements Session {
  private readonly stateFile: OpenAIFamilyProviderStateFile<OpenAIFileSessionData>;

  constructor(
    private readonly dataDir: string,
    private readonly projectId: string,
    private readonly sessionId: string,
  ) {
    this.stateFile = new OpenAIFamilyProviderStateFile(
      this.dataDir,
      this.projectId,
      this.sessionId,
      'openai',
      () => ({
        sessionId: this.sessionId,
        items: [],
      }),
    );
  }

  async getSessionId(): Promise<string> {
    return this.sessionId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    const data = await this.read();
    if (limit === undefined) {
      return data.items;
    }

    return data.items.slice(Math.max(0, data.items.length - limit));
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const data = await this.read();
    data.items.push(...items);
    await this.write(data);
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const data = await this.read();
    const popped = data.items.pop();
    await this.write(data);
    return popped;
  }

  async clearSession(): Promise<void> {
    await this.stateFile.write({
      sessionId: this.sessionId,
      items: [],
    });
  }

  private async read(): Promise<OpenAIFileSessionData> {
    return this.stateFile.read();
  }

  private async write(data: OpenAIFileSessionData): Promise<void> {
    await this.stateFile.write(data);
  }
}
