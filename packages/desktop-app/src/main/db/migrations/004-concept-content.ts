import type Database from 'better-sqlite3';

export function migrate004(db: Database.Database): void {
  db.exec(`ALTER TABLE concepts ADD COLUMN content TEXT`);
  db.exec(`ALTER TABLE concepts ADD COLUMN agent_content TEXT`);
}
