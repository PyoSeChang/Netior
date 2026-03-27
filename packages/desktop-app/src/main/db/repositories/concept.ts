import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { Concept, ConceptCreate, ConceptUpdate, Archetype, ArchetypeField } from '@moc/shared/types';
import { renderTemplate, serializeToAgent } from '../../services/concept-content-sync';

type ArchetypeFieldRow = Omit<ArchetypeField, 'required'> & { required: number };

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
    archetype = db.prepare('SELECT * FROM archetypes WHERE id = ?').get(data.archetype_id) as Archetype | null;
    if (archetype) {
      if (!data.color && archetype.color) color = archetype.color;
      if (!data.icon && archetype.icon) icon = archetype.icon;

      // Load fields for template rendering
      const rows = db.prepare('SELECT * FROM archetype_fields WHERE archetype_id = ? ORDER BY sort_order')
        .all(archetype.id) as ArchetypeFieldRow[];
      fields = rows.map((r) => ({ ...r, required: !!r.required }));

      // Render file_template as initial content
      if (archetype.file_template && !content) {
        const defaults: Record<string, string | null> = {};
        for (const f of fields) defaults[f.name] = f.default_value ?? null;
        content = renderTemplate(archetype.file_template, fields, defaults);
      }
    }
  }

  db.prepare(
    `INSERT INTO concepts (id, project_id, archetype_id, title, color, icon, content, agent_content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.project_id, data.archetype_id ?? null, data.title, color, icon, content, null, now, now);

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
    `UPDATE concepts SET archetype_id = ?, title = ?, color = ?, icon = ?, content = ?, agent_content = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.archetype_id !== undefined ? data.archetype_id : existing.archetype_id,
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
  return result.changes > 0;
}

export function searchConcepts(projectId: string, query: string): Concept[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM concepts WHERE project_id = ? AND title LIKE ? ORDER BY title')
    .all(projectId, `%${query}%`) as Concept[];
}
