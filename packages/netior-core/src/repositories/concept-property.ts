import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { ConceptProperty, ConceptPropertyUpsert } from '@netior/shared/types';

export function upsertProperty(data: ConceptPropertyUpsert): ConceptProperty {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO concept_properties (id, concept_id, field_id, value)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(concept_id, field_id) DO UPDATE SET value = excluded.value`,
  ).run(id, data.concept_id, data.field_id, data.value);

  return db.prepare(
    'SELECT * FROM concept_properties WHERE concept_id = ? AND field_id = ?',
  ).get(data.concept_id, data.field_id) as ConceptProperty;
}

export function getByConceptId(conceptId: string): ConceptProperty[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM concept_properties WHERE concept_id = ?')
    .all(conceptId) as ConceptProperty[];
}

export function deleteProperty(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM concept_properties WHERE id = ?').run(id);
  return result.changes > 0;
}
