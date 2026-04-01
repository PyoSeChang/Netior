import type { Concept, ConceptCreate, ConceptUpdate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createConcept(data: ConceptCreate): Promise<Concept> {
  return unwrapIpc(await window.electron.concept.create(data as unknown as Record<string, unknown>));
}

export async function getConceptsByProject(projectId: string): Promise<Concept[]> {
  return unwrapIpc(await window.electron.concept.getByProject(projectId));
}

export async function updateConcept(id: string, data: ConceptUpdate): Promise<Concept> {
  return unwrapIpc(await window.electron.concept.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteConcept(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.concept.delete(id));
}

export const conceptService = {
  create: createConcept,
  getByProject: getConceptsByProject,
  update: updateConcept,
  delete: deleteConcept,
};
