import type { ObjectRecord, NetworkObjectType } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function getObject(id: string): Promise<ObjectRecord | undefined> {
  return unwrapIpc(await window.electron.object.get(id));
}

export async function getObjectByRef(objectType: NetworkObjectType, refId: string): Promise<ObjectRecord | undefined> {
  return unwrapIpc(await window.electron.object.getByRef(objectType, refId));
}

export const objectService = {
  get: getObject,
  getByRef: getObjectByRef,
};
