import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { NarreSession, NarreMessage } from '@netior/shared/types';

interface SessionsIndex {
  sessions: NarreSession[];
}

interface SessionFile {
  messages: NarreMessage[];
}

export class SessionStore {
  constructor(private dataDir: string) {}

  private projectDir(projectId: string): string {
    return path.join(this.dataDir, 'narre', projectId);
  }

  private indexPath(projectId: string): string {
    return path.join(this.projectDir(projectId), 'sessions.json');
  }

  private sessionFilePath(projectId: string, sessionId: string): string {
    return path.join(this.projectDir(projectId), `session_${sessionId}.json`);
  }

  private async ensureDir(projectId: string): Promise<void> {
    await fs.mkdir(this.projectDir(projectId), { recursive: true });
  }

  private async readIndex(projectId: string): Promise<SessionsIndex> {
    try {
      const content = await fs.readFile(this.indexPath(projectId), 'utf-8');
      return JSON.parse(content) as SessionsIndex;
    } catch {
      return { sessions: [] };
    }
  }

  private async writeIndex(projectId: string, index: SessionsIndex): Promise<void> {
    await this.ensureDir(projectId);
    await fs.writeFile(this.indexPath(projectId), JSON.stringify(index, null, 2), 'utf-8');
  }

  private async readSessionFile(projectId: string, sessionId: string): Promise<SessionFile | null> {
    try {
      const content = await fs.readFile(this.sessionFilePath(projectId, sessionId), 'utf-8');
      return JSON.parse(content) as SessionFile;
    } catch {
      return null;
    }
  }

  private async writeSessionFile(projectId: string, sessionId: string, data: SessionFile): Promise<void> {
    await this.ensureDir(projectId);
    await fs.writeFile(this.sessionFilePath(projectId, sessionId), JSON.stringify(data, null, 2), 'utf-8');
  }

  async listSessions(projectId: string): Promise<NarreSession[]> {
    const index = await this.readIndex(projectId);
    // Return sorted by last_message_at descending
    return index.sessions.sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
    );
  }

  async createSession(projectId: string, title?: string): Promise<NarreSession> {
    const now = new Date().toISOString();
    const session: NarreSession = {
      id: randomUUID(),
      title: title ?? 'New conversation',
      created_at: now,
      last_message_at: now,
      message_count: 0,
    };

    const index = await this.readIndex(projectId);
    index.sessions.push(session);
    await this.writeIndex(projectId, index);
    await this.writeSessionFile(projectId, session.id, { messages: [] });

    return session;
  }

  async getSession(
    sessionId: string,
    projectId: string,
  ): Promise<{ session: NarreSession; messages: NarreMessage[] } | null> {
    const index = await this.readIndex(projectId);
    const session = index.sessions.find((s) => s.id === sessionId);
    if (!session) return null;

    const file = await this.readSessionFile(projectId, sessionId);
    return { session, messages: file?.messages ?? [] };
  }

  async appendMessage(sessionId: string, projectId: string, message: NarreMessage): Promise<void> {
    // Update session file
    const file = await this.readSessionFile(projectId, sessionId) ?? { messages: [] };
    file.messages.push(message);
    await this.writeSessionFile(projectId, sessionId, file);

    // Update index
    const index = await this.readIndex(projectId);
    const session = index.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.last_message_at = message.timestamp;
      session.message_count = file.messages.length;
    }
    await this.writeIndex(projectId, index);
  }

  async updateSessionTitle(sessionId: string, projectId: string, title: string): Promise<void> {
    const index = await this.readIndex(projectId);
    const session = index.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.title = title;
      await this.writeIndex(projectId, index);
    }
  }

  async deleteSession(sessionId: string, projectId: string): Promise<boolean> {
    const index = await this.readIndex(projectId);
    const idx = index.sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return false;

    index.sessions.splice(idx, 1);
    await this.writeIndex(projectId, index);

    // Remove session file (ignore if missing)
    try {
      await fs.unlink(this.sessionFilePath(projectId, sessionId));
    } catch {
      // file may not exist
    }
    return true;
  }
}
