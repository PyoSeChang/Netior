/**
 * Test helper: creates an in-memory SQLite database with the Netior schema.
 * Bypasses initDatabase() and runs migrations directly.
 */
import Database from 'better-sqlite3';
import { migrate001 } from '../migrations/001-initial';
import { migrate002 } from '../migrations/002-modules-and-hierarchical-canvas';
import { migrate003 } from '../migrations/003-archetypes';
import { migrate004 } from '../migrations/004-concept-content';
import { migrate005 } from '../migrations/005-app-settings';
import { migrate006 } from '../migrations/006-canvas-1n-and-types';
import { migrate007 } from '../migrations/007-edge-visual-overrides';
import { migrate008 } from '../migrations/008-canvas-layout';
import { migrate009 } from '../migrations/009-file-entity';
import { migrate010 } from '../migrations/010-canvas-to-network';
import { migrate011 } from '../migrations/011-network-structure-and-layouts';
import { migrate012 } from '../migrations/012-objects-and-entity-nodes';

let testDb: Database.Database | null = null;

export function setupTestDb(): Database.Database {
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  migrate001(testDb);
  migrate002(testDb);
  migrate003(testDb);
  migrate004(testDb);
  migrate005(testDb);
  testDb.pragma('foreign_keys = OFF');
  migrate006(testDb);
  migrate007(testDb);
  migrate008(testDb);
  migrate009(testDb);
  migrate010(testDb);
  migrate011(testDb);
  migrate012(testDb);
  testDb.pragma('foreign_keys = ON');
  return testDb;
}

export function teardownTestDb(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

export function getTestDb(): Database.Database {
  if (!testDb) throw new Error('Test DB not initialized');
  return testDb;
}
