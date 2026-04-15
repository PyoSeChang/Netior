import type Database from 'better-sqlite3';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

export function migrate020(db: Database.Database): void {
  if (!hasColumn(db, 'archetypes', 'semantic_traits')) {
    db.exec(`ALTER TABLE archetypes ADD COLUMN semantic_traits TEXT NOT NULL DEFAULT '[]'`);
  }

  if (!hasColumn(db, 'archetype_fields', 'system_slot')) {
    db.exec('ALTER TABLE archetype_fields ADD COLUMN system_slot TEXT');
  }

  if (!hasColumn(db, 'archetype_fields', 'slot_binding_locked')) {
    db.exec('ALTER TABLE archetype_fields ADD COLUMN slot_binding_locked INTEGER NOT NULL DEFAULT 0');
  }

  if (!hasColumn(db, 'archetype_fields', 'generated_by_trait')) {
    db.exec('ALTER TABLE archetype_fields ADD COLUMN generated_by_trait INTEGER NOT NULL DEFAULT 0');
  }
}
