import type Database from 'better-sqlite3';

interface ArchetypeRow {
  id: string;
  semantic_traits: string | null;
  facets?: string | null;
}

interface FieldRow {
  id: string;
  archetype_id: string;
  system_slot: string | null;
  semantic_annotation: string | null;
}

const SLOT_TO_MEANING: Record<string, string> = {
  start_at: 'time_interval',
  end_at: 'time_interval',
  all_day: 'time_interval',
  timezone: 'time_interval',
  due_at: 'deadline',
  recurrence_rule: 'recurrence',
  recurrence_frequency: 'recurrence',
  recurrence_interval: 'recurrence',
  recurrence_weekdays: 'recurrence',
  recurrence_monthday: 'recurrence',
  recurrence_until: 'recurrence',
  recurrence_count: 'recurrence',
  status: 'workflow_state',
  status_changed_at: 'workflow_state',
  assignee_refs: 'assignment',
  primary_assignee_ref: 'assignment',
  priority: 'priority',
  progress_ratio: 'progress',
  completed_at: 'progress',
  estimate_value: 'estimate',
  estimate_unit: 'estimate',
  actual_value: 'estimate',
  parent_ref: 'hierarchy',
  order_index: 'ordering',
  tag_keys: 'tagging',
  category_key: 'classification',
  source_url: 'source',
  source_ref: 'source',
  citation: 'source',
  attachment_refs: 'attachment',
  version: 'versioning',
  revision: 'versioning',
  supersedes_ref: 'versioning',
  place_ref: 'location',
  address: 'location',
  lat: 'location',
  lng: 'location',
  measure_value: 'measurement',
  measure_unit: 'measurement',
  target_value: 'measurement',
  budget_amount: 'budget',
  budget_currency: 'budget',
  budget_limit: 'budget',
  owner_ref: 'ownership',
  approval_state: 'approval',
  approved_by_ref: 'approval',
  approved_at: 'approval',
};

const ANNOTATION_TO_SLOT: Record<string, string> = {
  'time.start': 'start_at',
  'time.end': 'end_at',
  'time.all_day': 'all_day',
  'time.timezone': 'timezone',
  'time.due': 'due_at',
  'time.recurrence_rule': 'recurrence_rule',
  'time.recurrence_frequency': 'recurrence_frequency',
  'time.recurrence_interval': 'recurrence_interval',
  'time.recurrence_weekdays': 'recurrence_weekdays',
  'time.recurrence_monthday': 'recurrence_monthday',
  'time.recurrence_until': 'recurrence_until',
  'time.recurrence_count': 'recurrence_count',
  'workflow.status': 'status',
  'workflow.status_changed_at': 'status_changed_at',
  'workflow.assignees': 'assignee_refs',
  'workflow.primary_assignee': 'primary_assignee_ref',
  'workflow.priority': 'priority',
  'workflow.progress': 'progress_ratio',
  'workflow.completed_at': 'completed_at',
  'workflow.estimate_value': 'estimate_value',
  'workflow.estimate_unit': 'estimate_unit',
  'workflow.actual_value': 'actual_value',
  'structure.parent': 'parent_ref',
  'structure.order': 'order_index',
  'structure.tags': 'tag_keys',
  'structure.category': 'category_key',
  'knowledge.source_url': 'source_url',
  'knowledge.source_ref': 'source_ref',
  'knowledge.citation': 'citation',
  'knowledge.attachments': 'attachment_refs',
  'knowledge.version': 'version',
  'knowledge.revision': 'revision',
  'knowledge.supersedes': 'supersedes_ref',
  'space.place': 'place_ref',
  'space.address': 'address',
  'space.lat': 'lat',
  'space.lng': 'lng',
  'quant.measure_value': 'measure_value',
  'quant.measure_unit': 'measure_unit',
  'quant.target_value': 'target_value',
  'quant.budget_amount': 'budget_amount',
  'quant.budget_currency': 'budget_currency',
  'quant.budget_limit': 'budget_limit',
  'governance.owner': 'owner_ref',
  'governance.approval_state': 'approval_state',
  'governance.approved_by': 'approved_by_ref',
  'governance.approved_at': 'approved_at',
};

const TRAIT_TO_MEANINGS: Record<string, string[]> = {
  temporal: ['time_interval'],
  dueable: ['deadline'],
  recurring: ['recurrence'],
  statusful: ['workflow_state'],
  assignable: ['assignment'],
  prioritizable: ['priority'],
  progressable: ['progress'],
  estimable: ['estimate'],
  hierarchical: ['hierarchy'],
  ordered: ['ordering'],
  taggable: ['tagging'],
  categorizable: ['classification'],
  sourceable: ['source'],
  attachable: ['attachment'],
  versioned: ['versioning'],
  locatable: ['location'],
  measurable: ['measurement'],
  budgeted: ['budget'],
  ownable: ['ownership'],
  approvable: ['approval'],
};

const MEANING_SLOTS: Record<string, { core: string[]; optional: string[] }> = {
  time_interval: { core: ['start_at'], optional: ['end_at', 'all_day', 'timezone'] },
  deadline: { core: ['due_at'], optional: ['timezone'] },
  recurrence: { core: ['recurrence_frequency', 'recurrence_interval'], optional: ['recurrence_weekdays', 'recurrence_monthday', 'recurrence_until', 'recurrence_count'] },
  workflow_state: { core: ['status'], optional: ['status_changed_at'] },
  assignment: { core: ['assignee_refs'], optional: ['primary_assignee_ref'] },
  priority: { core: ['priority'], optional: [] },
  progress: { core: ['progress_ratio'], optional: ['completed_at'] },
  estimate: { core: ['estimate_value'], optional: ['estimate_unit', 'actual_value'] },
  hierarchy: { core: ['parent_ref'], optional: ['order_index'] },
  ordering: { core: ['order_index'], optional: [] },
  tagging: { core: ['tag_keys'], optional: [] },
  classification: { core: ['category_key'], optional: [] },
  source: { core: ['source_url'], optional: ['source_ref', 'citation'] },
  attachment: { core: ['attachment_refs'], optional: [] },
  versioning: { core: ['version'], optional: ['revision', 'supersedes_ref'] },
  location: { core: ['place_ref'], optional: ['address', 'lat', 'lng'] },
  measurement: { core: ['measure_value'], optional: ['measure_unit', 'target_value'] },
  budget: { core: ['budget_amount'], optional: ['budget_currency', 'budget_limit'] },
  ownership: { core: ['owner_ref'], optional: [] },
  approval: { core: ['approval_state'], optional: ['approved_by_ref', 'approved_at'] },
};

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function meaningId(archetypeId: string, meaningKey: string): string {
  return `meaning-${archetypeId}-${meaningKey}`;
}

function slotBindingId(meaningKey: string, archetypeId: string, slotKey: string): string {
  return `meaning-slot-${archetypeId}-${meaningKey}-${slotKey}`;
}

export function migrate025(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS archetype_meanings (
      id TEXT PRIMARY KEY,
      archetype_id TEXT NOT NULL REFERENCES archetypes(id) ON DELETE CASCADE,
      meaning_key TEXT NOT NULL,
      label TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      source_trait TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(archetype_id, meaning_key)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS archetype_meaning_slot_bindings (
      id TEXT PRIMARY KEY,
      meaning_id TEXT NOT NULL REFERENCES archetype_meanings(id) ON DELETE CASCADE,
      slot_key TEXT NOT NULL,
      target_kind TEXT NOT NULL DEFAULT 'field',
      field_id TEXT REFERENCES archetype_fields(id) ON DELETE SET NULL,
      required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(meaning_id, slot_key, target_kind)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_archetype_meanings_archetype
      ON archetype_meanings(archetype_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_archetype_meaning_slot_bindings_meaning
      ON archetype_meaning_slot_bindings(meaning_id)
  `);

  const now = new Date().toISOString();
  const archetypes = db.prepare('SELECT id, semantic_traits, facets FROM archetypes').all() as ArchetypeRow[];
  const fields = db.prepare('SELECT id, archetype_id, system_slot, semantic_annotation FROM archetype_fields').all() as FieldRow[];
  const fieldsByArchetype = new Map<string, FieldRow[]>();

  for (const field of fields) {
    const current = fieldsByArchetype.get(field.archetype_id) ?? [];
    current.push(field);
    fieldsByArchetype.set(field.archetype_id, current);
  }

  const insertMeaning = db.prepare(`
    INSERT OR IGNORE INTO archetype_meanings (id, archetype_id, meaning_key, label, source, source_trait, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `);
  const insertBinding = db.prepare(`
    INSERT OR IGNORE INTO archetype_meaning_slot_bindings (id, meaning_id, slot_key, target_kind, field_id, required, sort_order, created_at)
    VALUES (?, ?, ?, 'field', ?, ?, ?, ?)
  `);
  const updateBinding = db.prepare(`
    UPDATE archetype_meaning_slot_bindings SET field_id = COALESCE(field_id, ?) WHERE id = ?
  `);

  for (const archetype of archetypes) {
    const meaningKeys = new Map<string, { source: string; trait: string | null; order: number }>();
    const traits = [...new Set([...parseList(archetype.semantic_traits), ...parseList(archetype.facets)])];

    traits.forEach((trait, index) => {
      for (const meaning of TRAIT_TO_MEANINGS[trait] ?? []) {
        if (!meaningKeys.has(meaning)) {
          meaningKeys.set(meaning, { source: 'trait', trait, order: index });
        }
      }
    });

    for (const field of fieldsByArchetype.get(archetype.id) ?? []) {
      const slot = field.system_slot ?? (field.semantic_annotation ? ANNOTATION_TO_SLOT[field.semantic_annotation] : null);
      const meaning = slot ? SLOT_TO_MEANING[slot] : null;
      if (!meaning || meaningKeys.has(meaning)) continue;
      meaningKeys.set(meaning, { source: 'migration', trait: null, order: meaningKeys.size });
    }

    for (const [meaning, meta] of meaningKeys) {
      const id = meaningId(archetype.id, meaning);
      insertMeaning.run(id, archetype.id, meaning, meta.source, meta.trait, meta.order, now, now);
      const slotConfig = MEANING_SLOTS[meaning];
      if (!slotConfig) continue;

      [...slotConfig.core, ...slotConfig.optional].forEach((slot, index) => {
        const field = (fieldsByArchetype.get(archetype.id) ?? []).find((candidate) => (
          candidate.system_slot === slot || candidate.semantic_annotation === Object.keys(ANNOTATION_TO_SLOT).find((key) => ANNOTATION_TO_SLOT[key] === slot)
        ));
        const bindingId = slotBindingId(meaning, archetype.id, slot);
        insertBinding.run(
          bindingId,
          id,
          slot,
          field?.id ?? null,
          slotConfig.core.includes(slot) ? 1 : 0,
          index,
          now,
        );
        if (field?.id) updateBinding.run(field.id, bindingId);
      });
    }
  }
}
