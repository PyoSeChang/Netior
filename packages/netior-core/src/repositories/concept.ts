import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createObject, deleteObjectByRef } from './objects';
import {
  fieldMeaningToMeaningBindings,
  meaningSlotToFieldMeaning,
} from '@netior/shared/constants';
import type {
  Schema,
  SchemaField,
  Concept,
  ConceptCreate,
  ConceptUpdate,
  FieldMeaningBindingKey,
  ModelRefKey,
  FieldMeaningKey,
  MeaningSlotKey,
} from '@netior/shared/types';
import { renderTemplate, serializeToAgent } from '../services/concept-content-sync';

type SchemaRow = Omit<Schema, 'models'> & {
  models: string | null;
};
type SchemaFieldRow = Omit<SchemaField, 'required' | 'slot_binding_locked' | 'generated_by_model' | 'meaning_bindings'> & {
  meaning_slot: MeaningSlotKey | null;
  meaning_key: FieldMeaningKey | null;
  required: number;
  slot_binding_locked: number;
  generated_by_model: number;
};

function parseModels(raw: string | null | undefined): ModelRefKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is ModelRefKey => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toSchema(row: SchemaRow): Schema {
  return {
    ...row,
    models: parseModels(row.models),
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

function getFieldMeaningBindingsByFieldId(fieldIds: string[]): Map<string, FieldMeaningBindingKey[]> {
  const byField = new Map<string, FieldMeaningBindingKey[]>();
  if (fieldIds.length === 0) return byField;

  const db = getDatabase();
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

export function createConcept(data: ConceptCreate): Concept {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  let color = data.color ?? null;
  let icon = data.icon ?? null;
  let content = data.content ?? null;
  let agentContent = data.agent_content ?? null;
  let schema: Schema | null = null;
  let fields: SchemaField[] = [];

  if (data.schema_id) {
    const schemaRow = db.prepare('SELECT * FROM schemas WHERE id = ?').get(data.schema_id) as SchemaRow | null;
    schema = schemaRow ? toSchema(schemaRow) : null;
    if (schemaRow && schema) {
      if (!data.color && schema.color) color = schema.color;
      if (!data.icon && schema.icon) icon = schema.icon;

      // Load fields for template rendering
      const rows = db.prepare('SELECT * FROM schema_fields WHERE schema_id = ? ORDER BY sort_order')
        .all(schema.id) as SchemaFieldRow[];
      const meaningsByFieldId = getFieldMeaningBindingsByFieldId(rows.map((row) => row.id));
      fields = rows.map((row) => toField(row, meaningsByFieldId.get(row.id)));

      // Render file_template as initial content
      if (schema.file_template && !content) {
        const defaults: Record<string, string | null> = {};
        for (const f of fields) defaults[f.name] = f.default_value ?? null;
        content = renderTemplate(schema.file_template, fields, defaults);
      }
    }
  }

  db.prepare(
    `INSERT INTO concepts (
      id,
      project_id,
      schema_id,
      recurrence_source_concept_id,
      recurrence_occurrence_key,
      title,
      color,
      icon,
      content,
      agent_content,
      created_at,
      updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.project_id,
    data.schema_id ?? null,
    data.recurrence_source_concept_id ?? null,
    data.recurrence_occurrence_key ?? null,
    data.title,
    color,
    icon,
    content,
    null,
    now,
    now,
  );

  // Register object record
  createObject('concept', 'project', data.project_id, id);

  // Generate initial agent_content after insert (needs full concept)
  const concept = db.prepare('SELECT * FROM concepts WHERE id = ?').get(id) as Concept;
  if (schema) {
    const defaults: Record<string, string | null> = {};
    for (const f of fields) defaults[f.name] = f.default_value ?? null;
    agentContent = serializeToAgent({ concept, schema, fields, properties: defaults });
    db.prepare('UPDATE concepts SET agent_content = ? WHERE id = ?').run(agentContent, id);
    return db.prepare('SELECT * FROM concepts WHERE id = ?').get(id) as Concept;
  }

  return concept;
}

export function getConceptsByProject(projectId: string): Concept[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM concepts WHERE project_id = ? ORDER BY created_at')
    .all(projectId) as Concept[];
}

export function updateConcept(id: string, data: ConceptUpdate): Concept | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM concepts WHERE id = ?').get(id) as Concept | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE concepts
     SET schema_id = ?,
         recurrence_source_concept_id = ?,
         recurrence_occurrence_key = ?,
         title = ?,
         color = ?,
         icon = ?,
         content = ?,
         agent_content = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(
    data.schema_id !== undefined ? data.schema_id : existing.schema_id,
    data.recurrence_source_concept_id !== undefined
      ? data.recurrence_source_concept_id
      : existing.recurrence_source_concept_id,
    data.recurrence_occurrence_key !== undefined
      ? data.recurrence_occurrence_key
      : existing.recurrence_occurrence_key,
    data.title !== undefined ? data.title : existing.title,
    data.color !== undefined ? data.color : existing.color,
    data.icon !== undefined ? data.icon : existing.icon,
    data.content !== undefined ? data.content : existing.content,
    data.agent_content !== undefined ? data.agent_content : existing.agent_content,
    now,
    id,
  );

  return db.prepare('SELECT * FROM concepts WHERE id = ?').get(id) as Concept;
}

export function deleteConcept(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM concepts WHERE id = ?').run(id);
  if (result.changes > 0) {
    deleteObjectByRef('concept', id);
    return true;
  }
  return false;
}

export function searchConcepts(projectId: string, query: string): Concept[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM concepts WHERE project_id = ? AND title LIKE ? ORDER BY title')
    .all(projectId, `%${query}%`) as Concept[];
}
