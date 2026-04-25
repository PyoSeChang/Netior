import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createObject, deleteObjectByRef } from './objects';
import {
  semanticAnnotationToSystemSlot,
  systemSlotToSemanticAnnotation,
} from '@netior/shared/constants';
import type { Concept, ConceptCreate, ConceptUpdate, Archetype, ArchetypeField } from '@netior/shared/types';
import { renderTemplate, serializeToAgent } from '../services/concept-content-sync';

type ArchetypeRow = Omit<Archetype, 'semantic_traits' | 'facets'> & {
  semantic_traits: string | null;
  facets?: string | null;
};
type ArchetypeFieldRow = Omit<ArchetypeField, 'required' | 'slot_binding_locked' | 'generated_by_trait'> & {
  required: number;
  slot_binding_locked: number;
  generated_by_trait: number;
};

function toArchetype(row: ArchetypeRow): Archetype {
  let semanticTraits: Archetype['semantic_traits'] = [];
  let facets: Archetype['facets'] = [];
  try {
    const parsed = row.semantic_traits ? JSON.parse(row.semantic_traits) : [];
    if (Array.isArray(parsed)) {
      semanticTraits = parsed.filter((item): item is Archetype['semantic_traits'][number] => typeof item === 'string');
    }
  } catch {
    semanticTraits = [];
  }
  try {
    const parsed = row.facets ? JSON.parse(row.facets) : semanticTraits;
    if (Array.isArray(parsed)) {
      facets = parsed.filter((item): item is NonNullable<Archetype['facets']>[number] => typeof item === 'string');
    }
  } catch {
    facets = semanticTraits;
  }

  return {
    ...row,
    semantic_traits: semanticTraits,
    facets,
  };
}

function toField(row: ArchetypeFieldRow): ArchetypeField {
  const semanticAnnotation = row.semantic_annotation ?? systemSlotToSemanticAnnotation(row.system_slot);
  const systemSlot = row.system_slot ?? semanticAnnotationToSystemSlot(row.semantic_annotation);

  return {
    ...row,
    system_slot: systemSlot ?? null,
    semantic_annotation: semanticAnnotation ?? null,
    required: !!row.required,
    slot_binding_locked: !!row.slot_binding_locked,
    generated_by_trait: !!row.generated_by_trait,
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
  let archetype: Archetype | null = null;
  let fields: ArchetypeField[] = [];

  if (data.archetype_id) {
    const archetypeRow = db.prepare('SELECT * FROM archetypes WHERE id = ?').get(data.archetype_id) as ArchetypeRow | null;
    archetype = archetypeRow ? toArchetype(archetypeRow) : null;
    if (archetypeRow && archetype) {
      if (!data.color && archetype.color) color = archetype.color;
      if (!data.icon && archetype.icon) icon = archetype.icon;

      // Load fields for template rendering
      const rows = db.prepare('SELECT * FROM archetype_fields WHERE archetype_id = ? ORDER BY sort_order')
        .all(archetype.id) as ArchetypeFieldRow[];
      fields = rows.map(toField);

      // Render file_template as initial content
      if (archetype.file_template && !content) {
        const defaults: Record<string, string | null> = {};
        for (const f of fields) defaults[f.name] = f.default_value ?? null;
        content = renderTemplate(archetype.file_template, fields, defaults);
      }
    }
  }

  db.prepare(
    `INSERT INTO concepts (
      id,
      project_id,
      archetype_id,
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
    data.archetype_id ?? null,
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
  if (archetype) {
    const defaults: Record<string, string | null> = {};
    for (const f of fields) defaults[f.name] = f.default_value ?? null;
    agentContent = serializeToAgent({ concept, archetype, fields, properties: defaults });
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
     SET archetype_id = ?,
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
    data.archetype_id !== undefined ? data.archetype_id : existing.archetype_id,
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
