import { OpenAIFamilyProviderStateFile } from './openai-family/provider-state-file.js';

interface CodexThreadState {
  sessionId: string;
  threadId: string | null;
}

export class CodexThreadStore {
  private readonly stateFile: OpenAIFamilyProviderStateFile<CodexThreadState>;

  constructor(
    private readonly dataDir: string,
    private readonly projectId: string,
    private readonly sessionId: string,
  ) {
    this.stateFile = new OpenAIFamilyProviderStateFile(
      this.dataDir,
      this.projectId,
      this.sessionId,
      'codex',
      () => ({
        sessionId: this.sessionId,
        threadId: null,
      }),
    );
  }

  async getThreadId(): Promise<string | null> {
    const state = await this.read();
    return state.threadId;
  }

  async setThreadId(threadId: string): Promise<void> {
    const state = await this.read();
    state.threadId = threadId;
    await this.write(state);
  }

  private async read(): Promise<CodexThreadState> {
    return this.stateFile.read();
  }

  private async write(state: CodexThreadState): Promise<void> {
    await this.stateFile.write(state);
  }
}
