import type Database from 'better-sqlite3';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

export function migrate027(db: Database.Database): void {
  if (!hasColumn(db, 'archetypes', 'semantic_models')) {
    db.exec(`ALTER TABLE archetypes ADD COLUMN semantic_models TEXT NOT NULL DEFAULT '[]'`);
    db.exec(`
      UPDATE archetypes
         SET semantic_models = COALESCE(NULLIF(facets, ''), NULLIF(semantic_traits, ''), '[]')
       WHERE semantic_models = '[]'
    `);
  }

  if (!hasColumn(db, 'archetype_meanings', 'source_model')) {
    db.exec(`ALTER TABLE archetype_meanings ADD COLUMN source_model TEXT`);
    db.exec(`
      UPDATE archetype_meanings
         SET source_model = source_trait
       WHERE source_model IS NULL
         AND source_trait IS NOT NULL
    `);
  }

  if (!hasColumn(db, 'archetype_fields', 'generated_by_model')) {
    db.exec(`ALTER TABLE archetype_fields ADD COLUMN generated_by_model INTEGER NOT NULL DEFAULT 0`);
    db.exec(`
      UPDATE archetype_fields
         SET generated_by_model = generated_by_trait
       WHERE generated_by_trait IS NOT NULL
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS slot_semantic_roles (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL REFERENCES archetype_fields(id) ON DELETE CASCADE,
      role_key TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      strength REAL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(field_id, role_key)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_slot_semantic_roles_field
      ON slot_semantic_roles(field_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_slot_semantic_roles_role
      ON slot_semantic_roles(role_key)
  `);

  db.exec(`
    INSERT OR IGNORE INTO slot_semantic_roles (id, field_id, role_key, source, strength, sort_order, created_at)
    SELECT 'slot-role-' || field_id || '-' || replace(aspect_key, '.', '_'),
           field_id,
           aspect_key,
           CASE source WHEN 'facet' THEN 'model' ELSE source END,
           strength,
           sort_order,
           created_at
      FROM slot_semantic_aspects
  `);
}
