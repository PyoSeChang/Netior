import type Database from 'better-sqlite3';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

export function migrate021(db: Database.Database): void {
  if (!hasColumn(db, 'concepts', 'recurrence_source_concept_id')) {
    db.exec(`
      ALTER TABLE concepts
      ADD COLUMN recurrence_source_concept_id TEXT REFERENCES concepts(id) ON DELETE SET NULL
    `);
  }

  if (!hasColumn(db, 'concepts', 'recurrence_occurrence_key')) {
    db.exec(`
      ALTER TABLE concepts
      ADD COLUMN recurrence_occurrence_key TEXT
    `);
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_concepts_recurrence_source_key
    ON concepts (recurrence_source_concept_id, recurrence_occurrence_key)
    WHERE recurrence_source_concept_id IS NOT NULL
      AND recurrence_occurrence_key IS NOT NULL
  `);
}
