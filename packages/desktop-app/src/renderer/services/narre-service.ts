import type { NarreSession, NarreMention } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function listSessions(projectId: string): Promise<NarreSession[]> {
  return unwrapIpc(await window.electron.narre.listSessions(projectId));
}

export async function createSession(projectId: string): Promise<NarreSession> {
  return unwrapIpc(await window.electron.narre.createSession(projectId));
}

export async function getSession(sessionId: string): Promise<NarreSession> {
  return unwrapIpc(await window.electron.narre.getSession(sessionId));
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  return unwrapIpc(await window.electron.narre.deleteSession(sessionId));
}

export async function getApiKeyStatus(): Promise<boolean> {
  return unwrapIpc(await window.electron.narre.getApiKeyStatus());
}

export async function setApiKey(key: string): Promise<boolean> {
  return unwrapIpc(await window.electron.narre.setApiKey(key));
}

export interface MentionResult {
  type: string;
  id: string;
  display: string;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  meta?: Record<string, unknown>;
}

export async function searchMentions(projectId: string, query: string): Promise<MentionResult[]> {
  return unwrapIpc(await window.electron.narre.searchMentions(projectId, query));
}

export async function sendMessage(data: {
  sessionId?: string;
  projectId: string;
  message: string;
  mentions?: NarreMention[];
}): Promise<void> {
  // Fire-and-forget: streaming events come via onStreamEvent
  await window.electron.narre.sendMessage(data as Record<string, unknown>);
}

export function onStreamEvent(callback: (event: unknown) => void): () => void {
  return window.electron.narre.onStreamEvent(callback);
}

export async function respondToCard(
  sessionId: string,
  toolCallId: string,
  response: unknown,
): Promise<void> {
  await window.electron.narre.respondToCard({ sessionId, toolCallId, response });
}

export async function executeCommand(
  projectId: string,
  command: string,
  args?: Record<string, string>,
): Promise<void> {
  await window.electron.narre.executeCommand({ projectId, command, args });
}

export const narreService = {
  listSessions,
  createSession,
  getSession,
  deleteSession,
  getApiKeyStatus,
  setApiKey,
  searchMentions,
  sendMessage,
  onStreamEvent,
  respondToCard,
  executeCommand,
};
