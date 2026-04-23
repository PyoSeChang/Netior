import type {
  DeleteUserAgentInput,
  DeleteUserAgentSkillInput,
  UpsertUserAgentInput,
  UpsertUserAgentSkillInput,
  UserAgentRecord,
  UserAgentSkillSummary,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function listDefinitions(projectId?: string | null): Promise<UserAgentRecord[]> {
  return unwrapIpc(await window.electron.agent.listDefinitions(projectId));
}

export async function upsertDefinition(input: UpsertUserAgentInput): Promise<UserAgentRecord> {
  return unwrapIpc(await window.electron.agent.upsertDefinition(input as unknown as Record<string, unknown>));
}

export async function deleteDefinition(input: DeleteUserAgentInput): Promise<boolean> {
  return unwrapIpc(await window.electron.agent.deleteDefinition(input as unknown as Record<string, unknown>));
}

export async function upsertSkill(input: UpsertUserAgentSkillInput): Promise<UserAgentSkillSummary> {
  return unwrapIpc(await window.electron.agent.upsertSkill(input as unknown as Record<string, unknown>));
}

export async function deleteSkill(input: DeleteUserAgentSkillInput): Promise<boolean> {
  return unwrapIpc(await window.electron.agent.deleteSkill(input as unknown as Record<string, unknown>));
}

export const agentService = {
  listDefinitions,
  upsertDefinition,
  deleteDefinition,
  upsertSkill,
  deleteSkill,
};
