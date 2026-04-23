import { ipcMain, BrowserWindow } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import http from 'http';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type {
  AgentDefinition,
  IpcResult,
  NarreMessage,
  NarreSessionDetail,
  NarreSessionFileV1,
  NarreSessionFileV2,
  NarreSession,
  NarreStreamEvent,
  NarreToolCall,
  NarreTranscript,
  SkillDefinition,
  SupervisorAgentSessionSnapshot,
  SupervisorEvent,
} from '@netior/shared/types';
import { BUILT_IN_SKILLS, IPC_CHANNELS } from '@netior/shared/constants';
import {
  listRemoteArchetypes,
  listRemoteFilesByProject,
  listRemoteNetworks,
  listRemoteRelationTypes,
  searchRemoteConcepts,
} from '../netior-service/netior-service-client';
import {
  getNarreServerBaseUrl,
  isNarreServerRunning,
} from '../process/narre-server-manager';
import {
  getApiKeySettingKey,
  getConfiguredNarreApiKey,
  getConfiguredNarreProvider,
  syncNarreServerWithSettings,
  writeNarreSetting,
} from '../narre/narre-config';
import { getRuntimeLogsDir, getRuntimeNarreDir } from '../runtime/runtime-paths';

const NARRE_TRACE_HEADER = 'x-netior-trace-id';

interface ActiveNarreChatRequest {
  request: http.ClientRequest;
  projectId: string;
  sessionId: string;
  mainWindow: BrowserWindow;
  cancelled: boolean;
}

const activeNarreChatRequests = new Map<string, ActiveNarreChatRequest>();
const cancelledNarreChatRequests = new WeakSet<http.ClientRequest>();

function getNarreDir(projectId: string): string {
  const dir = getRuntimeNarreDir(projectId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSessionsIndex(projectId: string): { sessions: NarreSession[] } {
  const dir = getNarreDir(projectId);
  const indexPath = join(dir, 'sessions.json');
  if (!existsSync(indexPath)) {
    return { sessions: [] };
  }
  return JSON.parse(readFileSync(indexPath, 'utf-8'));
}

function saveSessionsIndex(projectId: string, data: { sessions: NarreSession[] }): void {
  const dir = getNarreDir(projectId);
  const indexPath = join(dir, 'sessions.json');
  writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf-8');
}

function cleanupActiveNarreChatRequest(sessionId: string, request: http.ClientRequest): void {
  const activeRequest = activeNarreChatRequests.get(sessionId);
  if (activeRequest?.request === request) {
    activeNarreChatRequests.delete(sessionId);
  }
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

function normalizeSessionFile(value: unknown): NarreSessionFileV2 {
  if (isSessionFileV2(value)) {
    return value;
  }

  const legacy = value as Partial<NarreSessionFileV1> | null;
  const messages = Array.isArray(legacy?.messages) ? legacy.messages : [];

  return {
    version: 2,
    transcript: {
      turns: messages.map((message) => ({
        id: `turn-${randomUUID()}`,
        role: message.role,
        createdAt: message.timestamp,
        blocks: [
          ...(message.content ? [{
            id: `block-${randomUUID()}`,
            type: 'rich_text' as const,
            text: message.content,
            ...(message.mentions && message.mentions.length > 0 ? { mentions: message.mentions } : {}),
          }] : []),
          ...((message.tool_calls ?? []).map((toolCall) => ({
            id: `block-${randomUUID()}`,
            type: 'tool' as const,
            toolKey: toolCall.tool,
            ...(toolCall.metadata ? { metadata: toolCall.metadata } : {}),
            input: toolCall.input,
            ...(toolCall.result ? { output: toolCall.result } : {}),
            ...(toolCall.error ? { error: toolCall.error } : {}),
          }))),
        ],
      })),
    },
  };
}

function buildSessionDetail(
  session: NarreSession | undefined,
  projectId: string,
  file: NarreSessionFileV2,
): NarreSessionDetail {
  return {
    ...(session ?? {
      id: '',
      title: '',
      created_at: new Date(0).toISOString(),
      last_message_at: new Date(0).toISOString(),
      message_count: file.transcript.turns.length,
    }),
    projectId,
    transcript: file.transcript,
    messages: transcriptToMessages(file.transcript),
  };
}

function getNarreServerUrl(path: string): URL {
  const baseUrl = getNarreServerBaseUrl();
  if (!baseUrl) {
    throw new Error('Narre server is not running');
  }

  return new URL(path, baseUrl);
}

async function ensureNarreServerBaseUrl(): Promise<string> {
  const existingBaseUrl = getNarreServerBaseUrl();
  if (existingBaseUrl) {
    return existingBaseUrl;
  }

  try {
    const started = await syncNarreServerWithSettings();
    if (!started) {
      throw new Error('Narre server start was skipped. Check the selected provider and API key.');
    }
  } catch (error) {
    const logPath = join(getRuntimeLogsDir(), 'narre-server.log');
    throw new Error(`${(error as Error).message} See ${logPath}`);
  }

  const restartedBaseUrl = getNarreServerBaseUrl();
  if (!restartedBaseUrl) {
    const logPath = join(getRuntimeLogsDir(), 'narre-server.log');
    throw new Error(`Narre server failed to start. See ${logPath}`);
  }

  return restartedBaseUrl;
}

async function requestNarreServer<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = await ensureNarreServerBaseUrl();

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Narre server request failed: ${response.status}`;
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Ignore parse failures and keep the HTTP status message.
    }
    throw new Error(message);
  }

  return await response.json() as T;
}

function summarizeNarreStreamEvent(event: NarreStreamEvent): string {
  switch (event.type) {
    case 'text':
      return `type=text chars=${event.content?.length ?? 0}`;
    case 'tool_start':
      return `type=tool_start tool=${event.tool ?? 'unknown'}`;
    case 'tool_end':
      return `type=tool_end tool=${event.tool ?? 'unknown'}`;
    case 'card':
      return `type=card card=${event.card?.type ?? 'unknown'}`;
    case 'error':
      return `type=error error=${JSON.stringify(event.error ?? '')}`;
    case 'done':
      return `type=done session=${event.sessionId ?? 'unknown'}`;
    default:
      return `type=${(event as { type?: string }).type ?? 'unknown'}`;
  }
}

async function listRemoteNarreSessions(projectId: string): Promise<NarreSession[]> {
  return requestNarreServer<NarreSession[]>(`/sessions?projectId=${encodeURIComponent(projectId)}`);
}

async function listRemoteNarreSkills(projectId: string): Promise<SkillDefinition[]> {
  return requestNarreServer<SkillDefinition[]>(`/skills?projectId=${encodeURIComponent(projectId)}`);
}

async function listRemoteSupervisorAgents(projectId?: string | null): Promise<AgentDefinition[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return requestNarreServer<AgentDefinition[]>(`/supervisor/agents${query}`);
}

async function listRemoteSupervisorSkills(projectId: string): Promise<SkillDefinition[]> {
  return requestNarreServer<SkillDefinition[]>(`/supervisor/skills?projectId=${encodeURIComponent(projectId)}`);
}

async function listRemoteSupervisorSessions(): Promise<SupervisorAgentSessionSnapshot[]> {
  return requestNarreServer<SupervisorAgentSessionSnapshot[]>('/supervisor/sessions');
}

async function listRemoteSupervisorEvents(afterSeq?: number | null): Promise<SupervisorEvent[]> {
  const query = typeof afterSeq === 'number' ? `?afterSeq=${encodeURIComponent(String(afterSeq))}` : '';
  return requestNarreServer<SupervisorEvent[]>(`/supervisor/events${query}`);
}

async function createRemoteNarreSession(projectId: string): Promise<NarreSession> {
  return requestNarreServer<NarreSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

async function getRemoteNarreSession(sessionId: string): Promise<NarreSessionDetail> {
  return requestNarreServer<NarreSessionDetail>(`/sessions/${encodeURIComponent(sessionId)}`);
}

async function deleteRemoteNarreSession(sessionId: string): Promise<boolean> {
  const payload = await requestNarreServer<{ success: boolean }>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  return payload.success;
}

function emitNarreStreamEvent(
  mainWindow: BrowserWindow,
  event: NarreStreamEvent,
  context: { projectId?: string; sessionId?: string },
): void {
  if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return;
  }

  try {
    mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, {
      ...event,
      projectId: event.projectId ?? context.projectId,
      sessionId: event.sessionId ?? context.sessionId,
    } satisfies NarreStreamEvent);
  } catch (error) {
    if ((error as Error).message?.includes('Object has been destroyed')) {
      return;
    }
    throw error;
  }
}

export function registerNarreIpc(): void {
  ipcMain.handle(IPC_CHANNELS.NARRE_LIST_SESSIONS, async (_e, projectId: string): Promise<IpcResult<NarreSession[]>> => {
    try {
      if (isNarreServerRunning()) {
        return { success: true, data: await listRemoteNarreSessions(projectId) };
      }

      const index = getSessionsIndex(projectId);
      index.sessions.sort((a, b) =>
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
      );
      return { success: true, data: index.sessions };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_LIST_SKILLS, async (_e, projectId: string): Promise<IpcResult<SkillDefinition[]>> => {
    try {
      return { success: true, data: await listRemoteNarreSkills(projectId) };
    } catch (err) {
      console.warn(`[narre:bridge] failed to list skills, using built-ins: ${(err as Error).message}`);
      return { success: true, data: [...BUILT_IN_SKILLS] };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_AGENTS,
    async (_e, projectId?: string | null): Promise<IpcResult<AgentDefinition[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorAgents(projectId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_SKILLS,
    async (_e, projectId: string): Promise<IpcResult<SkillDefinition[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorSkills(projectId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_SESSIONS,
    async (): Promise<IpcResult<SupervisorAgentSessionSnapshot[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorSessions() };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.NARRE_SUPERVISOR_LIST_EVENTS,
    async (_e, afterSeq?: number | null): Promise<IpcResult<SupervisorEvent[]>> => {
      try {
        return { success: true, data: await listRemoteSupervisorEvents(afterSeq) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.NARRE_CREATE_SESSION, async (_e, projectId: string): Promise<IpcResult<NarreSession>> => {
    try {
      if (isNarreServerRunning()) {
        return { success: true, data: await createRemoteNarreSession(projectId) };
      }

      const now = new Date().toISOString();
      const session: NarreSession = {
        id: randomUUID(),
        title: '',
        created_at: now,
        last_message_at: now,
        message_count: 0,
      };

      const index = getSessionsIndex(projectId);
      index.sessions.push(session);
      saveSessionsIndex(projectId, index);

      // Create empty session file
      const dir = getNarreDir(projectId);
      const sessionPath = join(dir, `session_${session.id}.json`);
      writeFileSync(sessionPath, JSON.stringify(createEmptySessionFile(), null, 2), 'utf-8');

      return { success: true, data: session };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_GET_SESSION, async (_e, sessionId: string): Promise<IpcResult<unknown>> => {
    try {
      if (isNarreServerRunning()) {
        return { success: true, data: await getRemoteNarreSession(sessionId) };
      }

      // We need to search across all project dirs to find the session
      // For now, the sessionId is globally unique, so we scan
      const baseDir = getRuntimeNarreDir();
      if (!existsSync(baseDir)) {
        return { success: false, error: 'Session not found' };
      }

      const { readdirSync } = require('fs');
      const projectDirs = readdirSync(baseDir, { withFileTypes: true })
        .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
        .map((d: { name: string }) => d.name);

      for (const projectId of projectDirs) {
        const sessionPath = join(baseDir, projectId, `session_${sessionId}.json`);
        if (existsSync(sessionPath)) {
          const parsed = JSON.parse(readFileSync(sessionPath, 'utf-8')) as unknown;
          const data = normalizeSessionFile(parsed);
          if (!isSessionFileV2(parsed)) {
            writeFileSync(sessionPath, JSON.stringify(data, null, 2), 'utf-8');
          }
          const index = getSessionsIndex(projectId);
          const sessionMeta = index.sessions.find((s) => s.id === sessionId);
          return { success: true, data: buildSessionDetail(sessionMeta, projectId, data) };
        }
      }

      return { success: false, error: 'Session not found' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_DELETE_SESSION, async (_e, sessionId: string): Promise<IpcResult<boolean>> => {
    try {
      if (isNarreServerRunning()) {
        return { success: true, data: await deleteRemoteNarreSession(sessionId) };
      }

      const baseDir = getRuntimeNarreDir();
      if (!existsSync(baseDir)) {
        return { success: false, error: 'Session not found' };
      }

      const { readdirSync } = require('fs');
      const projectDirs = readdirSync(baseDir, { withFileTypes: true })
        .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
        .map((d: { name: string }) => d.name);

      for (const projectId of projectDirs) {
        const index = getSessionsIndex(projectId);
        const sessionIdx = index.sessions.findIndex((s) => s.id === sessionId);
        if (sessionIdx >= 0) {
          index.sessions.splice(sessionIdx, 1);
          saveSessionsIndex(projectId, index);

          const sessionPath = join(baseDir, projectId, `session_${sessionId}.json`);
          if (existsSync(sessionPath)) {
            unlinkSync(sessionPath);
          }
          return { success: true, data: true };
        }
      }

      return { success: false, error: 'Session not found' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_GET_API_KEY_STATUS, async (): Promise<IpcResult<boolean>> => {
    try {
      const provider = await getConfiguredNarreProvider();
      if (provider === 'codex') {
        return { success: true, data: true };
      }

      const key = await getConfiguredNarreApiKey(provider);
      return { success: true, data: typeof key === 'string' && key.length > 0 };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_SET_API_KEY, async (_e, key: string): Promise<IpcResult<boolean>> => {
    try {
      const provider = await getConfiguredNarreProvider();
      const keySetting = getApiKeySettingKey(provider);
      if (!keySetting) {
        return { success: false, error: 'Selected Narre provider uses local Codex login instead of an API key.' };
      }
      await writeNarreSetting(keySetting, key);
      await syncNarreServerWithSettings();
      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_SEARCH_MENTIONS, async (_e, projectId: string, query: string): Promise<IpcResult<unknown>> => {
    try {
      const results: Array<{
        type: string; id: string; display: string;
        color?: string | null; icon?: string | null;
        description?: string | null; meta?: Record<string, unknown>;
      }> = [];
      const maxResults = 30;
      const lowerQuery = query.toLowerCase();

      const archetypes = await listRemoteArchetypes(projectId);
      const archetypeMap = new Map(archetypes.map((a) => [a.id, a]));
      const concepts = await searchRemoteConcepts(projectId, query);

      for (const c of concepts) {
        if (results.length >= maxResults) break;
        const arch = c.archetype_id ? archetypeMap.get(c.archetype_id) : null;
        results.push({
          type: 'concept', id: c.id, display: c.title, color: c.color, icon: c.icon,
          meta: { archetype: arch?.name ?? null },
        });
      }

      // Search archetypes
      for (const a of archetypeMap.values()) {
        if (results.length >= maxResults) break;
        if (a.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'archetype', id: a.id, display: a.name, color: a.color, icon: a.icon,
            description: a.description, meta: { nodeShape: a.node_shape },
          });
        }
      }

      // Search relation types
      const relationTypes = await listRemoteRelationTypes(projectId);
      for (const rt of relationTypes) {
        if (results.length >= maxResults) break;
        if (rt.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'relationType', id: rt.id, display: rt.name, color: rt.color,
            description: rt.description, meta: { directed: rt.directed, lineStyle: rt.line_style },
          });
        }
      }

      // Search networks
      const networks = await listRemoteNetworks(projectId);
      for (const nw of networks) {
        if (results.length >= maxResults) break;
        if (nw.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'network', id: nw.id, display: nw.name,
            meta: {},
          });
        }
      }

      // Search file entities
      const files = await listRemoteFilesByProject(projectId);
      for (const fe of files) {
        if (results.length >= maxResults) break;
        const fileName = fe.path.split('/').pop() ?? fe.path;
        if (fileName.toLowerCase().includes(lowerQuery) || fe.path.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'file', id: fe.id, display: fileName,
            meta: { path: fe.path, fileType: fe.type },
          });
        }
      }

      return { success: true, data: results.slice(0, maxResults) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_SEND_MESSAGE, async (_e, data: Record<string, unknown>): Promise<IpcResult<null>> => {
    const traceId = randomUUID();
    const requestStartedAt = Date.now();

    try {
      const { sessionId, projectId, message, mentions } = data as {
        sessionId?: string;
        projectId: string;
        message: string;
        mentions?: unknown[];
      };

      console.log(
        `[narre:bridge] trace=${traceId} stage=request.start session=${sessionId ?? 'new'} ` +
        `project=${projectId} chars=${message.length} mentions=${mentions?.length ?? 0}`,
      );

      if (!sessionId || typeof sessionId !== 'string') {
        console.error(`[narre:bridge] trace=${traceId} stage=request.error reason=missing-session-id`);
        return { success: false, error: 'sessionId is required for Narre streaming' };
      }

      const mainWindow = BrowserWindow.getAllWindows()[0] ?? null;
      if (!mainWindow) {
        console.error(`[narre:bridge] trace=${traceId} stage=request.error reason=no-main-window`);
        return { success: false, error: 'No main window available' };
      }

      const body = JSON.stringify({ sessionId, projectId, message, mentions });
      const chatUrl = new URL('/chat', await ensureNarreServerBaseUrl());

      const req = http.request(
        chatUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            [NARRE_TRACE_HEADER]: traceId,
          },
        },
        (res) => {
          let eventCount = 0;
          let streamEnded = false;
          let buffer = '';
          console.log(
            `[narre:bridge] trace=${traceId} stage=response.headers status=${res.statusCode ?? 'unknown'} ` +
            `session=${sessionId}`,
          );

          const forwardEvent = (parsed: NarreStreamEvent, source: 'chunk' | 'buffer'): void => {
            eventCount += 1;
            console.log(
              `[narre:bridge] trace=${traceId} stage=sse.recv source=${source} seq=${eventCount} ` +
              `${summarizeNarreStreamEvent(parsed)}`,
            );
            emitNarreStreamEvent(mainWindow, parsed, { projectId, sessionId });
          };
          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const eventStr of events) {
              const trimmed = eventStr.trim();
              if (trimmed.startsWith('data: ')) {
                try {
                  const parsed: NarreStreamEvent = JSON.parse(trimmed.slice(6));
                  forwardEvent(parsed, 'chunk');
                } catch (error) {
                  console.error(
                    `[narre:bridge] trace=${traceId} stage=sse.parse_error source=chunk ` +
                    `message=${(error as Error).message}`,
                  );
                }
              }
            }
          });
          res.on('end', () => {
            streamEnded = true;
            cleanupActiveNarreChatRequest(sessionId, req);
            // Process any remaining buffer
            if (buffer.trim().startsWith('data: ')) {
              try {
                const parsed: NarreStreamEvent = JSON.parse(buffer.trim().slice(6));
                forwardEvent(parsed, 'buffer');
              } catch (error) {
                console.error(
                  `[narre:bridge] trace=${traceId} stage=sse.parse_error source=buffer ` +
                  `message=${(error as Error).message}`,
                );
              }
            }
            // Don't send a duplicate done event — narre-server already sends one via the stream
            console.log(
              `[narre:bridge] trace=${traceId} stage=stream.end events=${eventCount} ` +
              `elapsedMs=${Date.now() - requestStartedAt}`,
            );
          });
          res.on('close', () => {
            if (streamEnded) {
              return;
            }

            console.warn(
              `[narre:bridge] trace=${traceId} stage=stream.close events=${eventCount} ` +
              `elapsedMs=${Date.now() - requestStartedAt}`,
            );
          });
          res.on('error', (err) => {
            if (cancelledNarreChatRequests.has(req)) {
              cleanupActiveNarreChatRequest(sessionId, req);
              return;
            }

            const activeRequest = activeNarreChatRequests.get(sessionId);
            if (activeRequest?.request === req && activeRequest.cancelled) {
              cleanupActiveNarreChatRequest(sessionId, req);
              return;
            }

            cleanupActiveNarreChatRequest(sessionId, req);
            console.error(
              `[narre:bridge] trace=${traceId} stage=stream.error message=${err.message} ` +
              `elapsedMs=${Date.now() - requestStartedAt}`,
            );
            emitNarreStreamEvent(mainWindow, {
              type: 'error',
              error: err.message,
            }, { projectId, sessionId });
            emitNarreStreamEvent(mainWindow, {
              type: 'done',
            }, { projectId, sessionId });
          });
        },
      );

      req.on('error', (err) => {
        if (cancelledNarreChatRequests.has(req)) {
          cleanupActiveNarreChatRequest(sessionId, req);
          return;
        }

        const activeRequest = activeNarreChatRequests.get(sessionId);
        if (activeRequest?.request === req && activeRequest.cancelled) {
          cleanupActiveNarreChatRequest(sessionId, req);
          return;
        }

        cleanupActiveNarreChatRequest(sessionId, req);
        console.error(
          `[narre:bridge] trace=${traceId} stage=request.error message=${err.message} ` +
          `elapsedMs=${Date.now() - requestStartedAt}`,
        );
        emitNarreStreamEvent(mainWindow, {
          type: 'error',
          error: `Narre server connection failed: ${err.message}. Check the selected provider auth settings.`,
        }, { projectId, sessionId });
        // Send done so the UI exits streaming state
        emitNarreStreamEvent(mainWindow, {
          type: 'done',
        }, { projectId, sessionId });
      });

      const previousRequest = activeNarreChatRequests.get(sessionId);
      if (previousRequest && previousRequest.request !== req) {
        previousRequest.cancelled = true;
        cancelledNarreChatRequests.add(previousRequest.request);
        previousRequest.request.destroy();
      }

      activeNarreChatRequests.set(sessionId, {
        request: req,
        projectId,
        sessionId,
        mainWindow,
        cancelled: false,
      });

      req.write(body);
      req.end();
      console.log(
        `[narre:bridge] trace=${traceId} stage=request.sent bytes=${Buffer.byteLength(body)} ` +
        `session=${sessionId}`,
      );

      // Return immediately; streaming happens via events
      return { success: true, data: null };
    } catch (err) {
      console.error(
        `[narre:bridge] trace=${traceId} stage=request.setup.error message=${(err as Error).message} ` +
        `elapsedMs=${Date.now() - requestStartedAt}`,
      );
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_INTERRUPT_MESSAGE, async (_e, data: Record<string, unknown>): Promise<IpcResult<boolean>> => {
    try {
      const { sessionId } = data as { sessionId?: string };
      if (!sessionId || typeof sessionId !== 'string') {
        return { success: false, error: 'sessionId is required' };
      }

      const activeRequest = activeNarreChatRequests.get(sessionId);
      if (!activeRequest) {
        return { success: true, data: false };
      }

      activeRequest.cancelled = true;
      cancelledNarreChatRequests.add(activeRequest.request);
      cleanupActiveNarreChatRequest(sessionId, activeRequest.request);
      activeRequest.request.destroy();
      emitNarreStreamEvent(activeRequest.mainWindow, { type: 'done' }, {
        projectId: activeRequest.projectId,
        sessionId: activeRequest.sessionId,
      });

      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_RESPOND_CARD, async (_e, data: Record<string, unknown>): Promise<IpcResult<null>> => {
    try {
      const { sessionId, toolCallId, response } = data as {
        sessionId?: string;
        toolCallId: string;
        response: unknown;
      };

      const body = JSON.stringify({ sessionId, toolCallId, response });
      const respondUrl = new URL('/chat/respond', await ensureNarreServerBaseUrl());

      return new Promise((resolve) => {
        const req = http.request(
          respondUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            let responseBody = '';
            res.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
            res.on('end', () => {
              resolve({ success: true, data: null });
            });
          },
        );
        req.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
        req.write(body);
        req.end();
      });
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
