import type {
  AgentDefinition,
  NarreMention,
  NarreSession,
  NarreSessionDetail,
  NarreStreamEvent,
  SkillDefinition,
  SupervisorAgentSessionSnapshot,
  SupervisorEvent,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function listSessions(projectId: string): Promise<NarreSession[]> {
  return unwrapIpc(await window.electron.narre.listSessions(projectId));
}

export async function listSkills(projectId: string): Promise<SkillDefinition[]> {
  return unwrapIpc(await window.electron.narre.listSkills(projectId));
}

export async function listSupervisorAgents(projectId?: string | null): Promise<AgentDefinition[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorAgents(projectId));
}

export async function listSupervisorSkills(projectId: string): Promise<SkillDefinition[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorSkills(projectId));
}

export async function listSupervisorSessions(): Promise<SupervisorAgentSessionSnapshot[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorSessions());
}

export async function listSupervisorEvents(afterSeq?: number | null): Promise<SupervisorEvent[]> {
  return unwrapIpc(await window.electron.narre.listSupervisorEvents(afterSeq));
}

export async function createSession(projectId: string): Promise<NarreSession> {
  return unwrapIpc(await window.electron.narre.createSession(projectId));
}

export async function getSession(sessionId: string): Promise<NarreSessionDetail> {
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
  unwrapIpc(await window.electron.narre.sendMessage(data as Record<string, unknown>));
}

export function onStreamEvent(callback: (event: NarreStreamEvent) => void): () => void {
  return window.electron.narre.onStreamEvent((event) => callback(event as NarreStreamEvent));
}

export async function respondToCard(
  sessionId: string,
  toolCallId: string,
  response: unknown,
): Promise<void> {
  unwrapIpc(await window.electron.narre.respondToCard({ sessionId, toolCallId, response }));
}

export async function interruptMessage(sessionId: string): Promise<boolean> {
  return unwrapIpc(await window.electron.narre.interruptMessage({ sessionId }));
}

export const narreService = {
  listSessions,
  listSkills,
  listSupervisorAgents,
  listSupervisorSkills,
  listSupervisorSessions,
  listSupervisorEvents,
  createSession,
  getSession,
  deleteSession,
  getApiKeyStatus,
  setApiKey,
  searchMentions,
  sendMessage,
  onStreamEvent,
  respondToCard,
  interruptMessage,
};
