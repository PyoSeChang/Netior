import type Database from 'better-sqlite3';
import { hasColumn } from '../connection';

export function migrate007(db: Database.Database): void {
  if (!hasColumn(db, 'edges', 'description')) {
    db.exec(`ALTER TABLE edges ADD COLUMN description TEXT`);
  }
  if (!hasColumn(db, 'edges', 'color')) {
    db.exec(`ALTER TABLE edges ADD COLUMN color TEXT`);
  }
  if (!hasColumn(db, 'edges', 'line_style')) {
    db.exec(`ALTER TABLE edges ADD COLUMN line_style TEXT`);
  }
  if (!hasColumn(db, 'edges', 'directed')) {
    db.exec(`ALTER TABLE edges ADD COLUMN directed INTEGER`);
  }
}
