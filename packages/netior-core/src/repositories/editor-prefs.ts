import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { ConceptEditorPrefs, ConceptEditorPrefsUpdate } from '@netior/shared/types';

export function getEditorPrefs(conceptId: string): ConceptEditorPrefs | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM concept_editor_prefs WHERE concept_id = ?')
    .get(conceptId) as ConceptEditorPrefs | undefined;
}

export function upsertEditorPrefs(conceptId: string, data: ConceptEditorPrefsUpdate): ConceptEditorPrefs {
  const db = getDatabase();
  const existing = db
    .prepare('SELECT * FROM concept_editor_prefs WHERE concept_id = ?')
    .get(conceptId) as ConceptEditorPrefs | undefined;

  const now = new Date().toISOString();

  if (existing) {
    db.prepare(
      `UPDATE concept_editor_prefs
       SET view_mode = ?, float_x = ?, float_y = ?, float_width = ?, float_height = ?, side_split_ratio = ?, updated_at = ?
       WHERE concept_id = ?`,
    ).run(
      data.view_mode !== undefined ? data.view_mode : existing.view_mode,
      data.float_x !== undefined ? data.float_x : existing.float_x,
      data.float_y !== undefined ? data.float_y : existing.float_y,
      data.float_width !== undefined ? data.float_width : existing.float_width,
      data.float_height !== undefined ? data.float_height : existing.float_height,
      data.side_split_ratio !== undefined ? data.side_split_ratio : existing.side_split_ratio,
      now,
      conceptId,
    );
  } else {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO concept_editor_prefs (id, concept_id, view_mode, float_x, float_y, float_width, float_height, side_split_ratio, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      conceptId,
      data.view_mode ?? 'float',
      data.float_x ?? null,
      data.float_y ?? null,
      data.float_width ?? 600,
      data.float_height ?? 450,
      data.side_split_ratio ?? 0.5,
      now,
    );
  }

  return db
    .prepare('SELECT * FROM concept_editor_prefs WHERE concept_id = ?')
    .get(conceptId) as ConceptEditorPrefs;
}
