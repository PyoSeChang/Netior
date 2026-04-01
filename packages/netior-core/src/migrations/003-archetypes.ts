import type Database from 'better-sqlite3';

export function migrate003(db: Database.Database): void {
  db.exec(`
    CREATE TABLE archetypes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      node_shape TEXT,
      file_template TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE archetype_fields (
      id TEXT PRIMARY KEY,
      archetype_id TEXT NOT NULL REFERENCES archetypes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      field_type TEXT NOT NULL,
      options TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      required INTEGER NOT NULL DEFAULT 0,
      default_value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE concept_properties (
      id TEXT PRIMARY KEY,
      concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      field_id TEXT NOT NULL REFERENCES archetype_fields(id) ON DELETE CASCADE,
      value TEXT,
      UNIQUE(concept_id, field_id)
    )
  `);

  db.exec(`ALTER TABLE concepts ADD COLUMN archetype_id TEXT REFERENCES archetypes(id) ON DELETE SET NULL`);
}
