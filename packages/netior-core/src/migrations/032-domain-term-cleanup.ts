import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return !!row;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

function renameTable(db: Database.Database, from: string, to: string): void {
  if (tableExists(db, from) && !tableExists(db, to)) {
    db.exec(`ALTER TABLE ${from} RENAME TO ${to}`);
  }
}

function renameColumn(db: Database.Database, table: string, from: string, to: string): void {
  if (hasColumn(db, table, from) && !hasColumn(db, table, to)) {
    db.exec(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
  }
}

export function migrate032(db: Database.Database): void {
  db.exec('PRAGMA foreign_keys = OFF');

  renameTable(db, 'archetypes', 'schemas');
  renameTable(db, 'archetype_fields', 'schema_fields');
  renameTable(db, 'archetype_meanings', 'schema_meanings');
  renameTable(db, 'archetype_meaning_slot_bindings', 'schema_meaning_slot_bindings');

  renameColumn(db, 'concepts', 'archetype_id', 'schema_id');
  renameColumn(db, 'schema_fields', 'archetype_id', 'schema_id');
  renameColumn(db, 'schema_fields', 'ref_archetype_id', 'ref_schema_id');
  renameColumn(db, 'schema_fields', 'system_slot', 'meaning_slot');
  renameColumn(db, 'schema_fields', 'semantic_annotation', 'meaning_key');
  renameColumn(db, 'schema_fields', 'generated_by_trait', 'generated_by_model');
  renameColumn(db, 'schema_meanings', 'archetype_id', 'schema_id');
  renameColumn(db, 'schema_meanings', 'source_trait', 'source_model');

  if (tableExists(db, 'schemas')) {
    if (!hasColumn(db, 'schemas', 'semantic_models')) {
      db.exec(`ALTER TABLE schemas ADD COLUMN semantic_models TEXT NOT NULL DEFAULT '[]'`);
    }
    if (!hasColumn(db, 'schemas', 'models')) {
      db.exec(`ALTER TABLE schemas ADD COLUMN models TEXT NOT NULL DEFAULT '[]'`);
    }
    const modelFallbacks = ['models', 'facets', 'semantic_traits']
      .filter((column) => hasColumn(db, 'schemas', column))
      .map((column) => `NULLIF(${column}, '')`);
    const modelFallbackSql = ["NULLIF(semantic_models, '')", ...modelFallbacks, "'[]'"].join(', ');
    db.exec(`
      UPDATE schemas
         SET semantic_models = COALESCE(${modelFallbackSql})
       WHERE semantic_models IS NULL OR semantic_models = '' OR semantic_models = '[]'
    `);
    db.exec(`
      UPDATE schemas
         SET models = COALESCE(NULLIF(models, ''), NULLIF(semantic_models, ''), '[]')
       WHERE models IS NULL OR models = '' OR models = '[]'
    `);
  }

  if (tableExists(db, 'schema_fields')) {
    if (!hasColumn(db, 'schema_fields', 'meaning_key')) {
      db.exec(`ALTER TABLE schema_fields ADD COLUMN meaning_key TEXT`);
    }
    if (!hasColumn(db, 'schema_fields', 'meaning_slot')) {
      db.exec(`ALTER TABLE schema_fields ADD COLUMN meaning_slot TEXT`);
    }
    if (!hasColumn(db, 'schema_fields', 'slot_binding_locked')) {
      db.exec(`ALTER TABLE schema_fields ADD COLUMN slot_binding_locked INTEGER NOT NULL DEFAULT 0`);
    }
    if (!hasColumn(db, 'schema_fields', 'generated_by_model')) {
      db.exec(`ALTER TABLE schema_fields ADD COLUMN generated_by_model INTEGER NOT NULL DEFAULT 0`);
    }
  }

  if (tableExists(db, 'edges')) {
    if (!hasColumn(db, 'edges', 'relation_meaning')) {
      db.exec(`ALTER TABLE edges ADD COLUMN relation_meaning TEXT`);
    }
    const relationFallbacks: string[] = ['relation_meaning'];
    if (hasColumn(db, 'edges', 'semantic_annotation')) {
      relationFallbacks.push('semantic_annotation');
    }
    if (hasColumn(db, 'edges', 'system_contract')) {
      relationFallbacks.push(`CASE system_contract
             WHEN 'core:contains' THEN 'structure.contains'
             WHEN 'core:entry_portal' THEN 'structure.entry_portal'
             WHEN 'core:hierarchy_parent' THEN 'structure.parent'
             ELSE NULL
           END`);
    }
    db.exec(`
      UPDATE edges
         SET relation_meaning = COALESCE(${relationFallbacks.join(', ')})
       WHERE relation_meaning IS NULL
    `);
  }

  if (tableExists(db, 'objects')) {
    db.exec(`UPDATE objects SET object_type = 'schema' WHERE object_type = 'archetype'`);
  }

  if (tableExists(db, 'type_groups')) {
    db.exec(`UPDATE type_groups SET kind = 'schema' WHERE kind = 'archetype'`);
  }

  db.exec('PRAGMA foreign_keys = ON');
}
