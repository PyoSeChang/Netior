import type Database from 'better-sqlite3';

interface ArchetypeRow {
  id: string;
  semantic_traits: string | null;
  facets: string | null;
}

interface MeaningRow {
  id: string;
  archetype_id: string;
}

const RECURRENCE_SLOTS = [
  {
    key: 'recurrence_frequency',
    label: 'Recurrence Frequency',
    annotation: 'time.recurrence_frequency',
    fieldType: 'select',
    options: JSON.stringify({ choices: ['daily', 'weekly', 'monthly'] }),
    required: 1,
  },
  {
    key: 'recurrence_interval',
    label: 'Recurrence Interval',
    annotation: 'time.recurrence_interval',
    fieldType: 'number',
    options: null,
    required: 1,
  },
  {
    key: 'recurrence_weekdays',
    label: 'Recurrence Weekdays',
    annotation: 'time.recurrence_weekdays',
    fieldType: 'multi-select',
    options: JSON.stringify({ choices: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] }),
    required: 0,
  },
  {
    key: 'recurrence_monthday',
    label: 'Recurrence Month Day',
    annotation: 'time.recurrence_monthday',
    fieldType: 'number',
    options: null,
    required: 0,
  },
  {
    key: 'recurrence_until',
    label: 'Recurrence Until',
    annotation: 'time.recurrence_until',
    fieldType: 'date',
    options: null,
    required: 0,
  },
  {
    key: 'recurrence_count',
    label: 'Recurrence Count',
    annotation: 'time.recurrence_count',
    fieldType: 'number',
    options: null,
    required: 0,
  },
] as const;

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function meaningId(archetypeId: string): string {
  return `meaning-${archetypeId}-recurrence`;
}

function slotBindingId(archetypeId: string, slotKey: string): string {
  return `meaning-slot-${archetypeId}-recurrence-${slotKey}`;
}

function fieldId(archetypeId: string, slotKey: string): string {
  return `field-${archetypeId}-${slotKey}`;
}

function propertyId(conceptId: string, fieldIdValue: string): string {
  return `property-${conceptId}-${fieldIdValue}`;
}

function formatLegacyUntil(value: string | undefined): string | null {
  if (!value) return null;
  const compactDate = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!compactDate) return value;
  return `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`;
}

function parseLegacyRule(rawValue: string | null): Partial<Record<string, string>> {
  if (!rawValue || rawValue.trim() === '') return {};
  const params = rawValue
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [key, ...rest] = part.split('=');
      if (!key || rest.length === 0) return acc;
      acc[key.toUpperCase()] = rest.join('=');
      return acc;
    }, {});

  const parsed: Partial<Record<string, string>> = {};
  const frequency = params.FREQ?.toLowerCase();
  if (frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly') {
    parsed.recurrence_frequency = frequency;
  }
  if (params.INTERVAL && Number.isFinite(Number(params.INTERVAL))) {
    parsed.recurrence_interval = String(Math.max(1, Math.floor(Number(params.INTERVAL))));
  }
  if (params.BYDAY) {
    const weekdays = params.BYDAY
      .split(',')
      .map((day) => day.trim().toUpperCase())
      .filter(Boolean);
    if (weekdays.length > 0) parsed.recurrence_weekdays = JSON.stringify(weekdays);
  }
  const until = formatLegacyUntil(params.UNTIL);
  if (until) parsed.recurrence_until = until;
  if (params.COUNT && Number.isFinite(Number(params.COUNT))) {
    parsed.recurrence_count = String(Math.max(1, Math.floor(Number(params.COUNT))));
  }
  return parsed;
}

export function migrate026(db: Database.Database): void {
  const now = new Date().toISOString();
  const targetArchetypeIds = new Set<string>();

  const archetypes = db.prepare('SELECT id, semantic_traits, facets FROM archetypes').all() as ArchetypeRow[];
  for (const archetype of archetypes) {
    const traits = [...parseList(archetype.semantic_traits), ...parseList(archetype.facets)];
    if (traits.includes('recurring')) {
      targetArchetypeIds.add(archetype.id);
    }
  }

  const legacyFieldRows = db.prepare(`
    SELECT DISTINCT archetype_id
      FROM archetype_fields
     WHERE system_slot = 'recurrence_rule'
        OR semantic_annotation = 'time.recurrence_rule'
  `).all() as { archetype_id: string }[];
  for (const row of legacyFieldRows) {
    targetArchetypeIds.add(row.archetype_id);
  }

  const existingMeaningRows = db.prepare(`
    SELECT id, archetype_id
      FROM archetype_meanings
     WHERE meaning_key = 'recurrence'
  `).all() as MeaningRow[];
  for (const row of existingMeaningRows) {
    targetArchetypeIds.add(row.archetype_id);
  }

  const insertMeaning = db.prepare(`
    INSERT OR IGNORE INTO archetype_meanings (id, archetype_id, meaning_key, label, source, source_trait, sort_order, created_at, updated_at)
    VALUES (?, ?, 'recurrence', NULL, 'migration', NULL, 0, ?, ?)
  `);
  for (const archetypeId of targetArchetypeIds) {
    insertMeaning.run(meaningId(archetypeId), archetypeId, now, now);
  }

  const recurrenceMeanings = db.prepare(`
    SELECT id, archetype_id
      FROM archetype_meanings
     WHERE meaning_key = 'recurrence'
  `).all() as MeaningRow[];

  const deleteLegacyBinding = db.prepare(`
    DELETE FROM archetype_meaning_slot_bindings
     WHERE meaning_id = ?
       AND slot_key = 'recurrence_rule'
  `);
  const insertBinding = db.prepare(`
    INSERT OR IGNORE INTO archetype_meaning_slot_bindings (id, meaning_id, slot_key, target_kind, field_id, required, sort_order, created_at)
    VALUES (?, ?, ?, 'field', NULL, ?, ?, ?)
  `);
  const updateBinding = db.prepare(`
    UPDATE archetype_meaning_slot_bindings
       SET required = ?, sort_order = ?
     WHERE meaning_id = ?
       AND slot_key = ?
       AND target_kind = 'field'
  `);
  const findFieldBySlot = db.prepare(`
    SELECT id
      FROM archetype_fields
     WHERE archetype_id = ?
       AND system_slot = ?
     LIMIT 1
  `);
  const insertField = db.prepare(`
    INSERT OR IGNORE INTO archetype_fields (
      id,
      archetype_id,
      name,
      field_type,
      options,
      sort_order,
      required,
      default_value,
      ref_archetype_id,
      system_slot,
      semantic_annotation,
      slot_binding_locked,
      generated_by_trait,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 1, 1, ?)
  `);
  const bindField = db.prepare(`
    UPDATE archetype_meaning_slot_bindings
       SET field_id = COALESCE(field_id, ?)
     WHERE meaning_id = ?
       AND slot_key = ?
       AND target_kind = 'field'
  `);
  const findLegacyField = db.prepare(`
    SELECT id
      FROM archetype_fields
     WHERE archetype_id = ?
       AND (system_slot = 'recurrence_rule' OR semantic_annotation = 'time.recurrence_rule')
     LIMIT 1
  `);
  const listLegacyProperties = db.prepare(`
    SELECT concept_id, value
      FROM concept_properties
     WHERE field_id = ?
       AND value IS NOT NULL
       AND value <> ''
  `);
  const insertConceptProperty = db.prepare(`
    INSERT OR IGNORE INTO concept_properties (id, concept_id, field_id, value)
    VALUES (?, ?, ?, ?)
  `);

  for (const meaning of recurrenceMeanings) {
    if (!targetArchetypeIds.has(meaning.archetype_id)) continue;

    const sortBase = (
      db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM archetype_fields WHERE archetype_id = ?')
        .get(meaning.archetype_id) as { maxSort: number }
    ).maxSort + 1;

    const fieldIdsBySlot = new Map<string, string>();
    deleteLegacyBinding.run(meaning.id);
    RECURRENCE_SLOTS.forEach((slot, index) => {
      const existingField = findFieldBySlot.get(meaning.archetype_id, slot.key) as { id: string } | undefined;
      const nextFieldId = existingField?.id ?? fieldId(meaning.archetype_id, slot.key);
      fieldIdsBySlot.set(slot.key, nextFieldId);
      if (!existingField) {
        insertField.run(
          nextFieldId,
          meaning.archetype_id,
          slot.label,
          slot.fieldType,
          slot.options,
          sortBase + index,
          slot.required,
          slot.key,
          slot.annotation,
          now,
        );
      }

      insertBinding.run(
        slotBindingId(meaning.archetype_id, slot.key),
        meaning.id,
        slot.key,
        slot.required,
        index,
        now,
      );
      updateBinding.run(slot.required, index, meaning.id, slot.key);
      bindField.run(nextFieldId, meaning.id, slot.key);
    });

    const legacyField = findLegacyField.get(meaning.archetype_id) as { id: string } | undefined;
    if (!legacyField) continue;

    const legacyProperties = listLegacyProperties.all(legacyField.id) as { concept_id: string; value: string | null }[];
    for (const property of legacyProperties) {
      const parsed = parseLegacyRule(property.value);
      for (const [slotKey, value] of Object.entries(parsed)) {
        const nextFieldId = fieldIdsBySlot.get(slotKey);
        if (!nextFieldId || !value) continue;
        insertConceptProperty.run(
          propertyId(property.concept_id, nextFieldId),
          property.concept_id,
          nextFieldId,
          value,
        );
      }
    }
  }
}
