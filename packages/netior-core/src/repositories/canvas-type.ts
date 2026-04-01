import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type {
  CanvasType,
  CanvasTypeCreate,
  CanvasTypeUpdate,
  CanvasTypeAllowedRelation,
  RelationType,
} from '@netior/shared/types';

// ============================================
// CanvasType CRUD
// ============================================

export function createCanvasType(data: CanvasTypeCreate): CanvasType {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO canvas_types (id, project_id, name, description, icon, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.project_id, data.name, data.description ?? null, data.icon ?? null, data.color ?? null, now, now);

  return db.prepare('SELECT * FROM canvas_types WHERE id = ?').get(id) as CanvasType;
}

export function listCanvasTypes(projectId: string): CanvasType[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM canvas_types WHERE project_id = ? ORDER BY created_at')
    .all(projectId) as CanvasType[];
}

export function getCanvasType(id: string): CanvasType | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM canvas_types WHERE id = ?').get(id) as CanvasType | undefined;
}

export function updateCanvasType(id: string, data: CanvasTypeUpdate): CanvasType | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM canvas_types WHERE id = ?').get(id) as CanvasType | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE canvas_types SET name = ?, description = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.icon !== undefined ? data.icon : existing.icon,
    data.color !== undefined ? data.color : existing.color,
    now,
    id,
  );

  return db.prepare('SELECT * FROM canvas_types WHERE id = ?').get(id) as CanvasType;
}

export function deleteCanvasType(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM canvas_types WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============================================
// Allowed Relations (Junction)
// ============================================

export function addAllowedRelation(canvasTypeId: string, relationTypeId: string): CanvasTypeAllowedRelation {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO canvas_type_allowed_relations (id, canvas_type_id, relation_type_id) VALUES (?, ?, ?)`,
  ).run(id, canvasTypeId, relationTypeId);

  return db.prepare('SELECT * FROM canvas_type_allowed_relations WHERE id = ?').get(id) as CanvasTypeAllowedRelation;
}

export function removeAllowedRelation(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM canvas_type_allowed_relations WHERE id = ?').run(id);
  return result.changes > 0;
}

export function removeAllowedRelationByPair(canvasTypeId: string, relationTypeId: string): boolean {
  const db = getDatabase();
  const result = db.prepare(
    'DELETE FROM canvas_type_allowed_relations WHERE canvas_type_id = ? AND relation_type_id = ?',
  ).run(canvasTypeId, relationTypeId);
  return result.changes > 0;
}

type RelationTypeRow = Omit<RelationType, 'directed'> & { directed: number };

export function listAllowedRelations(canvasTypeId: string): RelationType[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT rt.* FROM relation_types rt
       INNER JOIN canvas_type_allowed_relations ctar ON ctar.relation_type_id = rt.id
       WHERE ctar.canvas_type_id = ?
       ORDER BY rt.created_at`,
    )
    .all(canvasTypeId) as RelationTypeRow[];
  return rows.map((row) => ({ ...row, directed: !!row.directed }));
}
