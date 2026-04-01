import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type {
  RelationType,
  RelationTypeCreate,
  RelationTypeUpdate,
} from '@netior/shared/types';

/** Raw row from SQLite where directed is INTEGER (0/1) */
type RelationTypeRow = Omit<RelationType, 'directed'> & { directed: number };

function toRelationType(row: RelationTypeRow): RelationType {
  return { ...row, directed: !!row.directed };
}

// ============================================
// RelationType CRUD
// ============================================

export function createRelationType(data: RelationTypeCreate): RelationType {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO relation_types (id, project_id, name, description, color, line_style, directed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.project_id,
    data.name,
    data.description ?? null,
    data.color ?? null,
    data.line_style ?? 'solid',
    data.directed ? 1 : 0,
    now,
    now,
  );

  const row = db.prepare('SELECT * FROM relation_types WHERE id = ?').get(id) as RelationTypeRow;
  return toRelationType(row);
}

export function listRelationTypes(projectId: string): RelationType[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM relation_types WHERE project_id = ? ORDER BY created_at')
    .all(projectId) as RelationTypeRow[];
  return rows.map(toRelationType);
}

export function getRelationType(id: string): RelationType | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM relation_types WHERE id = ?').get(id) as RelationTypeRow | undefined;
  return row ? toRelationType(row) : undefined;
}

export function updateRelationType(id: string, data: RelationTypeUpdate): RelationType | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM relation_types WHERE id = ?').get(id) as RelationTypeRow | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE relation_types SET name = ?, description = ?, color = ?, line_style = ?, directed = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.color !== undefined ? data.color : existing.color,
    data.line_style !== undefined ? data.line_style : existing.line_style,
    data.directed !== undefined ? (data.directed ? 1 : 0) : existing.directed,
    now,
    id,
  );

  const row = db.prepare('SELECT * FROM relation_types WHERE id = ?').get(id) as RelationTypeRow;
  return toRelationType(row);
}

export function deleteRelationType(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM relation_types WHERE id = ?').run(id);
  return result.changes > 0;
}
