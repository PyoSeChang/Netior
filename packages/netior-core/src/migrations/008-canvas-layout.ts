import type Database from 'better-sqlite3';
import { hasColumn } from '../connection';

export function migrate008(db: Database.Database): void {
  if (!hasColumn(db, 'canvases', 'layout')) {
    db.exec(`ALTER TABLE canvases ADD COLUMN layout TEXT NOT NULL DEFAULT 'freeform'`);
  }
  if (!hasColumn(db, 'canvases', 'layout_config')) {
    db.exec(`ALTER TABLE canvases ADD COLUMN layout_config TEXT`);
  }
}
