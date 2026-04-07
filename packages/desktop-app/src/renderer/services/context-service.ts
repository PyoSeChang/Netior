import type { Context, ContextCreate, ContextUpdate, ContextMember } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createContext(data: ContextCreate): Promise<Context> {
  return unwrapIpc(await window.electron.context.create(data as unknown as Record<string, unknown>));
}

export async function listContexts(networkId: string): Promise<Context[]> {
  return unwrapIpc(await window.electron.context.list(networkId));
}

export async function getContext(id: string): Promise<Context | undefined> {
  return unwrapIpc(await window.electron.context.get(id));
}

export async function updateContext(id: string, data: ContextUpdate): Promise<Context> {
  return unwrapIpc(await window.electron.context.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteContext(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.context.delete(id));
}

export async function addContextMember(contextId: string, memberType: 'object' | 'edge', memberId: string): Promise<ContextMember> {
  return unwrapIpc(await window.electron.context.addMember(contextId, memberType, memberId));
}

export async function removeContextMember(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.context.removeMember(id));
}

export async function getContextMembers(contextId: string): Promise<ContextMember[]> {
  return unwrapIpc(await window.electron.context.getMembers(contextId));
}

export const contextService = {
  create: createContext,
  list: listContexts,
  get: getContext,
  update: updateContext,
  delete: deleteContext,
  addMember: addContextMember,
  removeMember: removeContextMember,
  getMembers: getContextMembers,
};
