/**
 * Test helper: creates an in-memory SQLite database with the Netior schema.
 * Bypasses initDatabase() and runs migrations directly.
 */
import Database from 'better-sqlite3';
import { migrate001 } from '../migrations/001-initial';
import { migrate002 } from '../migrations/002-modules-and-hierarchical-canvas';
import { migrate003 } from '../migrations/003-schemas';
import { migrate004 } from '../migrations/004-concept-content';
import { migrate005 } from '../migrations/005-app-settings';
import { migrate006 } from '../migrations/006-canvas-1n-and-types';
import { migrate007 } from '../migrations/007-edge-visual-overrides';
import { migrate008 } from '../migrations/008-canvas-layout';
import { migrate009 } from '../migrations/009-file-entity';
import { migrate010 } from '../migrations/010-canvas-to-network';
import { migrate011 } from '../migrations/011-network-structure-and-layouts';
import { migrate012 } from '../migrations/012-objects-and-entity-nodes';
import { migrate013 } from '../migrations/013-contexts';
import { migrate014 } from '../migrations/014-schema-ref-field';
import { migrate015 } from '../migrations/015-type-groups';
import { migrate016 } from '../migrations/016-backfill-object-records';
import { migrate017 } from '../migrations/017-edge-relation-meaning-and-group-node-type';
import { migrate018 } from '../migrations/018-unify-hierarchy-parent-meaning';
import { migrate019 } from '../migrations/019-module-path';
import { migrate020 } from '../migrations/020-schema-meaning-foundation';
import { migrate021 } from '../migrations/021-concept-recurrence-materialization';
import { migrate022 } from '../migrations/022-network-universe-ontology';
import { migrate023 } from '../migrations/023-schema-field-meanings';
import { migrate024 } from '../migrations/024-field-meaning-bindings-v1';
import { migrate025 } from '../migrations/025-schema-meanings';
import { migrate026 } from '../migrations/026-structured-recurrence-meaning';
import { migrate027 } from '../migrations/027-semantic-models-and-meanings';
import { migrate028 } from '../migrations/028-semantic-model-objects';
import { migrate029 } from '../migrations/029-semantic-model-descriptions';
import { migrate030 } from '../migrations/030-semantic-model-recipes';
import { migrate031 } from '../migrations/031-field-meaning-bindings';
import { migrate032 } from '../migrations/032-domain-term-cleanup';
import { migrate033 } from '../migrations/033-ontology-network-name-cleanup';

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
  migrate013(testDb);
  migrate014(testDb);
  migrate015(testDb);
  migrate016(testDb);
  migrate017(testDb);
  migrate018(testDb);
  migrate019(testDb);
  migrate020(testDb);
  migrate021(testDb);
  migrate022(testDb);
  migrate023(testDb);
  migrate024(testDb);
  migrate025(testDb);
  migrate026(testDb);
  migrate027(testDb);
  migrate028(testDb);
  migrate029(testDb);
  migrate030(testDb);
  migrate031(testDb);
  migrate032(testDb);
  migrate033(testDb);
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
