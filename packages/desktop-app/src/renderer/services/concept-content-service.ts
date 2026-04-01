import type { Concept } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function syncToAgent(conceptId: string): Promise<Concept> {
  return unwrapIpc(await window.electron.conceptContent.syncToAgent(conceptId));
}

export async function syncFromAgent(conceptId: string, agentContent: string): Promise<Concept> {
  return unwrapIpc(await window.electron.conceptContent.syncFromAgent(conceptId, agentContent));
}

export const conceptContentService = { syncToAgent, syncFromAgent };
