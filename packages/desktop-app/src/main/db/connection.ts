import { app } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import Database from 'better-sqlite3';

function getNativeBinding(): string | undefined {
  // In packaged app, the native .node file is in app.asar.unpacked
  const candidates = [
    join(__dirname, '../../node_modules/better-sqlite3/build/Release/better_sqlite3.node'),
    join(process.resourcesPath ?? '', 'app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined; // fallback to default bindings resolution
}
import { migrate001 } from './migrations/001-initial';
import { migrate002 } from './migrations/002-modules-and-hierarchical-canvas';
import { migrate003 } from './migrations/003-archetypes';
import { migrate004 } from './migrations/004-concept-content';
import { migrate005 } from './migrations/005-app-settings';
import { migrate006 } from './migrations/006-canvas-1n-and-types';
import { migrate007 } from './migrations/007-edge-visual-overrides';
import { migrate008 } from './migrations/008-canvas-layout';

let db: Database.Database | null = null;

interface Migration {
  version: number;
  migrate: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  { version: 1, migrate: migrate001 },
  { version: 2, migrate: migrate002 },
  { version: 3, migrate: migrate003 },
  { version: 4, migrate: migrate004 },
  { version: 5, migrate: migrate005 },
  { version: 6, migrate: migrate006 },
  { version: 7, migrate: migrate007 },
  { version: 8, migrate: migrate008 },
];

export function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.pragma(`table_info(${table})`) as { name: string }[];
  return cols.some((c) => c.name === column);
}

export function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { name: string } | undefined;
  return !!row;
}

export async function initDatabase(isDev = false): Promise<void> {
  const dbDir = join(app.getPath('userData'), 'data');
  mkdirSync(dbDir, { recursive: true });

  const dbName = isDev ? 'moc-dev.db' : 'moc.db';
  const dbPath = join(dbDir, dbName);
  console.log(`[DB] Using database: ${dbPath}`);
  const nativeBinding = getNativeBinding();
  db = new Database(dbPath, nativeBinding ? { nativeBinding } : {});

  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  // Run pending migrations
  const applied = new Set(
    (db.prepare('SELECT version FROM _migrations').all() as { version: number }[])
      .map((r) => r.version),
  );

  console.log(`[DB] Applied migrations: ${[...applied].join(', ') || 'none'}`);
  console.log(`[DB] Pending: ${migrations.filter((m) => !applied.has(m.version)).map((m) => m.version).join(', ') || 'none'}`);

  // Log existing tables
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
  console.log(`[DB] Existing tables: ${tables.join(', ')}`);

  // Patch: create concept_editor_prefs if migration 002 partially applied
  if (!tables.includes('concept_editor_prefs')) {
    console.log('[DB] Patching: creating missing concept_editor_prefs table');
    db.exec(`
      CREATE TABLE concept_editor_prefs (
        id TEXT PRIMARY KEY,
        concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
        view_mode TEXT NOT NULL DEFAULT 'float',
        float_x REAL,
        float_y REAL,
        float_width REAL DEFAULT 600,
        float_height REAL DEFAULT 450,
        side_split_ratio REAL DEFAULT 0.5,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(concept_id)
      )
    `);
  }

  for (const m of migrations) {
    if (!applied.has(m.version)) {
      console.log(`[DB] Running migration v${m.version}...`);
      db.pragma('foreign_keys = OFF');
      try {
        db.transaction(() => {
          m.migrate(db!);
          db!.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)').run(
            m.version,
            new Date().toISOString(),
          );
        })();
        console.log(`[DB] Migration v${m.version} applied.`);
      } catch (err) {
        console.error(`[DB] Migration v${m.version} FAILED:`, err);
        throw err;
      }
      db.pragma('foreign_keys = ON');
    }
  }
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
