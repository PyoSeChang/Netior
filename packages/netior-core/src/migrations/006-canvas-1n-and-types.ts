import type Database from 'better-sqlite3';

export function migrate006(db: Database.Database): void {
  // 1. Concept:Canvas 1:N 허용 (unique index 제거)
  db.exec(`DROP INDEX IF EXISTS idx_canvases_concept_id`);

  // 2. relation_types 테이블
  db.exec(`
    CREATE TABLE relation_types (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      line_style TEXT NOT NULL DEFAULT 'solid',
      directed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 3. canvas_types 테이블
  db.exec(`
    CREATE TABLE canvas_types (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 4. canvas_type ↔ relation_type 허용 관계 (junction)
  db.exec(`
    CREATE TABLE canvas_type_allowed_relations (
      id TEXT PRIMARY KEY,
      canvas_type_id TEXT NOT NULL REFERENCES canvas_types(id) ON DELETE CASCADE,
      relation_type_id TEXT NOT NULL REFERENCES relation_types(id) ON DELETE CASCADE,
      UNIQUE(canvas_type_id, relation_type_id)
    )
  `);

  // 5. edges에 relation_type_id, description, color, line_style, directed 추가
  db.exec(`ALTER TABLE edges ADD COLUMN relation_type_id TEXT REFERENCES relation_types(id) ON DELETE SET NULL`);
  db.exec(`ALTER TABLE edges ADD COLUMN description TEXT`);
  db.exec(`ALTER TABLE edges ADD COLUMN color TEXT`);
  db.exec(`ALTER TABLE edges ADD COLUMN line_style TEXT`);
  db.exec(`ALTER TABLE edges ADD COLUMN directed INTEGER`);

  // 6. canvases에 canvas_type_id 추가
  db.exec(`ALTER TABLE canvases ADD COLUMN canvas_type_id TEXT REFERENCES canvas_types(id) ON DELETE SET NULL`);

  // 7. canvas_nodes 테이블 재구성 (concept_id nullable + file_path/dir_path 추가)
  //    foreign_keys = OFF 상태에서 실행됨 (connection.ts migration runner)
  db.exec(`
    CREATE TABLE canvas_nodes_new (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
      concept_id TEXT REFERENCES concepts(id) ON DELETE CASCADE,
      file_path TEXT,
      dir_path TEXT,
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      width REAL,
      height REAL
    )
  `);

  db.exec(`
    INSERT INTO canvas_nodes_new (id, canvas_id, concept_id, position_x, position_y, width, height)
      SELECT id, canvas_id, concept_id, position_x, position_y, width, height FROM canvas_nodes
  `);

  db.exec(`DROP TABLE canvas_nodes`);
  db.exec(`ALTER TABLE canvas_nodes_new RENAME TO canvas_nodes`);

  // concept 노드의 캔버스 내 유일성 유지 (file/dir 노드는 제외)
  db.exec(`
    CREATE UNIQUE INDEX idx_canvas_nodes_concept
      ON canvas_nodes(canvas_id, concept_id) WHERE concept_id IS NOT NULL
  `);
}
