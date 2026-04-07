import type Database from 'better-sqlite3';

export function migrate013(db: Database.Database): void {
  db.exec(`
    CREATE TABLE contexts (
      id          TEXT PRIMARY KEY,
      network_id  TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE context_members (
      id          TEXT PRIMARY KEY,
      context_id  TEXT NOT NULL,
      member_type TEXT NOT NULL,
      member_id   TEXT NOT NULL,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE UNIQUE INDEX idx_context_members ON context_members(context_id, member_type, member_id)`);
}
