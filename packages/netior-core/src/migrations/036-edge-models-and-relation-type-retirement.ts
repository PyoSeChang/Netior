import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return !!row;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

function normalizeKey(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function ensureModelColumns(db: Database.Database): void {
  if (!tableExists(db, 'models')) return;
  if (!hasColumn(db, 'models', 'target_kind')) {
    db.exec(`ALTER TABLE models ADD COLUMN target_kind TEXT NOT NULL DEFAULT 'object'`);
  }
  if (!hasColumn(db, 'models', 'line_style')) {
    db.exec(`ALTER TABLE models ADD COLUMN line_style TEXT`);
  }
  if (!hasColumn(db, 'models', 'directed')) {
    db.exec(`ALTER TABLE models ADD COLUMN directed INTEGER`);
  }
}

function edgeRecipe(key: string, label: string, description: string): string {
  return JSON.stringify({
    meanings: [{
      id: key,
      key,
      name: label,
      description,
      representation: 'relation',
      fields: [],
    }],
    rules: [],
  });
}

function ensureBuiltInEdgeModels(db: Database.Database): void {
  if (!tableExists(db, 'projects') || !tableExists(db, 'models')) return;
  const projects = db.prepare('SELECT id FROM projects').all() as { id: string }[];
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO models (
      id, project_id, key, name, description, category, target_kind,
      meaning_keys, core_slots, optional_slots, recipe_json,
      color, icon, line_style, directed, built_in, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'structure', 'edge', '[]', '[]', '[]', ?, ?, NULL, ?, ?, 1, ?, ?)
  `);
  const update = db.prepare(`
    UPDATE models
       SET target_kind = 'edge',
           line_style = ?,
           directed = ?,
           recipe_json = CASE
             WHEN recipe_json IS NULL OR trim(recipe_json) = '' OR recipe_json = '{"meanings":[],"rules":[]}' THEN ?
             ELSE recipe_json
           END,
           updated_at = ?
     WHERE project_id = ? AND key = ? AND built_in = 1
  `);
  const objectInsert = db.prepare(`
    INSERT OR IGNORE INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    VALUES (?, 'model', 'project', ?, ?, ?)
  `);

  const definitions = [
    {
      key: 'contains_relation',
      label: 'Contains',
      description: 'Represents containment, composition, or membership between two nodes.',
      color: '#4ade80',
      lineStyle: 'solid',
      directed: 1,
    },
    {
      key: 'entry_portal_relation',
      label: 'Entry Portal',
      description: 'Marks the node that should open as the entry point for a contained structure.',
      color: '#38bdf8',
      lineStyle: 'dashed',
      directed: 1,
    },
    {
      key: 'parent_relation',
      label: 'Parent Relation',
      description: 'Represents a hierarchy parent-child relation between nodes.',
      color: '#a78bfa',
      lineStyle: 'solid',
      directed: 1,
    },
  ] as const;

  for (const project of projects) {
    for (const definition of definitions) {
      const id = `model-${project.id}-${definition.key}`;
      const recipe = edgeRecipe(definition.key, definition.label, definition.description);
      insert.run(
        id,
        project.id,
        definition.key,
        definition.label,
        definition.description,
        recipe,
        definition.color,
        definition.lineStyle,
        definition.directed,
        now,
        now,
      );
      update.run(definition.lineStyle, definition.directed, recipe, now, project.id, definition.key);
      objectInsert.run(`object-model-${id}`, project.id, id, now);
    }
  }
}

function migrateRelationTypesToModels(db: Database.Database): void {
  if (!tableExists(db, 'relation_types') || !tableExists(db, 'models')) return;
  const rows = db.prepare('SELECT * FROM relation_types ORDER BY project_id, created_at').all() as Array<{
    id: string;
    project_id: string;
    name: string;
    description: string | null;
    color: string | null;
    line_style: string | null;
    directed: number | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
  const usedKeysByProject = new Map<string, Set<string>>();
  const existing = db.prepare('SELECT project_id, key FROM models').all() as Array<{ project_id: string; key: string }>;
  for (const row of existing) {
    const keys = usedKeysByProject.get(row.project_id) ?? new Set<string>();
    keys.add(row.key);
    usedKeysByProject.set(row.project_id, keys);
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO models (
      id, project_id, key, name, description, category, target_kind,
      meaning_keys, core_slots, optional_slots, recipe_json,
      color, icon, line_style, directed, built_in, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'structure', 'edge', '[]', '[]', '[]', ?, ?, NULL, ?, ?, 0, ?, ?)
  `);
  const now = new Date().toISOString();

  for (const row of rows) {
    const keys = usedKeysByProject.get(row.project_id) ?? new Set<string>();
    let key = normalizeKey(row.name, 'relation_model');
    let suffix = 2;
    while (keys.has(key)) {
      key = `${normalizeKey(row.name, 'relation_model')}_${suffix}`;
      suffix += 1;
    }
    keys.add(key);
    usedKeysByProject.set(row.project_id, keys);

    const description = row.description ?? `Migrated edge model from relation type "${row.name}".`;
    insert.run(
      row.id,
      row.project_id,
      key,
      row.name,
      description,
      edgeRecipe(key, row.name, description),
      row.color,
      row.line_style ?? 'solid',
      row.directed ?? 0,
      row.created_at ?? now,
      row.updated_at ?? now,
    );
  }

  if (tableExists(db, 'objects')) {
    db.exec(`UPDATE objects SET object_type = 'model' WHERE object_type = 'relation_type'`);
  }
}

function edgeModelIdExpression(db: Database.Database): string {
  const branches: string[] = [];
  if (hasColumn(db, 'edges', 'model_id')) {
    branches.push('WHEN e.model_id IS NOT NULL THEN e.model_id');
  }
  if (hasColumn(db, 'edges', 'relation_type_id')) {
    branches.push('WHEN e.relation_type_id IS NOT NULL THEN e.relation_type_id');
  }
  if (hasColumn(db, 'edges', 'relation_meaning')) {
    branches.push(
      "WHEN e.relation_meaning = 'structure.contains' THEN 'model-' || n.project_id || '-contains_relation'",
      "WHEN e.relation_meaning = 'structure.entry_portal' THEN 'model-' || n.project_id || '-entry_portal_relation'",
      "WHEN e.relation_meaning = 'structure.parent' THEN 'model-' || n.project_id || '-parent_relation'",
    );
  }
  return `CASE ${branches.join(' ')} ELSE NULL END`;
}

function rebuildEdgesForModels(db: Database.Database): void {
  if (!tableExists(db, 'edges')) return;
  const needsRebuild = !hasColumn(db, 'edges', 'model_id')
    || hasColumn(db, 'edges', 'relation_type_id')
    || hasColumn(db, 'edges', 'relation_meaning');
  if (!needsRebuild) return;

  db.exec(`DROP TABLE IF EXISTS edges_new`);
  db.exec(`
    CREATE TABLE edges_new (
      id             TEXT PRIMARY KEY,
      network_id     TEXT NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
      source_node_id TEXT NOT NULL REFERENCES network_nodes(id) ON DELETE CASCADE,
      target_node_id TEXT NOT NULL REFERENCES network_nodes(id) ON DELETE CASCADE,
      model_id       TEXT REFERENCES models(id) ON DELETE SET NULL,
      description    TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    INSERT INTO edges_new (
      id, network_id, source_node_id, target_node_id, model_id, description, created_at
    )
    SELECT e.id, e.network_id, e.source_node_id, e.target_node_id,
           ${edgeModelIdExpression(db)},
           e.description, e.created_at
      FROM edges e
      LEFT JOIN networks n ON n.id = e.network_id
  `);

  db.exec(`DROP TABLE edges`);
  db.exec(`ALTER TABLE edges_new RENAME TO edges`);
}

export function migrate036(db: Database.Database): void {
  ensureModelColumns(db);
  ensureBuiltInEdgeModels(db);
  migrateRelationTypesToModels(db);
  rebuildEdgesForModels(db);

  if (tableExists(db, 'type_groups')) {
    if (tableExists(db, 'objects')) {
      db.exec(`
        DELETE FROM objects
         WHERE object_type = 'type_group'
           AND ref_id IN (SELECT id FROM type_groups WHERE kind = 'relation_type')
      `);
    }
    db.exec(`DELETE FROM type_groups WHERE kind = 'relation_type'`);
  }

  db.exec(`DROP TABLE IF EXISTS canvas_type_allowed_relations`);
  db.exec(`DROP TABLE IF EXISTS relation_types`);
}
