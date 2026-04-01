import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type {
  Archetype,
  ArchetypeCreate,
  ArchetypeUpdate,
  ArchetypeField,
  ArchetypeFieldCreate,
  ArchetypeFieldUpdate,
} from '@netior/shared/types';

/** Raw row from SQLite where required is INTEGER (0/1) */
type ArchetypeFieldRow = Omit<ArchetypeField, 'required'> & { required: number };

function toField(row: ArchetypeFieldRow): ArchetypeField {
  return { ...row, required: !!row.required };
}

// ============================================
// Archetype CRUD
// ============================================

export function createArchetype(data: ArchetypeCreate): Archetype {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO archetypes (id, project_id, name, description, icon, color, node_shape, file_template, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.project_id,
    data.name,
    data.description ?? null,
    data.icon ?? null,
    data.color ?? null,
    data.node_shape ?? null,
    data.file_template ?? null,
    now,
    now,
  );

  return db.prepare('SELECT * FROM archetypes WHERE id = ?').get(id) as Archetype;
}

export function listArchetypes(projectId: string): Archetype[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM archetypes WHERE project_id = ? ORDER BY created_at')
    .all(projectId) as Archetype[];
}

export function getArchetype(id: string): Archetype | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM archetypes WHERE id = ?').get(id) as Archetype | undefined;
}

export function updateArchetype(id: string, data: ArchetypeUpdate): Archetype | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM archetypes WHERE id = ?').get(id) as Archetype | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE archetypes SET name = ?, description = ?, icon = ?, color = ?, node_shape = ?, file_template = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.icon !== undefined ? data.icon : existing.icon,
    data.color !== undefined ? data.color : existing.color,
    data.node_shape !== undefined ? data.node_shape : existing.node_shape,
    data.file_template !== undefined ? data.file_template : existing.file_template,
    now,
    id,
  );

  return db.prepare('SELECT * FROM archetypes WHERE id = ?').get(id) as Archetype;
}

export function deleteArchetype(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM archetypes WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============================================
// Archetype Field CRUD
// ============================================

export function createField(data: ArchetypeFieldCreate): ArchetypeField {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO archetype_fields (id, archetype_id, name, field_type, options, sort_order, required, default_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.archetype_id,
    data.name,
    data.field_type,
    data.options ?? null,
    data.sort_order,
    data.required ? 1 : 0,
    data.default_value ?? null,
    now,
  );

  const row = db.prepare('SELECT * FROM archetype_fields WHERE id = ?').get(id) as ArchetypeFieldRow;
  return toField(row);
}

export function listFields(archetypeId: string): ArchetypeField[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM archetype_fields WHERE archetype_id = ? ORDER BY sort_order')
    .all(archetypeId) as ArchetypeFieldRow[];
  return rows.map(toField);
}

export function updateField(id: string, data: ArchetypeFieldUpdate): ArchetypeField | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM archetype_fields WHERE id = ?').get(id) as ArchetypeFieldRow | undefined;
  if (!existing) return undefined;

  db.prepare(
    `UPDATE archetype_fields SET name = ?, field_type = ?, options = ?, sort_order = ?, required = ?, default_value = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.field_type !== undefined ? data.field_type : existing.field_type,
    data.options !== undefined ? data.options : existing.options,
    data.sort_order !== undefined ? data.sort_order : existing.sort_order,
    data.required !== undefined ? (data.required ? 1 : 0) : existing.required,
    data.default_value !== undefined ? data.default_value : existing.default_value,
    id,
  );

  const row = db.prepare('SELECT * FROM archetype_fields WHERE id = ?').get(id) as ArchetypeFieldRow;
  return toField(row);
}

export function deleteField(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM archetype_fields WHERE id = ?').run(id);
  return result.changes > 0;
}

export function reorderFields(archetypeId: string, orderedIds: string[]): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE archetype_fields SET sort_order = ? WHERE id = ? AND archetype_id = ?');
  db.transaction(() => {
    orderedIds.forEach((id, index) => {
      stmt.run(index, id, archetypeId);
    });
  })();
}
