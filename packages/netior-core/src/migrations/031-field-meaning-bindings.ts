import type Database from 'better-sqlite3';

export function migrate031(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_meaning_bindings (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL REFERENCES archetype_fields(id) ON DELETE CASCADE,
      meaning_key TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      strength REAL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(field_id, meaning_key)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_field_meaning_bindings_field
      ON field_meaning_bindings(field_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_field_meaning_bindings_meaning
      ON field_meaning_bindings(meaning_key)
  `);

  db.exec(`
    INSERT OR IGNORE INTO field_meaning_bindings (id, field_id, meaning_key, source, strength, sort_order, created_at)
    SELECT 'field-meaning-' || field_id || '-' || replace(role_key, '.', '_'),
           field_id,
           role_key,
           source,
           strength,
           sort_order,
           created_at
      FROM slot_semantic_roles
  `);

  db.exec(`
    INSERT OR IGNORE INTO field_meaning_bindings (id, field_id, meaning_key, source, strength, sort_order, created_at)
    SELECT 'field-meaning-' || field_id || '-' || replace(aspect_key, '.', '_'),
           field_id,
           aspect_key,
           CASE source WHEN 'facet' THEN 'model' ELSE source END,
           strength,
           sort_order,
           created_at
      FROM slot_semantic_aspects
  `);

  db.exec(`
    INSERT OR IGNORE INTO field_meaning_bindings (id, field_id, meaning_key, source, sort_order)
    SELECT 'field-meaning-' || id || '-' || replace(semantic_annotation, '.', '_'),
           id,
           semantic_annotation,
           'migration',
           0
      FROM archetype_fields
     WHERE semantic_annotation IS NOT NULL
       AND semantic_annotation <> ''
  `);
}
