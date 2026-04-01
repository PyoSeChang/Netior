import type { ConceptProperty, ConceptPropertyUpsert } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function upsertProperty(data: ConceptPropertyUpsert): Promise<ConceptProperty> {
  return unwrapIpc(await window.electron.conceptProp.upsert(data as unknown as Record<string, unknown>));
}

export async function getByConceptId(conceptId: string): Promise<ConceptProperty[]> {
  return unwrapIpc(await window.electron.conceptProp.getByConcept(conceptId));
}

export async function deleteProperty(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.conceptProp.delete(id));
}

export const conceptPropertyService = {
  upsert: upsertProperty,
  getByConcept: getByConceptId,
  delete: deleteProperty,
};
