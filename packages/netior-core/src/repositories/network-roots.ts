import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { Network, NetworkNode, ObjectRecord } from '@netior/shared/types';

function insertNetworkLayout(db: Database.Database, networkId: string, now: string): void {
  db.prepare(
    `INSERT INTO layouts (id, layout_type, network_id, context_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), 'freeform', networkId, null, now, now);
}

function insertNetworkObject(
  db: Database.Database,
  scope: 'app' | 'project',
  projectId: string | null,
  networkId: string,
  now: string,
): void {
  db.prepare(
    `INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), 'network', scope, projectId, networkId, now);
}

function insertProjectObject(db: Database.Database, projectId: string, now: string): ObjectRecord {
  const id = randomUUID();

  db.prepare(
    `INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, 'project', 'app', null, projectId, now);

  return db.prepare('SELECT * FROM objects WHERE id = ?').get(id) as ObjectRecord;
}

function getProjectObjectForDb(db: Database.Database, projectId: string): ObjectRecord | undefined {
  return db.prepare(
    `SELECT * FROM objects WHERE object_type = 'project' AND ref_id = ?`,
  ).get(projectId) as ObjectRecord | undefined;
}

function ensureProjectObjectForDb(db: Database.Database, projectId: string): ObjectRecord {
  const existing = getProjectObjectForDb(db, projectId);
  if (existing) return existing;

  return insertProjectObject(db, projectId, new Date().toISOString());
}

function insertPortalNode(
  db: Database.Database,
  networkId: string,
  objectId: string,
  now: string,
): NetworkNode {
  const id = randomUUID();

  db.prepare(
    `INSERT INTO network_nodes (id, network_id, object_id, node_type, parent_node_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, networkId, objectId, 'portal', null, null, now, now);

  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
}

function getAppRootProjectNodeCount(db: Database.Database, appRootId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as count
     FROM network_nodes nn
     JOIN objects o ON nn.object_id = o.id
     WHERE nn.network_id = ? AND o.object_type = 'project'`,
  ).get(appRootId) as { count: number };

  return row.count;
}

function getDefaultProjectNodePosition(index: number): string {
  const columns = 3;
  const horizontalGap = 320;
  const verticalGap = 220;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = (column - 1) * horizontalGap;
  const y = row * verticalGap;

  return JSON.stringify({ x, y });
}

function setNodePosition(db: Database.Database, layoutId: string, nodeId: string, positionJson: string): void {
  db.prepare(
    `INSERT INTO layout_nodes (id, layout_id, node_id, position_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(layout_id, node_id) DO UPDATE SET position_json = excluded.position_json`,
  ).run(randomUUID(), layoutId, nodeId, positionJson);
}

function insertRootNetwork(
  db: Database.Database,
  data: {
    projectId: string | null;
    name: string;
    scope: 'app' | 'project';
    parentNetworkId: string | null;
  },
): Network {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO networks (id, project_id, name, scope, parent_network_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.projectId, data.name, data.scope, data.parentNetworkId, now, now);

  insertNetworkLayout(db, id, now);
  insertNetworkObject(db, data.scope, data.projectId, id, now);

  return db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network;
}

export function getAppRootNetworkForDb(db: Database.Database): Network | undefined {
  return db.prepare(
    `SELECT * FROM networks WHERE scope = 'app' AND parent_network_id IS NULL`,
  ).get() as Network | undefined;
}

export function ensureAppRootNetworkForDb(db: Database.Database): Network {
  const existing = getAppRootNetworkForDb(db);
  if (existing) return existing;

  return insertRootNetwork(db, {
    projectId: null,
    name: 'App Root',
    scope: 'app',
    parentNetworkId: null,
  });
}

export function getProjectRootNetworkForDb(db: Database.Database, projectId: string): Network | undefined {
  const appRoot = getAppRootNetworkForDb(db);
  if (!appRoot) return undefined;

  return db.prepare(
    `SELECT * FROM networks WHERE scope = 'project' AND project_id = ? AND parent_network_id = ?`,
  ).get(projectId, appRoot.id) as Network | undefined;
}

export function ensureProjectRootNetworkForDb(db: Database.Database, projectId: string): Network {
  const existing = getProjectRootNetworkForDb(db, projectId);
  if (existing) return existing;

  const appRoot = ensureAppRootNetworkForDb(db);
  return insertRootNetwork(db, {
    projectId,
    name: 'Project Root',
    scope: 'project',
    parentNetworkId: appRoot.id,
  });
}

export function getProjectNodeInAppRootForDb(db: Database.Database, projectId: string): NetworkNode | undefined {
  const appRoot = getAppRootNetworkForDb(db);
  if (!appRoot) return undefined;

  return db.prepare(
    `SELECT nn.*
     FROM network_nodes nn
     JOIN objects o ON nn.object_id = o.id
     WHERE nn.network_id = ? AND o.object_type = 'project' AND o.ref_id = ?`,
  ).get(appRoot.id, projectId) as NetworkNode | undefined;
}

export function ensureProjectNodeInAppRootForDb(db: Database.Database, projectId: string): NetworkNode {
  const existing = getProjectNodeInAppRootForDb(db, projectId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const appRoot = ensureAppRootNetworkForDb(db);
  const appRootLayout = db.prepare(
    'SELECT id FROM layouts WHERE network_id = ?',
  ).get(appRoot.id) as { id: string } | undefined;
  const projectObject = ensureProjectObjectForDb(db, projectId);
  const node = insertPortalNode(db, appRoot.id, projectObject.id, now);

  if (appRootLayout) {
    const positionIndex = getAppRootProjectNodeCount(db, appRoot.id) - 1;
    setNodePosition(db, appRootLayout.id, node.id, getDefaultProjectNodePosition(positionIndex));
  }

  return node;
}
