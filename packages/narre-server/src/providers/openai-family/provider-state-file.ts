import fs from 'fs/promises';
import path from 'path';

export class OpenAIFamilyProviderStateFile<TState extends { sessionId: string }> {
  constructor(
    private readonly dataDir: string,
    private readonly projectId: string,
    private readonly sessionId: string,
    private readonly prefix: string,
    private readonly createInitialState: () => TState,
  ) {}

  async read(): Promise<TState> {
    try {
      const content = await fs.readFile(this.sessionFilePath(), 'utf-8');
      return JSON.parse(content) as TState;
    } catch {
      return this.createInitialState();
    }
  }

  async write(state: TState): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.sessionFilePath(), JSON.stringify(state, null, 2), 'utf-8');
  }

  private providerStateDir(): string {
    return path.join(this.dataDir, 'narre', this.projectId, 'provider-state');
  }

  private sessionFilePath(): string {
    return path.join(this.providerStateDir(), `${this.prefix}_${this.sessionId}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.providerStateDir(), { recursive: true });
  }
}
