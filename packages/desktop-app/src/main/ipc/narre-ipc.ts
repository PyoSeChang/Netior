import { ipcMain, BrowserWindow } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import http from 'http';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type {
  ArchetypeField,
  IpcResult,
  NarreSession,
  NarreStreamEvent,
  NetworkTreeNode,
  TypeGroup,
} from '@netior/shared/types';
import { IPC_CHANNELS } from '@netior/shared/constants';
import {
  getRemoteAppRootNetwork,
  getRemoteNetworkTree,
  getRemoteProject,
  getRemoteProjectRootNetwork,
  listRemoteArchetypeFields,
  listRemoteArchetypes,
  listRemoteFilesByProject,
  listRemoteNetworks,
  listRemoteRelationTypes,
  listRemoteTypeGroups,
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

async function listRemoteNarreSessions(projectId: string): Promise<NarreSession[]> {
  return requestNarreServer<NarreSession[]>(`/sessions?projectId=${encodeURIComponent(projectId)}`);
}

async function createRemoteNarreSession(projectId: string): Promise<NarreSession> {
  return requestNarreServer<NarreSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

async function getRemoteNarreSession(sessionId: string): Promise<unknown> {
  const payload = await requestNarreServer<{
    projectId?: string;
    session: NarreSession;
    messages: unknown[];
  }>(`/sessions/${encodeURIComponent(sessionId)}`);

  return {
    ...payload.session,
    messages: payload.messages,
    ...(payload.projectId ? { projectId: payload.projectId } : {}),
  };
}

async function deleteRemoteNarreSession(sessionId: string): Promise<boolean> {
  const payload = await requestNarreServer<{ success: boolean }>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  return payload.success;
}

function buildTypeGroupPathMap(groups: TypeGroup[]): Map<string, string> {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const cache = new Map<string, string>();

  const resolvePath = (group: TypeGroup): string => {
    const cached = cache.get(group.id);
    if (cached) {
      return cached;
    }

    const parent = group.parent_group_id ? byId.get(group.parent_group_id) : null;
    const path = parent ? `${resolvePath(parent)}/${group.name}` : group.name;
    cache.set(group.id, path);
    return path;
  };

  for (const group of groups) {
    resolvePath(group);
  }

  return cache;
}

function mapTypeGroups(groups: TypeGroup[]): Array<{ kind: 'archetype' | 'relation_type'; path: string }> {
  const pathMap = buildTypeGroupPathMap(groups);
  return groups.map((group) => ({
    kind: group.kind,
    path: pathMap.get(group.id) ?? group.name,
  }));
}

interface NarrePromptNetworkTreeNode {
  id: string;
  name: string;
  children: NarrePromptNetworkTreeNode[];
}

function mapNetworkTree(nodes: NetworkTreeNode[]): NarrePromptNetworkTreeNode[] {
  return nodes.map((node) => ({
    id: node.network.id,
    name: node.network.name,
    children: mapNetworkTree(node.children),
  }));
}

function buildOptionsPreview(options: string | null): string[] | undefined {
  if (!options) {
    return undefined;
  }

  const values = options
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return undefined;
  }

  return values.slice(0, 5);
}

function mapArchetypeFields(
  fields: ArchetypeField[],
  archetypeNames: Map<string, string>,
): Array<{
  name: string;
  field_type: string;
  required: boolean;
  ref_archetype_name?: string;
  options_preview?: string[];
}> {
  return fields.map((field) => {
    const optionsPreview = buildOptionsPreview(field.options);

    return {
      name: field.name,
      field_type: field.field_type,
      required: field.required,
      ...(field.ref_archetype_id
        ? { ref_archetype_name: archetypeNames.get(field.ref_archetype_id) ?? field.ref_archetype_id }
        : {}),
      ...(optionsPreview ? { options_preview: optionsPreview } : {}),
    };
  });
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
      writeFileSync(sessionPath, JSON.stringify({ messages: [] }, null, 2), 'utf-8');

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
          const data = JSON.parse(readFileSync(sessionPath, 'utf-8'));
          const index = getSessionsIndex(projectId);
          const sessionMeta = index.sessions.find((s) => s.id === sessionId);
          return { success: true, data: { ...sessionMeta, ...data } };
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
    try {
      const { sessionId, projectId, message, mentions } = data as {
        sessionId?: string;
        projectId: string;
        message: string;
        mentions?: unknown[];
      };

      const mainWindow = BrowserWindow.getAllWindows()[0] ?? null;
      if (!mainWindow) {
        return { success: false, error: 'No main window available' };
      }

      // Build project metadata for system prompt (narre-server doesn't access DB)
      const project = await getRemoteProject(projectId);
      const [
        archetypes,
        relationTypes,
        archetypeGroups,
        relationTypeGroups,
        appRootNetwork,
        projectRootNetwork,
        networkTree,
      ] = project
        ? await Promise.all([
          listRemoteArchetypes(projectId),
          listRemoteRelationTypes(projectId),
          listRemoteTypeGroups(projectId, 'archetype'),
          listRemoteTypeGroups(projectId, 'relation_type'),
          getRemoteAppRootNetwork(),
          getRemoteProjectRootNetwork(projectId),
          getRemoteNetworkTree(projectId),
        ])
        : [[], [], [], [], null, null, []];

      const archetypeNameMap = new Map<string, string>(archetypes.map((archetype) => [archetype.id, archetype.name]));
      const archetypeFieldsById = new Map<string, ArchetypeField[]>(
        await Promise.all(
          archetypes.map(async (archetype) => [archetype.id, await listRemoteArchetypeFields(archetype.id)] as const),
        ),
      );
      const typeGroups = mapTypeGroups([...archetypeGroups, ...relationTypeGroups]);

      const projectMetadata = {
        projectName: project?.name ?? projectId,
        projectRootDir: project?.root_dir ?? null,
        archetypes: archetypes.map((archetype) => ({
          name: archetype.name,
          icon: archetype.icon,
          color: archetype.color,
          node_shape: archetype.node_shape,
          description: archetype.description,
          fields: mapArchetypeFields(archetypeFieldsById.get(archetype.id) ?? [], archetypeNameMap),
        })),
        relationTypes: relationTypes.map((relationType) => ({
          name: relationType.name,
          directed: relationType.directed,
          line_style: relationType.line_style,
          color: relationType.color,
          description: relationType.description,
        })),
        typeGroups,
        appRootNetwork: appRootNetwork
          ? { id: appRootNetwork.id, name: appRootNetwork.name }
          : null,
        projectRootNetwork: projectRootNetwork
          ? { id: projectRootNetwork.id, name: projectRootNetwork.name }
          : null,
        networkTree: mapNetworkTree(networkTree),
      };

      const body = JSON.stringify({ sessionId, projectId, message, mentions, projectMetadata });
      const chatUrl = new URL('/chat', await ensureNarreServerBaseUrl());

      const req = http.request(
        chatUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let buffer = '';
          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const eventStr of events) {
              const trimmed = eventStr.trim();
              if (trimmed.startsWith('data: ')) {
                try {
                  const parsed: NarreStreamEvent = JSON.parse(trimmed.slice(6));
                  mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, parsed);
                } catch {
                  // Skip malformed events
                }
              }
            }
          });
          res.on('end', () => {
            // Process any remaining buffer
            if (buffer.trim().startsWith('data: ')) {
              try {
                const parsed: NarreStreamEvent = JSON.parse(buffer.trim().slice(6));
                mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, parsed);
              } catch {
                // Skip
              }
            }
            // Don't send a duplicate done event — narre-server already sends one via the stream
          });
          res.on('error', (err) => {
            mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, {
              type: 'error',
              error: err.message,
            } as NarreStreamEvent);
            mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, {
              type: 'done',
            } as NarreStreamEvent);
          });
        },
      );

      req.on('error', (err) => {
        console.error('[narre] Narre server connection error:', err.message);
        mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, {
          type: 'error',
          error: `Narre server connection failed: ${err.message}. Check the selected provider auth settings.`,
        } as NarreStreamEvent);
        // Send done so the UI exits streaming state
        mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, {
          type: 'done',
        } as NarreStreamEvent);
      });

      req.write(body);
      req.end();

      // Return immediately; streaming happens via events
      return { success: true, data: null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_RESPOND_CARD, async (_e, data: Record<string, unknown>): Promise<IpcResult<null>> => {
    try {
      const { toolCallId, response } = data as {
        toolCallId: string;
        response: unknown;
      };

      const body = JSON.stringify({ toolCallId, response });
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

  ipcMain.handle(IPC_CHANNELS.NARRE_EXECUTE_COMMAND, async (_e, data: Record<string, unknown>): Promise<IpcResult<null>> => {
    try {
      const { projectId, command, args } = data as {
        projectId: string;
        command: string;
        args?: Record<string, string>;
      };

      const mainWindow = BrowserWindow.getAllWindows()[0] ?? null;
      if (!mainWindow) {
        return { success: false, error: 'No main window available' };
      }

      const body = JSON.stringify({ projectId, command, args });
      const commandUrl = new URL('/command', await ensureNarreServerBaseUrl());

      const req = http.request(
        commandUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let buffer = '';
          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const eventStr of events) {
              const trimmed = eventStr.trim();
              if (trimmed.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(trimmed.slice(6));
                  mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, parsed);
                } catch { /* skip */ }
              }
            }
          });
          res.on('end', () => {
            if (buffer.trim().startsWith('data: ')) {
              try {
                const parsed = JSON.parse(buffer.trim().slice(6));
                mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, parsed);
              } catch { /* skip */ }
            }
          });
        },
      );
      req.on('error', (err) => {
        mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, {
          type: 'error', error: err.message,
        });
        mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, { type: 'done' });
      });
      req.write(body);
      req.end();

      return { success: true, data: null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
