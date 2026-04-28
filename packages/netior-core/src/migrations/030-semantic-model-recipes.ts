import type Database from 'better-sqlite3';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

export function migrate030(db: Database.Database): void {
  if (!hasColumn(db, 'semantic_models', 'recipe_json')) {
    db.exec(`
      ALTER TABLE semantic_models
        ADD COLUMN recipe_json TEXT NOT NULL DEFAULT '{"roles":[],"rules":[]}'
    `);
  }
}
