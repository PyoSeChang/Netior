import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { ConceptFile, ConceptFileCreate } from '@netior/shared/types';

export function createConceptFile(data: ConceptFileCreate): ConceptFile {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO concept_files (id, concept_id, file_path, created_at) VALUES (?, ?, ?, ?)`,
  ).run(id, data.concept_id, data.file_path, now);

  return db.prepare('SELECT * FROM concept_files WHERE id = ?').get(id) as ConceptFile;
}

export function getConceptFilesByConcept(conceptId: string): ConceptFile[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM concept_files WHERE concept_id = ? ORDER BY created_at')
    .all(conceptId) as ConceptFile[];
}

export function deleteConceptFile(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM concept_files WHERE id = ?').run(id);
  return result.changes > 0;
}
