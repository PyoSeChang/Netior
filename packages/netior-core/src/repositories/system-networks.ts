import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { Network, NetworkNode, NetworkObjectType, ObjectRecord } from '@netior/shared/types';

type NetworkScope = 'app' | 'project';
type SystemNetworkKind = 'universe' | 'ontology';
type OntologyObjectRole = 'type_group' | 'model' | 'schema';

function insertNetworkLayout(db: Database.Database, networkId: string, now: string): void {
  db.prepare(
    `INSERT INTO layouts (id, layout_type, network_id, context_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), 'freeform', networkId, null, now, now);
}

function ensureNetworkLayout(db: Database.Database, networkId: string): string | null {
  const existing = db.prepare('SELECT id FROM layouts WHERE network_id = ?').get(networkId) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO layouts (id, layout_type, network_id, context_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, 'freeform', networkId, null, now, now);
  return id;
}

function getObjectForDb(
  db: Database.Database,
  objectType: NetworkObjectType,
  refId: string,
): ObjectRecord | undefined {
  return db.prepare(
    'SELECT * FROM objects WHERE object_type = ? AND ref_id = ?',
  ).get(objectType, refId) as ObjectRecord | undefined;
}

function insertObject(
  db: Database.Database,
  objectType: NetworkObjectType,
  scope: NetworkScope,
  projectId: string | null,
  refId: string,
  now: string,
): ObjectRecord {
  const id = randomUUID();

  db.prepare(
    `INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, objectType, scope, projectId, refId, now);

  return db.prepare('SELECT * FROM objects WHERE id = ?').get(id) as ObjectRecord;
}

function ensureObjectForDb(
  db: Database.Database,
  objectType: NetworkObjectType,
  scope: NetworkScope,
  projectId: string | null,
  refId: string,
  createdAt?: string,
): ObjectRecord {
  const existing = getObjectForDb(db, objectType, refId);
  if (existing) return existing;

  return insertObject(db, objectType, scope, projectId, refId, createdAt ?? new Date().toISOString());
}

function insertSystemNetwork(
  db: Database.Database,
  data: {
    projectId: string | null;
    name: string;
    scope: NetworkScope;
    kind: SystemNetworkKind;
    parentNetworkId: string | null;
  },
): Network {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO networks (id, project_id, name, scope, kind, parent_network_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.projectId, data.name, data.scope, data.kind, data.parentNetworkId, now, now);

  insertNetworkLayout(db, id, now);
  ensureObjectForDb(db, 'network', data.scope, data.projectId, id, now);

  return db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network;
}

function normalizeSystemNetwork(
  db: Database.Database,
  network: Network,
  data: {
    name: string;
    scope: NetworkScope;
    kind: SystemNetworkKind;
    parentNetworkId: string | null;
  },
): Network {
  if (
    network.name === data.name
    && network.scope === data.scope
    && network.kind === data.kind
    && network.parent_network_id === data.parentNetworkId
  ) {
    ensureObjectForDb(db, 'network', data.scope, network.project_id, network.id, network.created_at);
    ensureNetworkLayout(db, network.id);
    return network;
  }

  db.prepare(
    `UPDATE networks
        SET name = ?, scope = ?, kind = ?, parent_network_id = ?, updated_at = ?
      WHERE id = ?`,
  ).run(data.name, data.scope, data.kind, data.parentNetworkId, new Date().toISOString(), network.id);

  ensureObjectForDb(db, 'network', data.scope, network.project_id, network.id, network.created_at);
  ensureNetworkLayout(db, network.id);
  return db.prepare('SELECT * FROM networks WHERE id = ?').get(network.id) as Network;
}

function insertNetworkNode(
  db: Database.Database,
  networkId: string,
  objectId: string,
  nodeType: string,
  metadata: string | null,
  now: string,
): NetworkNode {
  const id = randomUUID();

  db.prepare(
    `INSERT INTO network_nodes (id, network_id, object_id, node_type, parent_node_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, networkId, objectId, nodeType, null, metadata, now, now);

  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
}

function setNodePosition(db: Database.Database, layoutId: string, nodeId: string, positionJson: string): void {
  db.prepare(
    `INSERT INTO layout_nodes (id, layout_id, node_id, position_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(layout_id, node_id) DO UPDATE SET position_json = excluded.position_json`,
  ).run(randomUUID(), layoutId, nodeId, positionJson);
}

function ensureNodePosition(db: Database.Database, layoutId: string, nodeId: string, positionJson: string): void {
  const existing = db.prepare(
    'SELECT id FROM layout_nodes WHERE layout_id = ? AND node_id = ?',
  ).get(layoutId, nodeId) as { id: string } | undefined;
  if (existing) return;

  setNodePosition(db, layoutId, nodeId, positionJson);
}

export function ensureObjectNodeInNetworkForDb(
  db: Database.Database,
  data: {
    networkId: string;
    objectId: string;
    nodeType?: string;
    metadata?: string | null;
    positionJson?: string;
  },
): NetworkNode {
  const nodeType = data.nodeType ?? 'basic';
  const metadata = data.metadata ?? null;
  const existing = db.prepare(
    'SELECT * FROM network_nodes WHERE network_id = ? AND object_id = ?',
  ).get(data.networkId, data.objectId) as NetworkNode | undefined;

  const layoutId = data.positionJson ? ensureNetworkLayout(db, data.networkId) : null;
  if (existing) {
    if (existing.node_type !== nodeType || existing.metadata !== metadata) {
      db.prepare(
        'UPDATE network_nodes SET node_type = ?, metadata = ?, updated_at = ? WHERE id = ?',
      ).run(nodeType, metadata, new Date().toISOString(), existing.id);
    }
    if (layoutId && data.positionJson) {
      ensureNodePosition(db, layoutId, existing.id, data.positionJson);
    }
    return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(existing.id) as NetworkNode;
  }

  const node = insertNetworkNode(db, data.networkId, data.objectId, nodeType, metadata, new Date().toISOString());
  if (layoutId && data.positionJson) {
    setNodePosition(db, layoutId, node.id, data.positionJson);
  }
  return node;
}

export function getUniverseNetworkForDb(db: Database.Database): Network | undefined {
  return db.prepare(
    `SELECT * FROM networks WHERE kind = 'universe' ORDER BY created_at LIMIT 1`,
  ).get() as Network | undefined;
}

export function ensureUniverseNetworkForDb(db: Database.Database): Network {
  const existing = getUniverseNetworkForDb(db);
  if (existing) {
    return normalizeSystemNetwork(db, existing, {
      name: 'Universe',
      scope: 'app',
      kind: 'universe',
      parentNetworkId: null,
    });
  }

  return insertSystemNetwork(db, {
    projectId: null,
    name: 'Universe',
    scope: 'app',
    kind: 'universe',
    parentNetworkId: null,
  });
}

function getProjectOntologyNetworkRecordForDb(db: Database.Database, projectId: string): Network | undefined {
  const ontology = db.prepare(
    `SELECT * FROM networks
      WHERE kind = 'ontology'
        AND scope = 'project'
        AND project_id = ?
      ORDER BY created_at
      LIMIT 1`,
  ).get(projectId) as Network | undefined;
  if (ontology) return ontology;

  return db.prepare(
    `SELECT * FROM networks
      WHERE scope = 'project'
        AND project_id = ?
        AND parent_network_id IN (SELECT id FROM networks WHERE kind = 'universe')
      ORDER BY created_at
      LIMIT 1`,
  ).get(projectId) as Network | undefined;
}

export function getProjectOntologyNetworkForDb(db: Database.Database, projectId: string): Network | undefined {
  const ontology = getProjectOntologyNetworkRecordForDb(db, projectId);
  if (!ontology) return undefined;

  return normalizeSystemNetwork(db, ontology, {
    name: 'Ontology',
    scope: 'project',
    kind: 'ontology',
    parentNetworkId: null,
  });
}

function ensureProjectOntologyNetworkRecordForDb(db: Database.Database, projectId: string): Network {
  const existing = getProjectOntologyNetworkRecordForDb(db, projectId);
  if (existing) {
    return normalizeSystemNetwork(db, existing, {
      name: 'Ontology',
      scope: 'project',
      kind: 'ontology',
      parentNetworkId: null,
    });
  }

  return insertSystemNetwork(db, {
    projectId,
    name: 'Ontology',
    scope: 'project',
    kind: 'ontology',
    parentNetworkId: null,
  });
}

function getProjectNodeInUniverseForDb(db: Database.Database, projectId: string): NetworkNode | undefined {
  const universe = getUniverseNetworkForDb(db);
  if (!universe) return undefined;

  return db.prepare(
    `SELECT nn.*
     FROM network_nodes nn
     JOIN objects o ON nn.object_id = o.id
     WHERE nn.network_id = ? AND o.object_type = 'project' AND o.ref_id = ?`,
  ).get(universe.id, projectId) as NetworkNode | undefined;
}

function getUniverseProjectNodeCount(db: Database.Database, universeId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as count
     FROM network_nodes nn
     JOIN objects o ON nn.object_id = o.id
     WHERE nn.network_id = ? AND o.object_type = 'project'`,
  ).get(universeId) as { count: number };

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

export function ensureProjectNodeInUniverseForDb(db: Database.Database, projectId: string): NetworkNode {
  const existing = getProjectNodeInUniverseForDb(db, projectId);
  if (existing) return existing;

  const universe = ensureUniverseNetworkForDb(db);
  const projectObject = ensureObjectForDb(db, 'project', 'app', null, projectId);
  const node = ensureObjectNodeInNetworkForDb(db, {
    networkId: universe.id,
    objectId: projectObject.id,
    nodeType: 'portal',
    metadata: JSON.stringify({ managedBy: 'universe', universeRole: 'project' }),
  });

  const layoutId = ensureNetworkLayout(db, universe.id);
  if (layoutId) {
    const positionIndex = getUniverseProjectNodeCount(db, universe.id) - 1;
    ensureNodePosition(db, layoutId, node.id, getDefaultProjectNodePosition(positionIndex));
  }

  return node;
}

function ensureOntologyObjectRecordsForDb(db: Database.Database, projectId: string): void {
  const schemas = db.prepare(
    'SELECT id, project_id, created_at FROM schemas WHERE project_id = ?',
  ).all(projectId) as { id: string; project_id: string; created_at: string }[];
  for (const schema of schemas) {
    ensureObjectForDb(db, 'schema', 'project', schema.project_id, schema.id, schema.created_at);
  }

  const models = db.prepare(
    'SELECT id, project_id, created_at FROM models WHERE project_id = ?',
  ).all(projectId) as { id: string; project_id: string; created_at: string }[];
  for (const model of models) {
    ensureObjectForDb(db, 'model', 'project', model.project_id, model.id, model.created_at);
  }

  const typeGroups = db.prepare(
    'SELECT id, scope, project_id, created_at FROM type_groups WHERE project_id = ?',
  ).all(projectId) as { id: string; scope: NetworkScope; project_id: string; created_at: string }[];
  for (const typeGroup of typeGroups) {
    ensureObjectForDb(db, 'type_group', typeGroup.scope ?? 'project', typeGroup.project_id, typeGroup.id, typeGroup.created_at);
  }
}

function listOntologyObjectsForDb(
  db: Database.Database,
  projectId: string,
): Array<ObjectRecord & { ontology_role: OntologyObjectRole; sort_order: number; sort_created_at: string }> {
  return db.prepare(`
    SELECT o.*, 'type_group' AS ontology_role, 0 AS sort_order, tg.created_at AS sort_created_at
      FROM objects o
      JOIN type_groups tg ON o.object_type = 'type_group' AND o.ref_id = tg.id
     WHERE tg.project_id = ?
    UNION ALL
    SELECT o.*, 'schema' AS ontology_role, 1 AS sort_order, a.created_at AS sort_created_at
      FROM objects o
      JOIN schemas a ON o.object_type = 'schema' AND o.ref_id = a.id
     WHERE a.project_id = ?
    UNION ALL
    SELECT o.*, 'model' AS ontology_role, 2 AS sort_order, sm.created_at AS sort_created_at
      FROM objects o
      JOIN models sm ON o.object_type = 'model' AND o.ref_id = sm.id
     WHERE sm.project_id = ?
     ORDER BY sort_order, sort_created_at
  `).all(projectId, projectId, projectId) as Array<ObjectRecord & {
    ontology_role: OntologyObjectRole;
    sort_order: number;
    sort_created_at: string;
  }>;
}

function getDefaultOntologyNodePosition(role: OntologyObjectRole, index: number): string {
  const laneX: Record<OntologyObjectRole, number> = {
    type_group: -540,
    model: -120,
    schema: 300,
  };
  return JSON.stringify({
    x: laneX[role],
    y: index * 150,
  });
}

function removeStaleManagedOntologyNodes(
  db: Database.Database,
  ontologyNetworkId: string,
  desiredObjectIds: string[],
): void {
  if (desiredObjectIds.length === 0) {
    db.prepare(
      `DELETE FROM network_nodes
        WHERE network_id = ?
          AND metadata LIKE '%"managedBy":"ontology"%'`,
    ).run(ontologyNetworkId);
    return;
  }

  const placeholders = desiredObjectIds.map(() => '?').join(', ');
  db.prepare(
    `DELETE FROM network_nodes
      WHERE network_id = ?
        AND metadata LIKE '%"managedBy":"ontology"%'
        AND object_id NOT IN (${placeholders})`,
  ).run(ontologyNetworkId, ...desiredObjectIds);
}

export function syncProjectOntologyForDb(db: Database.Database, projectId: string): Network {
  const ontology = ensureProjectOntologyNetworkRecordForDb(db, projectId);
  ensureOntologyObjectRecordsForDb(db, projectId);

  const objects = listOntologyObjectsForDb(db, projectId);
  removeStaleManagedOntologyNodes(db, ontology.id, objects.map((object) => object.id));

  const roleIndexes: Record<OntologyObjectRole, number> = {
    type_group: 0,
    model: 0,
    schema: 0,
  };

  for (const object of objects) {
    const index = roleIndexes[object.ontology_role]++;
    ensureObjectNodeInNetworkForDb(db, {
      networkId: ontology.id,
      objectId: object.id,
      nodeType: object.ontology_role === 'type_group' ? 'group' : 'basic',
      metadata: JSON.stringify({
        managedBy: 'ontology',
        ontologyRole: object.ontology_role,
      }),
      positionJson: getDefaultOntologyNodePosition(object.ontology_role, index),
    });
  }

  return ontology;
}

export function ensureProjectOntologyNetworkForDb(db: Database.Database, projectId: string): Network {
  return syncProjectOntologyForDb(db, projectId);
}
