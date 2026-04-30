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

export function migrate034(db: Database.Database): void {
  if (tableExists(db, 'semantic_models') && !tableExists(db, 'models')) {
    db.exec(`ALTER TABLE semantic_models RENAME TO models`);
  }

  if (tableExists(db, 'semantic_models') && tableExists(db, 'models')) {
    db.exec(`
      INSERT OR IGNORE INTO models (
        id, project_id, key, name, description, category,
        meaning_keys, core_slots, optional_slots, recipe_json,
        color, icon, built_in, created_at, updated_at
      )
      SELECT id, project_id, key, name, description, category,
             meaning_keys, core_slots, optional_slots, recipe_json,
             color, icon, built_in, created_at, updated_at
        FROM semantic_models
    `);
    db.exec(`DROP TABLE semantic_models`);
  }

  if (tableExists(db, 'models')) {
    db.exec(`DROP INDEX IF EXISTS idx_semantic_models_project`);
    db.exec(`DROP INDEX IF EXISTS idx_semantic_models_category`);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_models_project
        ON models(project_id)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_models_category
        ON models(project_id, category)
    `);
  }

  if (tableExists(db, 'schemas') && !hasColumn(db, 'schemas', 'models')) {
    db.exec(`ALTER TABLE schemas ADD COLUMN models TEXT NOT NULL DEFAULT '[]'`);
  }

  if (tableExists(db, 'schemas') && hasColumn(db, 'schemas', 'semantic_models')) {
    db.exec(`DROP TABLE IF EXISTS schemas_new`);
    db.exec(`
      CREATE TABLE schemas_new (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        group_id TEXT REFERENCES type_groups(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        node_shape TEXT,
        file_template TEXT,
        models TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      INSERT INTO schemas_new (
        id, project_id, group_id, name, description, icon, color,
        node_shape, file_template, models, created_at, updated_at
      )
      SELECT id, project_id, group_id, name, description, icon, color,
             node_shape, file_template,
             COALESCE(NULLIF(models, ''), NULLIF(semantic_models, ''), '[]'),
             created_at, updated_at
        FROM schemas
    `);

    db.exec(`DROP TABLE schemas`);
    db.exec(`ALTER TABLE schemas_new RENAME TO schemas`);
  }
}
