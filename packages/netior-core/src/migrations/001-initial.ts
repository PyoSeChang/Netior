import type Database from 'better-sqlite3';

export function migrate001(db: Database.Database): void {
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      root_dir TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE concepts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE canvases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      viewport_x REAL NOT NULL DEFAULT 0,
      viewport_y REAL NOT NULL DEFAULT 0,
      viewport_zoom REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE canvas_nodes (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
      concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      width REAL,
      height REAL,
      UNIQUE(canvas_id, concept_id)
    );

    CREATE TABLE edges (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
      source_node_id TEXT NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
      target_node_id TEXT NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE concept_files (
      id TEXT PRIMARY KEY,
      concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(concept_id, file_path)
    );
  `);
}
