import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { getDatabase, updateConcept, upsertProperty, serializeToAgent, parseFromAgent } from '@netior/core';
import type { Archetype, ArchetypeField, Concept, ConceptProperty } from '@netior/shared/types';

type ArchetypeFieldRow = Omit<ArchetypeField, 'required'> & { required: number };

function loadConceptData(conceptId: string) {
  const db = getDatabase();
  const concept = db.prepare('SELECT * FROM concepts WHERE id = ?').get(conceptId) as Concept | undefined;
  if (!concept) return null;

  let archetype: Archetype | null = null;
  let fields: ArchetypeField[] = [];
  const properties: Record<string, string | null> = {};

  if (concept.archetype_id) {
    archetype = db.prepare('SELECT * FROM archetypes WHERE id = ?').get(concept.archetype_id) as Archetype | null;
    if (archetype) {
      const rows = db.prepare('SELECT * FROM archetype_fields WHERE archetype_id = ? ORDER BY sort_order')
        .all(archetype.id) as ArchetypeFieldRow[];
      fields = rows.map((r) => ({ ...r, required: !!r.required }));
    }

    const props = db.prepare('SELECT * FROM concept_properties WHERE concept_id = ?')
      .all(conceptId) as ConceptProperty[];

    for (const field of fields) {
      const prop = props.find((p) => p.field_id === field.id);
      properties[field.name] = prop?.value ?? null;
    }
  }

  return { concept, archetype, fields, properties };
}

export function registerConceptContentIpc(): void {
  ipcMain.handle('concept:syncToAgent', async (_e, conceptId: string): Promise<IpcResult<unknown>> => {
    try {
      const data = loadConceptData(conceptId);
      if (!data) return { success: false, error: 'Concept not found' };

      const agentContent = serializeToAgent(data);
      const updated = updateConcept(conceptId, { agent_content: agentContent });
      return { success: true, data: updated };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:syncFromAgent', async (_e, conceptId: string, agentContent: string): Promise<IpcResult<unknown>> => {
    try {
      const data = loadConceptData(conceptId);
      if (!data) return { success: false, error: 'Concept not found' };

      const parsed = parseFromAgent(agentContent, data.fields);

      // Update properties
      for (const [fieldId, value] of Object.entries(parsed.properties)) {
        upsertProperty({ concept_id: conceptId, field_id: fieldId, value });
      }

      // Update concept content + title + re-serialize
      const updateData: Record<string, string | null | undefined> = {
        content: parsed.content,
      };
      if (parsed.title) {
        updateData.title = parsed.title;
      }

      // Re-load and re-serialize to get normalized agent_content
      updateConcept(conceptId, updateData);
      const refreshed = loadConceptData(conceptId);
      if (refreshed) {
        const normalized = serializeToAgent(refreshed);
        updateConcept(conceptId, { agent_content: normalized });
      }

      const db = getDatabase();
      const result = db.prepare('SELECT * FROM concepts WHERE id = ?').get(conceptId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
