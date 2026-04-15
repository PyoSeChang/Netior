import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  NarreMessage,
  NarreSession,
  NarreSessionDetail,
  NarreSessionFileV1,
  NarreSessionFileV2,
  NarreToolCall,
  NarreTranscript,
  NarreTranscriptTurn,
} from '@netior/shared/types';

interface SessionsIndex {
  sessions: NarreSession[];
}

function createEmptyTranscript(): NarreTranscript {
  return { turns: [] };
}

function createEmptySessionFile(): NarreSessionFileV2 {
  return {
    version: 2,
    transcript: createEmptyTranscript(),
  };
}

function isSessionFileV2(value: unknown): value is NarreSessionFileV2 {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NarreSessionFileV2>;
  return candidate.version === 2 && Array.isArray(candidate.transcript?.turns);
}

function toolBlockToLegacyToolCall(block: {
  toolKey: string;
  metadata?: NarreToolCall['metadata'];
  input: Record<string, unknown>;
  output?: string;
  error?: string;
}): NarreToolCall {
  return {
    tool: block.toolKey,
    input: block.input,
    status: block.error ? 'error' : 'success',
    ...(block.metadata ? { metadata: block.metadata } : {}),
    ...(block.output ? { result: block.output } : {}),
    ...(block.error ? { error: block.error } : {}),
  };
}

function transcriptToMessages(transcript: NarreTranscript): NarreMessage[] {
  return transcript.turns.map((turn) => {
    const textBlocks = turn.blocks.filter((block) => block.type === 'rich_text');
    const content = textBlocks.map((block) => block.text).join('\n\n');
    const mentions = textBlocks.flatMap((block) => block.mentions ?? []);
    const toolCalls = turn.blocks
      .filter((block) => block.type === 'tool')
      .map((block) => toolBlockToLegacyToolCall(block));

    return {
      role: turn.role,
      content,
      ...(mentions.length > 0 ? { mentions } : {}),
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      timestamp: turn.createdAt,
    };
  });
}

function legacyMessageToTurn(message: NarreMessage): NarreTranscriptTurn {
  const blocks: NarreTranscriptTurn['blocks'] = [];

  if (message.content) {
    blocks.push({
      id: `block-${randomUUID()}`,
      type: 'rich_text',
      text: message.content,
      ...(message.mentions && message.mentions.length > 0 ? { mentions: message.mentions } : {}),
    });
  }

  for (const toolCall of message.tool_calls ?? []) {
    blocks.push({
      id: `block-${randomUUID()}`,
      type: 'tool',
      toolKey: toolCall.tool,
      ...(toolCall.metadata ? { metadata: toolCall.metadata } : {}),
      input: toolCall.input,
      ...(toolCall.result ? { output: toolCall.result } : {}),
      ...(toolCall.error ? { error: toolCall.error } : {}),
    });
  }

  return {
    id: `turn-${randomUUID()}`,
    role: message.role,
    createdAt: message.timestamp,
    blocks,
  };
}

function normalizeSessionFile(value: unknown): NarreSessionFileV2 {
  if (isSessionFileV2(value)) {
    return value;
  }

  const legacy = value as Partial<NarreSessionFileV1> | null;
  const messages = Array.isArray(legacy?.messages) ? legacy.messages : [];

  return {
    version: 2,
    transcript: {
      turns: messages.map(legacyMessageToTurn),
    },
  };
}

function buildSessionDetail(projectId: string, session: NarreSession, file: NarreSessionFileV2): NarreSessionDetail {
  return {
    ...session,
    projectId,
    transcript: file.transcript,
    messages: transcriptToMessages(file.transcript),
  };
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

  private async readSessionFile(projectId: string, sessionId: string): Promise<NarreSessionFileV2 | null> {
    try {
      const content = await fs.readFile(this.sessionFilePath(projectId, sessionId), 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      const normalized = normalizeSessionFile(parsed);

      if (!isSessionFileV2(parsed)) {
        await this.writeSessionFile(projectId, sessionId, normalized);
      }

      return normalized;
    } catch {
      return null;
    }
  }

  private async writeSessionFile(projectId: string, sessionId: string, data: NarreSessionFileV2): Promise<void> {
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
    await this.writeSessionFile(projectId, session.id, createEmptySessionFile());

    return session;
  }

  async getSession(
    sessionId: string,
    projectId: string,
  ): Promise<NarreSessionDetail | null> {
    const index = await this.readIndex(projectId);
    const session = index.sessions.find((s) => s.id === sessionId);
    if (!session) return null;

    const file = await this.readSessionFile(projectId, sessionId) ?? createEmptySessionFile();
    return buildSessionDetail(projectId, session, file);
  }

  private async listProjectIds(): Promise<string[]> {
    try {
      const entries = await fs.readdir(path.join(this.dataDir, 'narre'), { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  async getSessionById(
    sessionId: string,
  ): Promise<NarreSessionDetail | null> {
    const projectIds = await this.listProjectIds();
    for (const projectId of projectIds) {
      const result = await this.getSession(sessionId, projectId);
      if (result) {
        return result;
      }
    }
    return null;
  }

  async appendTurn(sessionId: string, projectId: string, turn: NarreTranscriptTurn): Promise<void> {
    const file = await this.readSessionFile(projectId, sessionId) ?? createEmptySessionFile();
    file.transcript.turns.push(turn);
    await this.writeSessionFile(projectId, sessionId, file);

    const index = await this.readIndex(projectId);
    const session = index.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.last_message_at = turn.createdAt;
      session.message_count = file.transcript.turns.length;
    }
    await this.writeIndex(projectId, index);
  }

  async upsertTurn(sessionId: string, projectId: string, turn: NarreTranscriptTurn): Promise<void> {
    const file = await this.readSessionFile(projectId, sessionId) ?? createEmptySessionFile();
    const existingIndex = file.transcript.turns.findIndex((candidate) => candidate.id === turn.id);

    if (existingIndex >= 0) {
      file.transcript.turns[existingIndex] = turn;
    } else {
      file.transcript.turns.push(turn);
    }

    await this.writeSessionFile(projectId, sessionId, file);

    const index = await this.readIndex(projectId);
    const session = index.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.last_message_at = turn.createdAt;
      session.message_count = file.transcript.turns.length;
    }
    await this.writeIndex(projectId, index);
  }

  async removeTurn(sessionId: string, projectId: string, turnId: string): Promise<void> {
    const file = await this.readSessionFile(projectId, sessionId) ?? createEmptySessionFile();
    const nextTurns = file.transcript.turns.filter((turn) => turn.id !== turnId);
    if (nextTurns.length === file.transcript.turns.length) {
      return;
    }

    file.transcript.turns = nextTurns;
    await this.writeSessionFile(projectId, sessionId, file);

    const index = await this.readIndex(projectId);
    const session = index.sessions.find((s) => s.id === sessionId);
    if (session) {
      const lastTurn = nextTurns[nextTurns.length - 1];
      session.last_message_at = lastTurn?.createdAt ?? session.created_at;
      session.message_count = nextTurns.length;
    }
    await this.writeIndex(projectId, index);
  }

  async updateCardResponse(
    sessionId: string,
    projectId: string,
    toolCallId: string,
    response: unknown,
  ): Promise<boolean> {
    const file = await this.readSessionFile(projectId, sessionId) ?? createEmptySessionFile();
    let updated = false;

    for (const turn of file.transcript.turns) {
      for (const block of turn.blocks) {
        if (
          block.type === 'card'
          && block.card.toolCallId === toolCallId
        ) {
          switch (block.card.type) {
            case 'permission': {
              const actionKey = response && typeof response === 'object'
                ? (response as { action?: unknown }).action
                : undefined;
              if (typeof actionKey === 'string' && actionKey.length > 0) {
                block.card.resolvedActionKey = actionKey;
                updated = true;
              }
              break;
            }
            case 'draft':
              if (response && typeof response === 'object') {
                block.card.submittedResponse = response as typeof block.card.submittedResponse;
                updated = true;
              }
              break;
            case 'interview':
              if (response && typeof response === 'object') {
                block.card.submittedResponse = response as typeof block.card.submittedResponse;
                updated = true;
              }
              break;
            default:
              break;
          }
        }
      }
    }

    if (!updated) {
      return false;
    }

    await this.writeSessionFile(projectId, sessionId, file);
    return true;
  }

  async updateCardResponseById(
    sessionId: string,
    toolCallId: string,
    response: unknown,
  ): Promise<boolean> {
    const session = await this.getSessionById(sessionId);
    if (!session?.projectId) {
      return false;
    }

    return this.updateCardResponse(sessionId, session.projectId, toolCallId, response);
  }

  async appendMessage(sessionId: string, projectId: string, message: NarreMessage): Promise<void> {
    await this.appendTurn(sessionId, projectId, legacyMessageToTurn(message));
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

  async deleteSessionById(sessionId: string): Promise<boolean> {
    const projectIds = await this.listProjectIds();
    for (const projectId of projectIds) {
      const deleted = await this.deleteSession(sessionId, projectId);
      if (deleted) {
        return true;
      }
    }
    return false;
  }
}
