import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createObject, deleteObjectByRef } from './objects';
import type {
  Archetype,
  ArchetypeCreate,
  ArchetypeUpdate,
  ArchetypeField,
  ArchetypeFieldCreate,
  ArchetypeFieldUpdate,
} from '@netior/shared/types';

type ArchetypeRow = Omit<Archetype, 'semantic_traits'> & { semantic_traits: string | null };
type ArchetypeFieldRow = Omit<ArchetypeField, 'required' | 'slot_binding_locked' | 'generated_by_trait'> & {
  required: number;
  slot_binding_locked: number;
  generated_by_trait: number;
};

function parseSemanticTraits(raw: string | null | undefined): Archetype['semantic_traits'] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is Archetype['semantic_traits'][number] => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function serializeSemanticTraits(traits: Archetype['semantic_traits'] | undefined): string {
  return JSON.stringify(traits ?? []);
}

function toArchetype(row: ArchetypeRow): Archetype {
  return {
    ...row,
    semantic_traits: parseSemanticTraits(row.semantic_traits),
  };
}

function toField(row: ArchetypeFieldRow): ArchetypeField {
  return {
    ...row,
    required: !!row.required,
    slot_binding_locked: !!row.slot_binding_locked,
    generated_by_trait: !!row.generated_by_trait,
  };
}

/**
 * BFS cycle detection for archetype_ref chains.
 * Checks if adding a ref from `fromArchetypeId` → `toArchetypeId` would create a cycle.
 */
function detectArchetypeRefCycle(fromArchetypeId: string, toArchetypeId: string): boolean {
  if (fromArchetypeId === toArchetypeId) return true;

  const db = getDatabase();
  const visited = new Set<string>();
  const queue = [toArchetypeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all archetypes that `current` references via archetype_ref fields
    const refs = db.prepare(
      `SELECT DISTINCT ref_archetype_id FROM archetype_fields
       WHERE archetype_id = ? AND field_type = 'archetype_ref' AND ref_archetype_id IS NOT NULL`,
    ).all(current) as { ref_archetype_id: string }[];

    for (const ref of refs) {
      if (ref.ref_archetype_id === fromArchetypeId) return true;
      queue.push(ref.ref_archetype_id);
    }
  }

  return false;
}

// ============================================
// Archetype CRUD
// ============================================

export function createArchetype(data: ArchetypeCreate): Archetype {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO archetypes (id, project_id, group_id, name, description, icon, color, node_shape, file_template, semantic_traits, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.project_id,
    data.group_id ?? null,
    data.name,
    data.description ?? null,
    data.icon ?? null,
    data.color ?? null,
    data.node_shape ?? null,
    data.file_template ?? null,
    serializeSemanticTraits(data.semantic_traits),
    now,
    now,
  );

  createObject('archetype', 'project', data.project_id, id);

  const row = db.prepare('SELECT * FROM archetypes WHERE id = ?').get(id) as ArchetypeRow;
  return toArchetype(row);
}

export function listArchetypes(projectId: string): Archetype[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM archetypes WHERE project_id = ? ORDER BY created_at')
    .all(projectId) as ArchetypeRow[];
  return rows.map(toArchetype);
}

export function getArchetype(id: string): Archetype | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM archetypes WHERE id = ?').get(id) as ArchetypeRow | undefined;
  return row ? toArchetype(row) : undefined;
}

export function updateArchetype(id: string, data: ArchetypeUpdate): Archetype | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM archetypes WHERE id = ?').get(id) as ArchetypeRow | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE archetypes SET group_id = ?, name = ?, description = ?, icon = ?, color = ?, node_shape = ?, file_template = ?, semantic_traits = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.group_id !== undefined ? data.group_id : existing.group_id,
    data.name !== undefined ? data.name : existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.icon !== undefined ? data.icon : existing.icon,
    data.color !== undefined ? data.color : existing.color,
    data.node_shape !== undefined ? data.node_shape : existing.node_shape,
    data.file_template !== undefined ? data.file_template : existing.file_template,
    data.semantic_traits !== undefined ? serializeSemanticTraits(data.semantic_traits) : existing.semantic_traits,
    now,
    id,
  );

  const row = db.prepare('SELECT * FROM archetypes WHERE id = ?').get(id) as ArchetypeRow;
  return toArchetype(row);
}

export function deleteArchetype(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM archetypes WHERE id = ?').run(id);
  if (result.changes > 0) {
    deleteObjectByRef('archetype', id);
    return true;
  }
  return false;
}

// ============================================
// Archetype Field CRUD
// ============================================

export function createField(data: ArchetypeFieldCreate): ArchetypeField {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  // Cycle detection for archetype_ref fields
  if (data.field_type === 'archetype_ref' && data.ref_archetype_id) {
    if (detectArchetypeRefCycle(data.archetype_id, data.ref_archetype_id)) {
      throw new Error('Circular archetype reference detected');
    }
  }

  db.prepare(
    `INSERT INTO archetype_fields (id, archetype_id, name, field_type, options, sort_order, required, default_value, ref_archetype_id, system_slot, slot_binding_locked, generated_by_trait, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.archetype_id,
    data.name,
    data.field_type,
    data.options ?? null,
    data.sort_order,
    data.required ? 1 : 0,
    data.default_value ?? null,
    data.ref_archetype_id ?? null,
    data.system_slot ?? null,
    data.slot_binding_locked ? 1 : 0,
    data.generated_by_trait ? 1 : 0,
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

  const newFieldType = data.field_type !== undefined ? data.field_type : existing.field_type;
  const newRefId = data.ref_archetype_id !== undefined ? data.ref_archetype_id : (existing as unknown as { ref_archetype_id: string | null }).ref_archetype_id;

  // Cycle detection for archetype_ref fields
  if (newFieldType === 'archetype_ref' && newRefId) {
    if (detectArchetypeRefCycle(existing.archetype_id, newRefId)) {
      throw new Error('Circular archetype reference detected');
    }
  }

  db.prepare(
    `UPDATE archetype_fields SET name = ?, field_type = ?, options = ?, sort_order = ?, required = ?, default_value = ?, ref_archetype_id = ?, system_slot = ?, slot_binding_locked = ?, generated_by_trait = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    newFieldType,
    data.options !== undefined ? data.options : existing.options,
    data.sort_order !== undefined ? data.sort_order : existing.sort_order,
    data.required !== undefined ? (data.required ? 1 : 0) : existing.required,
    data.default_value !== undefined ? data.default_value : existing.default_value,
    newRefId ?? null,
    data.system_slot !== undefined ? data.system_slot : existing.system_slot,
    data.slot_binding_locked !== undefined ? (data.slot_binding_locked ? 1 : 0) : existing.slot_binding_locked,
    data.generated_by_trait !== undefined ? (data.generated_by_trait ? 1 : 0) : existing.generated_by_trait,
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
