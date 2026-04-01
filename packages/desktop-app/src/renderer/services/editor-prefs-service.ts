import type { ConceptEditorPrefs, ConceptEditorPrefsUpdate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function getEditorPrefs(conceptId: string): Promise<ConceptEditorPrefs | undefined> {
  return unwrapIpc(await window.electron.editorPrefs.get(conceptId));
}

export async function upsertEditorPrefs(
  conceptId: string,
  data: ConceptEditorPrefsUpdate,
): Promise<ConceptEditorPrefs> {
  return unwrapIpc(await window.electron.editorPrefs.upsert(conceptId, data as Record<string, unknown>));
}

export const editorPrefsService = {
  get: getEditorPrefs,
  upsert: upsertEditorPrefs,
};
