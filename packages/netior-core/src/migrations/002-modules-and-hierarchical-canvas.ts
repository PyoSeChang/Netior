import type Database from 'better-sqlite3';

export function migrate002(db: Database.Database): void {
  db.exec(`
    CREATE TABLE modules (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE module_directories (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      dir_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(module_id, dir_path)
    )
  `);

  db.exec(`ALTER TABLE canvases ADD COLUMN concept_id TEXT REFERENCES concepts(id) ON DELETE CASCADE`);

  db.exec(`CREATE UNIQUE INDEX idx_canvases_concept_id ON canvases(concept_id) WHERE concept_id IS NOT NULL`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS concept_editor_prefs (
      id TEXT PRIMARY KEY,
      concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      view_mode TEXT NOT NULL DEFAULT 'float',
      float_x REAL,
      float_y REAL,
      float_width REAL DEFAULT 600,
      float_height REAL DEFAULT 450,
      side_split_ratio REAL DEFAULT 0.5,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(concept_id)
    )
  `);
}
