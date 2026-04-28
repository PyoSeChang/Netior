import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createObject, deleteObjectByRef } from './objects';
import { syncProjectOntologyForDb } from './system-networks';
import {
  getSemanticMeaningDefinition,
  getSemanticMeaningForSlot,
  getMeaningSlotDefinition,
  meaningBindingToMeaningSlot,
  fieldMeaningToMeaningBindings,
  fieldMeaningToMeaningSlot,
  meaningSlotToFieldMeaning,
} from '@netior/shared/constants';
import type {
  Schema,
  SchemaCreate,
  SchemaUpdate,
  SchemaField,
  SchemaFieldCreate,
  SchemaFieldUpdate,
  SchemaMeaning,
  SchemaMeaningCreate,
  SchemaMeaningSlotBinding,
  SchemaMeaningSlotBindingUpdate,
  SchemaMeaningUpdate,
  FieldMeaningBindingKey,
  FieldMeaningBindingSource,
  MeaningSourceKind,
  SemanticModelRefKey,
  SemanticMeaningKey,
  SlotBindingTargetKind,
  FieldMeaningKey,
  MeaningSlotKey,
} from '@netior/shared/types';

type SchemaRow = Omit<Schema, 'semantic_models' | 'models'> & {
  semantic_models: string | null;
  models?: string | null;
};
type SchemaFieldRow = Omit<SchemaField, 'required' | 'slot_binding_locked' | 'generated_by_model' | 'meaning_bindings'> & {
  meaning_slot: MeaningSlotKey | null;
  meaning_key: FieldMeaningKey | null;
  required: number;
  slot_binding_locked: number;
  generated_by_model: number;
};
type SchemaMeaningRow = Omit<SchemaMeaning, 'slots'>;
type SchemaMeaningSlotBindingRow = Omit<SchemaMeaningSlotBinding, 'required'> & {
  required: number;
};

function parseSemanticModels(raw: string | null | undefined): SemanticModelRefKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is SemanticModelRefKey => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function serializeSemanticModels(models: readonly SemanticModelRefKey[] | undefined): string {
  return JSON.stringify(models ?? []);
}

function toSchema(row: SchemaRow): Schema {
  const semanticModels = parseSemanticModels(row.semantic_models ?? row.models);
  return {
    ...row,
    semantic_models: semanticModels,
    models: row.models == null ? semanticModels : parseSemanticModels(row.models),
  };
}

function normalizeMeaningBindings(
  bindings: readonly FieldMeaningBindingKey[] | null | undefined,
  annotation: FieldMeaningKey | null | undefined,
): FieldMeaningBindingKey[] {
  const raw = bindings && bindings.length > 0
    ? bindings
    : fieldMeaningToMeaningBindings(annotation);
  return [...new Set(raw.filter((item): item is FieldMeaningBindingKey => typeof item === 'string' && item.trim().length > 0))];
}

function getFieldMeaningBindings(db: ReturnType<typeof getDatabase>, fieldId: string): FieldMeaningBindingKey[] {
  const meaningRows = db.prepare(
    `SELECT meaning_key FROM field_meaning_bindings WHERE field_id = ? ORDER BY sort_order, meaning_key`,
  ).all(fieldId) as { meaning_key: string }[];
  if (meaningRows.length > 0) return meaningRows.map((row) => row.meaning_key as FieldMeaningBindingKey);

  return [];
}

function getFieldMeaningBindingsByFieldId(db: ReturnType<typeof getDatabase>, fieldIds: string[]): Map<string, FieldMeaningBindingKey[]> {
  const byField = new Map<string, FieldMeaningBindingKey[]>();
  if (fieldIds.length === 0) return byField;

  const placeholders = fieldIds.map(() => '?').join(',');
  const meaningRows = db.prepare(
    `SELECT field_id, meaning_key FROM field_meaning_bindings WHERE field_id IN (${placeholders}) ORDER BY field_id, sort_order, meaning_key`,
  ).all(...fieldIds) as { field_id: string; meaning_key: string }[];
  if (meaningRows.length > 0) {
    for (const row of meaningRows) {
      const current = byField.get(row.field_id) ?? [];
      current.push(row.meaning_key as FieldMeaningBindingKey);
      byField.set(row.field_id, current);
    }
    return byField;
  }

  return byField;
}

function replaceFieldMeaningBindings(
  db: ReturnType<typeof getDatabase>,
  fieldId: string,
  bindings: readonly FieldMeaningBindingKey[],
  source: FieldMeaningBindingSource,
): void {
  db.prepare('DELETE FROM field_meaning_bindings WHERE field_id = ?').run(fieldId);
  const normalized = normalizeMeaningBindings(bindings, null);
  if (normalized.length === 0) return;

  const now = new Date().toISOString();
  const insertMeaning = db.prepare(
    `INSERT INTO field_meaning_bindings (id, field_id, meaning_key, source, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  normalized.forEach((meaning, index) => {
    insertMeaning.run(randomUUID(), fieldId, meaning, source, index, now);
  });
}

type FieldMeaningInput = {
  meaning_slot?: MeaningSlotKey | null;
  meaning_key?: FieldMeaningKey | null;
  meaning_bindings?: FieldMeaningBindingKey[];
};

function getMeaningSlotForMeaningBindings(bindings: readonly FieldMeaningBindingKey[]): MeaningSlotKey | null {
  for (const binding of bindings) {
    const slot = meaningBindingToMeaningSlot(binding);
    if (slot) return slot;
  }
  return null;
}

function getFieldMeaningForMeaningBindings(bindings: readonly FieldMeaningBindingKey[]): FieldMeaningKey | null {
  const slot = getMeaningSlotForMeaningBindings(bindings);
  return slot ? meaningSlotToFieldMeaning(slot) : null;
}

function toMeaningSlotBinding(row: SchemaMeaningSlotBindingRow): SchemaMeaningSlotBinding {
  return {
    ...row,
    required: !!row.required,
    target_kind: row.target_kind as SlotBindingTargetKind,
    slot_key: row.slot_key as MeaningSlotKey,
  };
}

function getMeaningSlotBindingsByMeaningId(
  db: ReturnType<typeof getDatabase>,
  meaningIds: string[],
): Map<string, SchemaMeaningSlotBinding[]> {
  const byMeaning = new Map<string, SchemaMeaningSlotBinding[]>();
  if (meaningIds.length === 0) return byMeaning;

  const placeholders = meaningIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM schema_meaning_slot_bindings WHERE meaning_id IN (${placeholders}) ORDER BY meaning_id, sort_order, slot_key`,
  ).all(...meaningIds) as SchemaMeaningSlotBindingRow[];

  for (const row of rows) {
    const current = byMeaning.get(row.meaning_id) ?? [];
    current.push(toMeaningSlotBinding(row));
    byMeaning.set(row.meaning_id, current);
  }
  return byMeaning;
}

function toMeaning(row: SchemaMeaningRow, slots: readonly SchemaMeaningSlotBinding[] = []): SchemaMeaning {
  return {
    ...row,
    meaning_key: row.meaning_key as SemanticMeaningKey,
    source: row.source as MeaningSourceKind,
    source_model: row.source_model ?? null,
    slots: [...slots],
  };
}

function reconcileMeaningSlotBindings(
  db: ReturnType<typeof getDatabase>,
  meaningId: string,
  meaningKey: SemanticMeaningKey,
): void {
  const definition = getSemanticMeaningDefinition(meaningKey);
  if (!definition) return;

  if (meaningKey === 'recurrence') {
    db.prepare(
      `DELETE FROM schema_meaning_slot_bindings
        WHERE meaning_id = ? AND slot_key = 'recurrence_rule'`,
    ).run(meaningId);
  }

  const now = new Date().toISOString();
  const insertSlot = db.prepare(
    `INSERT OR IGNORE INTO schema_meaning_slot_bindings (id, meaning_id, slot_key, target_kind, field_id, required, sort_order, created_at)
     VALUES (?, ?, ?, 'field', NULL, ?, ?, ?)`,
  );
  const updateSlot = db.prepare(
    `UPDATE schema_meaning_slot_bindings
        SET required = ?, sort_order = ?
      WHERE meaning_id = ? AND slot_key = ? AND target_kind = 'field'`,
  );

  [...definition.coreSlots, ...definition.optionalSlots].forEach((slot, index) => {
    const required = definition.coreSlots.includes(slot) ? 1 : 0;
    insertSlot.run(randomUUID(), meaningId, slot, required, index, now);
    updateSlot.run(required, index, meaningId, slot);
  });
}

function ensureMeaningForDb(
  db: ReturnType<typeof getDatabase>,
  schemaId: string,
  meaningKey: SemanticMeaningKey,
  options: {
    label?: string | null;
    source?: MeaningSourceKind;
    sourceModel?: SchemaMeaning['source_model'];
    sortOrder?: number;
  } = {},
): SchemaMeaning | null {
  const definition = getSemanticMeaningDefinition(meaningKey);
  if (!definition) return null;

  const existing = db.prepare(
    'SELECT * FROM schema_meanings WHERE schema_id = ? AND meaning_key = ?',
  ).get(schemaId, meaningKey) as SchemaMeaningRow | undefined;

  const now = new Date().toISOString();
  const id = existing?.id ?? randomUUID();
  const sortOrder = options.sortOrder ?? existing?.sort_order ?? (
    db.prepare('SELECT COUNT(*) AS count FROM schema_meanings WHERE schema_id = ?').get(schemaId) as { count: number }
  ).count;

  db.prepare(
    `INSERT OR IGNORE INTO schema_meanings (id, schema_id, meaning_key, label, source, source_model, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    schemaId,
    meaningKey,
    options.label ?? null,
    options.source ?? (options.sourceModel ? 'model' : 'manual'),
    options.sourceModel ?? null,
    sortOrder,
    now,
    now,
  );

  reconcileMeaningSlotBindings(db, id, meaningKey);

  const row = db.prepare('SELECT * FROM schema_meanings WHERE id = ?').get(id) as SchemaMeaningRow | undefined;
  if (!row) return null;
  const slots = getMeaningSlotBindingsByMeaningId(db, [id]).get(id) ?? [];
  return toMeaning(row, slots);
}

function syncFieldMeaningBinding(
  db: ReturnType<typeof getDatabase>,
  schemaId: string,
  slot: MeaningSlotKey | null | undefined,
  fieldId: string,
  source: MeaningSourceKind = 'system',
): void {
  const meaningDefinition = getSemanticMeaningForSlot(slot);
  if (!meaningDefinition) return;

  const meaning = ensureMeaningForDb(db, schemaId, meaningDefinition.key, { source });
  if (!meaning) return;

  db.prepare(
    `UPDATE schema_meaning_slot_bindings
        SET field_id = COALESCE(field_id, ?), target_kind = 'field'
      WHERE meaning_id = ? AND slot_key = ?`,
  ).run(fieldId, meaning.id, slot);
}

function toField(row: SchemaFieldRow, meaningBindings?: readonly FieldMeaningBindingKey[]): SchemaField {
  const fieldMeaning = row.meaning_key ?? meaningSlotToFieldMeaning(row.meaning_slot);
  const bindings = normalizeMeaningBindings(meaningBindings, fieldMeaning);
  const generatedByModel = Boolean(row.generated_by_model);
  const {
    meaning_slot: _meaningSlot,
    meaning_key: _meaningKey,
    ...field
  } = row;

  return {
    ...field,
    meaning_bindings: bindings,
    required: !!row.required,
    slot_binding_locked: !!row.slot_binding_locked,
    generated_by_model: generatedByModel,
  };
}

/**
 * BFS cycle detection for schema_ref chains.
 * Checks if adding a ref from `fromSchemaId` → `toSchemaId` would create a cycle.
 */
function detectSchemaRefCycle(fromSchemaId: string, toSchemaId: string): boolean {
  if (fromSchemaId === toSchemaId) return true;

  const db = getDatabase();
  const visited = new Set<string>();
  const queue = [toSchemaId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all schemas that `current` references via schema_ref fields
    const refs = db.prepare(
      `SELECT DISTINCT ref_schema_id FROM schema_fields
       WHERE schema_id = ? AND field_type = 'schema_ref' AND ref_schema_id IS NOT NULL`,
    ).all(current) as { ref_schema_id: string }[];

    for (const ref of refs) {
      if (ref.ref_schema_id === fromSchemaId) return true;
      queue.push(ref.ref_schema_id);
    }
  }

  return false;
}

// ============================================
// Schema CRUD
// ============================================

export function createSchema(data: SchemaCreate): Schema {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const semanticModels = data.semantic_models ?? data.models ?? [];

  db.prepare(
    `INSERT INTO schemas (id, project_id, group_id, name, description, icon, color, node_shape, file_template, semantic_models, models, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    serializeSemanticModels(semanticModels),
    serializeSemanticModels(semanticModels),
    now,
    now,
  );

  createObject('schema', 'project', data.project_id, id);
  syncProjectOntologyForDb(db, data.project_id);

  const row = db.prepare('SELECT * FROM schemas WHERE id = ?').get(id) as SchemaRow;
  return toSchema(row);
}

export function listSchemas(projectId: string): Schema[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM schemas WHERE project_id = ? ORDER BY created_at')
    .all(projectId) as SchemaRow[];
  return rows.map(toSchema);
}

export function getSchema(id: string): Schema | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM schemas WHERE id = ?').get(id) as SchemaRow | undefined;
  return row ? toSchema(row) : undefined;
}

export function updateSchema(id: string, data: SchemaUpdate): Schema | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM schemas WHERE id = ?').get(id) as SchemaRow | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const existingModels = existing.semantic_models ?? existing.models;
  const nextSemanticModels = data.semantic_models !== undefined
    ? serializeSemanticModels(data.semantic_models)
    : data.models !== undefined
      ? serializeSemanticModels(data.models)
      : existingModels;
  const nextModelsAlias = data.models !== undefined
    ? serializeSemanticModels(data.models)
    : data.semantic_models !== undefined
      ? serializeSemanticModels(data.semantic_models)
      : (existing.models ?? existingModels);

  db.prepare(
    `UPDATE schemas SET group_id = ?, name = ?, description = ?, icon = ?, color = ?, node_shape = ?, file_template = ?, semantic_models = ?, models = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.group_id !== undefined ? data.group_id : existing.group_id,
    data.name !== undefined ? data.name : existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.icon !== undefined ? data.icon : existing.icon,
    data.color !== undefined ? data.color : existing.color,
    data.node_shape !== undefined ? data.node_shape : existing.node_shape,
    data.file_template !== undefined ? data.file_template : existing.file_template,
    nextSemanticModels,
    nextModelsAlias,
    now,
    id,
  );

  const row = db.prepare('SELECT * FROM schemas WHERE id = ?').get(id) as SchemaRow;
  return toSchema(row);
}

export function deleteSchema(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM schemas WHERE id = ?').run(id);
  if (result.changes > 0) {
    deleteObjectByRef('schema', id);
    return true;
  }
  return false;
}

// ============================================
// Schema Meaning CRUD
// ============================================

export function listMeanings(schemaId: string): SchemaMeaning[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM schema_meanings WHERE schema_id = ? ORDER BY sort_order, created_at')
    .all(schemaId) as SchemaMeaningRow[];
  for (const row of rows) {
    reconcileMeaningSlotBindings(db, row.id, row.meaning_key as SemanticMeaningKey);
  }
  const slotsByMeaningId = getMeaningSlotBindingsByMeaningId(db, rows.map((row) => row.id));
  return rows.map((row) => toMeaning(row, slotsByMeaningId.get(row.id) ?? []));
}

export function ensureMeaning(data: SchemaMeaningCreate): SchemaMeaning | null {
  const db = getDatabase();
  return ensureMeaningForDb(db, data.schema_id, data.meaning_key, {
    label: data.label,
    source: data.source,
    sourceModel: data.source_model,
    sortOrder: data.sort_order,
  });
}

export function updateMeaning(id: string, data: SchemaMeaningUpdate): SchemaMeaning | null {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM schema_meanings WHERE id = ?').get(id) as SchemaMeaningRow | undefined;
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare('UPDATE schema_meanings SET label = ?, sort_order = ?, updated_at = ? WHERE id = ?').run(
    data.label !== undefined ? data.label : existing.label,
    data.sort_order !== undefined ? data.sort_order : existing.sort_order,
    now,
    id,
  );

  const row = db.prepare('SELECT * FROM schema_meanings WHERE id = ?').get(id) as SchemaMeaningRow;
  return toMeaning(row, getMeaningSlotBindingsByMeaningId(db, [id]).get(id) ?? []);
}

export function deleteMeaning(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM schema_meanings WHERE id = ?').run(id);
  return result.changes > 0;
}

export function updateMeaningSlotBinding(
  id: string,
  data: SchemaMeaningSlotBindingUpdate,
): SchemaMeaningSlotBinding | null {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM schema_meaning_slot_bindings WHERE id = ?').get(id) as SchemaMeaningSlotBindingRow | undefined;
  if (!existing) return null;

  const nextTargetKind = data.target_kind ?? existing.target_kind;
  const nextFieldId = data.field_id !== undefined ? data.field_id : existing.field_id;

  db.prepare('UPDATE schema_meaning_slot_bindings SET target_kind = ?, field_id = ? WHERE id = ?').run(
    nextTargetKind,
    nextFieldId ?? null,
    id,
  );

  if (nextTargetKind === 'field' && nextFieldId) {
    const slot = existing.slot_key as MeaningSlotKey;
    const slotDefinition = getMeaningSlotDefinition(slot);
    const field = db.prepare('SELECT * FROM schema_fields WHERE id = ?').get(nextFieldId) as SchemaFieldRow | undefined;
    if (slotDefinition && field) {
      const nextFieldType = slotDefinition.allowedFieldTypes.includes(field.field_type)
        ? field.field_type
        : slotDefinition.allowedFieldTypes[0];
      const annotation = meaningSlotToFieldMeaning(slot);
      db.prepare(
        'UPDATE schema_fields SET meaning_slot = ?, meaning_key = ?, field_type = ?, slot_binding_locked = 1 WHERE id = ?',
      ).run(slot, annotation, nextFieldType, nextFieldId);
      replaceFieldMeaningBindings(db, nextFieldId, fieldMeaningToMeaningBindings(annotation), 'system');
    }
  }

  const row = db.prepare('SELECT * FROM schema_meaning_slot_bindings WHERE id = ?').get(id) as SchemaMeaningSlotBindingRow;
  return toMeaningSlotBinding(row);
}

// ============================================
// Schema Field CRUD
// ============================================

export function createField(data: SchemaFieldCreate): SchemaField {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  // Cycle detection for schema_ref fields
  if (data.field_type === 'schema_ref' && data.ref_schema_id) {
    if (detectSchemaRefCycle(data.schema_id, data.ref_schema_id)) {
      throw new Error('Circular schema reference detected');
    }
  }
  const meaningInput = data as SchemaFieldCreate & FieldMeaningInput;
  const requestedBindings = data.meaning_bindings
    ?? meaningInput.meaning_bindings
    ?? fieldMeaningToMeaningBindings(meaningInput.meaning_key ?? meaningSlotToFieldMeaning(meaningInput.meaning_slot));
  const fieldMeaning = meaningInput.meaning_key
    ?? getFieldMeaningForMeaningBindings(requestedBindings)
    ?? meaningSlotToFieldMeaning(meaningInput.meaning_slot);
  const meaningSlot = meaningInput.meaning_slot
    ?? getMeaningSlotForMeaningBindings(requestedBindings)
    ?? fieldMeaningToMeaningSlot(fieldMeaning);
  const meaningBindings = normalizeMeaningBindings(requestedBindings, fieldMeaning);
  const generatedByModel = data.generated_by_model ?? false;

  db.prepare(
    `INSERT INTO schema_fields (id, schema_id, name, field_type, options, sort_order, required, default_value, ref_schema_id, meaning_slot, meaning_key, slot_binding_locked, generated_by_model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.schema_id,
    data.name,
    data.field_type,
    data.options ?? null,
    data.sort_order,
    data.required ? 1 : 0,
    data.default_value ?? null,
    data.ref_schema_id ?? null,
    meaningSlot ?? null,
    fieldMeaning ?? null,
    data.slot_binding_locked ? 1 : 0,
    generatedByModel ? 1 : 0,
    now,
  );

  replaceFieldMeaningBindings(
    db,
    id,
    meaningBindings,
    data.meaning_bindings !== undefined || meaningInput.meaning_bindings !== undefined
      ? 'manual'
      : generatedByModel ? 'model' : 'system',
  );
  syncFieldMeaningBinding(
    db,
    data.schema_id,
    meaningSlot,
    id,
    generatedByModel ? 'model' : 'system',
  );

  const row = db.prepare('SELECT * FROM schema_fields WHERE id = ?').get(id) as SchemaFieldRow;
  return toField(row, getFieldMeaningBindings(db, id));
}

export function listFields(schemaId: string): SchemaField[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM schema_fields WHERE schema_id = ? ORDER BY sort_order')
    .all(schemaId) as SchemaFieldRow[];
  const meaningsByFieldId = getFieldMeaningBindingsByFieldId(db, rows.map((row) => row.id));
  return rows.map((row) => toField(row, meaningsByFieldId.get(row.id)));
}

export function updateField(id: string, data: SchemaFieldUpdate): SchemaField | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM schema_fields WHERE id = ?').get(id) as SchemaFieldRow | undefined;
  if (!existing) return undefined;

  const newFieldType = data.field_type !== undefined ? data.field_type : existing.field_type;
  const newRefId = data.ref_schema_id !== undefined ? data.ref_schema_id : (existing as unknown as { ref_schema_id: string | null }).ref_schema_id;

  // Cycle detection for schema_ref fields
  if (newFieldType === 'schema_ref' && newRefId) {
    if (detectSchemaRefCycle(existing.schema_id, newRefId)) {
      throw new Error('Circular schema reference detected');
    }
  }
  const meaningInput = data as SchemaFieldUpdate & FieldMeaningInput;
  const existingBindings = getFieldMeaningBindings(db, id);
  const semanticInputChanged = data.meaning_bindings !== undefined
    || meaningInput.meaning_bindings !== undefined
    || meaningInput.meaning_key !== undefined
    || meaningInput.meaning_slot !== undefined;
  const requestedBindings = data.meaning_bindings
    ?? meaningInput.meaning_bindings
    ?? (meaningInput.meaning_key !== undefined || meaningInput.meaning_slot !== undefined
      ? fieldMeaningToMeaningBindings(meaningInput.meaning_key ?? meaningSlotToFieldMeaning(meaningInput.meaning_slot))
      : existingBindings);
  const nextFieldMeaning = meaningInput.meaning_key !== undefined
    ? meaningInput.meaning_key
    : getFieldMeaningForMeaningBindings(requestedBindings)
      ?? (meaningInput.meaning_slot !== undefined
        ? meaningSlotToFieldMeaning(meaningInput.meaning_slot)
        : existing.meaning_key ?? meaningSlotToFieldMeaning(existing.meaning_slot));
  const nextMeaningSlot = meaningInput.meaning_slot !== undefined
    ? meaningInput.meaning_slot
    : getMeaningSlotForMeaningBindings(requestedBindings)
      ?? (meaningInput.meaning_key !== undefined
        ? fieldMeaningToMeaningSlot(meaningInput.meaning_key)
        : existing.meaning_slot ?? fieldMeaningToMeaningSlot(existing.meaning_key));

  db.prepare(
    `UPDATE schema_fields SET name = ?, field_type = ?, options = ?, sort_order = ?, required = ?, default_value = ?, ref_schema_id = ?, meaning_slot = ?, meaning_key = ?, slot_binding_locked = ?, generated_by_model = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    newFieldType,
    data.options !== undefined ? data.options : existing.options,
    data.sort_order !== undefined ? data.sort_order : existing.sort_order,
    data.required !== undefined ? (data.required ? 1 : 0) : existing.required,
    data.default_value !== undefined ? data.default_value : existing.default_value,
    newRefId ?? null,
    nextMeaningSlot ?? null,
    nextFieldMeaning ?? null,
    data.slot_binding_locked !== undefined ? (data.slot_binding_locked ? 1 : 0) : existing.slot_binding_locked,
    data.generated_by_model !== undefined
      ? (data.generated_by_model ? 1 : 0)
      : existing.generated_by_model,
    id,
  );

  if (semanticInputChanged) {
    replaceFieldMeaningBindings(
      db,
      id,
      normalizeMeaningBindings(requestedBindings, nextFieldMeaning),
      data.meaning_bindings !== undefined || meaningInput.meaning_bindings !== undefined ? 'manual' : 'system',
    );
    syncFieldMeaningBinding(db, existing.schema_id, nextMeaningSlot, id, 'system');
  }

  const row = db.prepare('SELECT * FROM schema_fields WHERE id = ?').get(id) as SchemaFieldRow;
  return toField(row, getFieldMeaningBindings(db, id));
}

export function deleteField(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM schema_fields WHERE id = ?').run(id);
  return result.changes > 0;
}

export function reorderFields(schemaId: string, orderedIds: string[]): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE schema_fields SET sort_order = ? WHERE id = ? AND schema_id = ?');
  db.transaction(() => {
    orderedIds.forEach((id, index) => {
      stmt.run(index, id, schemaId);
    });
  })();
}
