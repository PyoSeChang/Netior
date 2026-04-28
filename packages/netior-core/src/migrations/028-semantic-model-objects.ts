import type Database from 'better-sqlite3';

interface BuiltInSemanticModelSeed {
  key: string;
  name: string;
  category: string;
  meanings: string[];
  coreSlots: string[];
  optionalSlots: string[];
}

const BUILT_IN_SEMANTIC_MODELS: readonly BuiltInSemanticModelSeed[] = [
  { key: 'temporal', name: 'Temporal', category: 'time', meanings: ['time_interval'], coreSlots: ['start_at'], optionalSlots: ['end_at', 'all_day', 'timezone'] },
  { key: 'dueable', name: 'Dueable', category: 'time', meanings: ['deadline'], coreSlots: ['due_at'], optionalSlots: [] },
  { key: 'recurring', name: 'Recurring', category: 'time', meanings: ['recurrence'], coreSlots: ['recurrence_frequency', 'recurrence_interval'], optionalSlots: ['recurrence_weekdays', 'recurrence_monthday', 'recurrence_until', 'recurrence_count'] },
  { key: 'statusful', name: 'Statusful', category: 'workflow', meanings: ['workflow_state'], coreSlots: ['status'], optionalSlots: ['status_changed_at'] },
  { key: 'assignable', name: 'Assignable', category: 'workflow', meanings: ['assignment'], coreSlots: ['assignee_refs'], optionalSlots: ['primary_assignee_ref'] },
  { key: 'prioritizable', name: 'Prioritizable', category: 'workflow', meanings: ['priority'], coreSlots: ['priority'], optionalSlots: [] },
  { key: 'progressable', name: 'Progressable', category: 'workflow', meanings: ['progress'], coreSlots: ['progress_ratio'], optionalSlots: ['completed_at'] },
  { key: 'estimable', name: 'Estimable', category: 'workflow', meanings: ['estimate'], coreSlots: ['estimate_value'], optionalSlots: ['estimate_unit', 'actual_value'] },
  { key: 'hierarchical', name: 'Hierarchical', category: 'structure', meanings: ['hierarchy'], coreSlots: ['parent_ref'], optionalSlots: ['order_index'] },
  { key: 'ordered', name: 'Ordered', category: 'structure', meanings: ['ordering'], coreSlots: ['order_index'], optionalSlots: [] },
  { key: 'taggable', name: 'Taggable', category: 'structure', meanings: ['tagging'], coreSlots: ['tag_keys'], optionalSlots: [] },
  { key: 'categorizable', name: 'Categorizable', category: 'structure', meanings: ['classification'], coreSlots: ['category_key'], optionalSlots: [] },
  { key: 'sourceable', name: 'Sourceable', category: 'knowledge', meanings: ['source'], coreSlots: ['source_url'], optionalSlots: ['source_ref', 'citation'] },
  { key: 'attachable', name: 'Attachable', category: 'knowledge', meanings: ['attachment'], coreSlots: ['attachment_refs'], optionalSlots: [] },
  { key: 'versioned', name: 'Versioned', category: 'knowledge', meanings: ['versioning'], coreSlots: ['version'], optionalSlots: ['revision', 'supersedes_ref'] },
  { key: 'locatable', name: 'Locatable', category: 'space', meanings: ['location'], coreSlots: ['place_ref'], optionalSlots: ['address', 'lat', 'lng'] },
  { key: 'measurable', name: 'Measurable', category: 'quant', meanings: ['measurement'], coreSlots: ['measure_value'], optionalSlots: ['measure_unit', 'target_value'] },
  { key: 'budgeted', name: 'Budgeted', category: 'quant', meanings: ['budget'], coreSlots: ['budget_amount'], optionalSlots: ['budget_currency', 'budget_limit'] },
  { key: 'ownable', name: 'Ownable', category: 'governance', meanings: ['ownership'], coreSlots: ['owner_ref'], optionalSlots: [] },
  { key: 'approvable', name: 'Approvable', category: 'governance', meanings: ['approval'], coreSlots: ['approval_state'], optionalSlots: ['approved_by_ref', 'approved_at'] },
];

export function migrate028(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS semantic_models (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'knowledge',
      meaning_keys TEXT NOT NULL DEFAULT '[]',
      core_slots TEXT NOT NULL DEFAULT '[]',
      optional_slots TEXT NOT NULL DEFAULT '[]',
      color TEXT,
      icon TEXT,
      built_in INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, key)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_semantic_models_project
      ON semantic_models(project_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_semantic_models_category
      ON semantic_models(project_id, category)
  `);

  const projects = db.prepare('SELECT id FROM projects').all() as { id: string }[];
  const now = new Date().toISOString();
  const insertModel = db.prepare(`
    INSERT OR IGNORE INTO semantic_models (
      id, project_id, key, name, description, category,
      meaning_keys, core_slots, optional_slots, built_in, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 1, ?, ?)
  `);
  const insertObject = db.prepare(`
    INSERT OR IGNORE INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    VALUES (?, 'model', 'project', ?, ?, ?)
  `);

  for (const project of projects) {
    for (const model of BUILT_IN_SEMANTIC_MODELS) {
      const id = `semantic-model-${project.id}-${model.key}`;
      insertModel.run(
        id,
        project.id,
        model.key,
        model.name,
        model.category,
        JSON.stringify(model.meanings),
        JSON.stringify(model.coreSlots),
        JSON.stringify(model.optionalSlots),
        now,
        now,
      );
      insertObject.run(`object-model-${id}`, project.id, id, now);
    }
  }
}
