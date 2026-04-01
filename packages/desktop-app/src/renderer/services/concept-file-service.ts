import type { ConceptFile, ConceptFileCreate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createConceptFile(data: ConceptFileCreate): Promise<ConceptFile> {
  return unwrapIpc(await window.electron.conceptFile.create(data as unknown as Record<string, unknown>));
}

export async function getConceptFilesByConcept(conceptId: string): Promise<ConceptFile[]> {
  return unwrapIpc(await window.electron.conceptFile.getByConcept(conceptId));
}

export async function deleteConceptFile(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.conceptFile.delete(id));
}

export const conceptFileService = {
  create: createConceptFile,
  getByConcept: getConceptFilesByConcept,
  delete: deleteConceptFile,
};
