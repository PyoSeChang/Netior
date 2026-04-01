import { ipcMain, app, BrowserWindow } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import http from 'http';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { IpcResult, NarreSession, NarreStreamEvent } from '@moc/shared/types';
import { IPC_CHANNELS } from '@moc/shared/constants';
import {
  getSetting, setSetting,
  searchConcepts, listArchetypes, listRelationTypes, listCanvasTypes, listCanvases,
  getProjectById,
} from '@moc/core';
import { startAgentServer, isAgentServerRunning } from '../process/agent-server-manager';

function getNarreDir(projectId: string): string {
  const dir = join(app.getPath('userData'), 'data', 'narre', projectId);
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

export function registerNarreIpc(): void {
  ipcMain.handle(IPC_CHANNELS.NARRE_LIST_SESSIONS, async (_e, projectId: string): Promise<IpcResult<NarreSession[]>> => {
    try {
      const index = getSessionsIndex(projectId);
      // Sort by last_message_at descending
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
      // We need to search across all project dirs to find the session
      // For now, the sessionId is globally unique, so we scan
      const baseDir = join(app.getPath('userData'), 'data', 'narre');
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
      const baseDir = join(app.getPath('userData'), 'data', 'narre');
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
      const key = getSetting('anthropic_api_key');
      return { success: true, data: !!key && key.length > 0 };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.NARRE_SET_API_KEY, async (_e, key: string): Promise<IpcResult<boolean>> => {
    try {
      setSetting('anthropic_api_key', key);
      // Start agent-server if not already running
      if (key && !isAgentServerRunning()) {
        const dbDir = join(app.getPath('userData'), 'data');
        const dbPath = join(dbDir, 'moc.db'); // Will be overridden by env in dev
        startAgentServer({ apiKey: key, dbPath, dataDir: dbDir });
      }
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

      // Search concepts
      const archetypeMap = new Map(listArchetypes(projectId).map((a) => [a.id, a]));
      const concepts = searchConcepts(projectId, query);
      for (const c of concepts) {
        if (results.length >= maxResults) break;
        const arch = c.archetype_id ? archetypeMap.get(c.archetype_id) : null;
        results.push({
          type: 'concept', id: c.id, display: c.title, color: c.color, icon: c.icon,
          meta: { archetype: arch?.name ?? null },
        });
      }

      // Search archetypes
      const lowerQuery = query.toLowerCase();
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
      const relationTypes = listRelationTypes(projectId);
      for (const rt of relationTypes) {
        if (results.length >= maxResults) break;
        if (rt.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'relationType', id: rt.id, display: rt.name, color: rt.color,
            description: rt.description, meta: { directed: rt.directed, lineStyle: rt.line_style },
          });
        }
      }

      // Search canvas types
      const canvasTypes = listCanvasTypes(projectId);
      for (const ct of canvasTypes) {
        if (results.length >= maxResults) break;
        if (ct.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'canvasType', id: ct.id, display: ct.name, color: ct.color, icon: ct.icon,
            description: ct.description,
          });
        }
      }

      // Search canvases
      const canvases = listCanvases(projectId);
      for (const cv of canvases) {
        if (results.length >= maxResults) break;
        if (cv.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'canvas', id: cv.id, display: cv.name,
            meta: { conceptId: cv.concept_id, canvasTypeId: cv.canvas_type_id },
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

      // Build project metadata for system prompt (agent-server doesn't access DB)
      const project = getProjectById(projectId);
      const archetypes = project ? listArchetypes(projectId) : [];
      const relationTypes = project ? listRelationTypes(projectId) : [];
      const canvasTypes = project ? listCanvasTypes(projectId) : [];

      const projectMetadata = {
        projectName: project?.name ?? projectId,
        archetypes: archetypes.map((a) => ({ name: a.name, icon: a.icon, color: a.color, node_shape: a.node_shape })),
        relationTypes: relationTypes.map((r) => ({ name: r.name, directed: r.directed, line_style: r.line_style, color: r.color })),
        canvasTypes: canvasTypes.map((c) => ({ name: c.name, description: c.description })),
      };

      const body = JSON.stringify({ sessionId, projectId, message, mentions, projectMetadata });
      const agentPort = 3100;

      const req = http.request(
        {
          hostname: 'localhost',
          port: agentPort,
          path: '/chat',
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
            // Don't send a duplicate done event — agent-server already sends one via the stream
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
        console.error('[narre] Agent server connection error:', err.message);
        mainWindow.webContents.send(IPC_CHANNELS.NARRE_STREAM_EVENT, {
          type: 'error',
          error: `Agent server connection failed: ${err.message}. Is the API key set?`,
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
}
