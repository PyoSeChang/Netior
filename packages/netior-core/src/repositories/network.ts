import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createLayout, getLayoutByNetwork, getNodePositions, getEdgeVisuals } from './layout';
import { createObject, deleteObjectByRef } from './objects';
import type {
  Network, NetworkCreate, NetworkUpdate,
  NetworkNode, NetworkNodeCreate,
  Edge, EdgeCreate, EdgeUpdate,
  ObjectRecord,
  Concept,
  FileEntity,
  RelationType,
  NetworkBreadcrumbItem,
} from '@netior/shared/types';
import type { Layout, LayoutNodePosition, LayoutEdgeVisual } from './layout';

// ── Network ──

export function createNetwork(data: NetworkCreate): Network {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const scope = data.scope ?? 'project';

  db.prepare(
    `INSERT INTO networks (id, project_id, name, scope, parent_network_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.project_id, data.name,
    scope,
    data.parent_network_id ?? null,
    now, now,
  );

  // Auto-create layout for this network
  createLayout({ networkId: id });

  // Register object record for the network
  createObject('network', scope, data.project_id ?? null, id);

  return db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network;
}

export function listNetworks(projectId: string, rootOnly = false): Network[] {
  const db = getDatabase();
  const sql = rootOnly
    ? 'SELECT * FROM networks WHERE project_id = ? AND parent_network_id IS NULL ORDER BY created_at'
    : 'SELECT * FROM networks WHERE project_id = ? ORDER BY created_at';
  return db.prepare(sql).all(projectId) as Network[];
}

export interface NetworkTreeNode {
  network: Network;
  children: NetworkTreeNode[];
}

export function getNetworkTree(projectId: string): NetworkTreeNode[] {
  const db = getDatabase();

  const allNetworks = db.prepare(
    'SELECT * FROM networks WHERE project_id = ? ORDER BY created_at',
  ).all(projectId) as Network[];

  // Group by parent_network_id
  const childrenOf = new Map<string, NetworkTreeNode[]>();
  const roots: NetworkTreeNode[] = [];

  for (const network of allNetworks) {
    const node: NetworkTreeNode = { network, children: [] };

    if (!network.parent_network_id) {
      roots.push(node);
    } else {
      const siblings = childrenOf.get(network.parent_network_id) ?? [];
      siblings.push(node);
      childrenOf.set(network.parent_network_id, siblings);
    }
  }

  function attachChildren(nodes: NetworkTreeNode[]): void {
    for (const node of nodes) {
      node.children = childrenOf.get(node.network.id) ?? [];
      attachChildren(node.children);
    }
  }
  attachChildren(roots);

  return roots;
}

export function getNetworkAncestors(networkId: string): NetworkBreadcrumbItem[] {
  const db = getDatabase();

  // Recursive CTE following parent_network_id chain
  const rows = db.prepare(`
    WITH RECURSIVE ancestors(id, project_id, name, scope, parent_network_id, created_at, updated_at, depth) AS (
      SELECT id, project_id, name, scope, parent_network_id, created_at, updated_at, 0
        FROM networks WHERE id = ?
      UNION ALL
      SELECT n.id, n.project_id, n.name, n.scope, n.parent_network_id, n.created_at, n.updated_at, a.depth + 1
        FROM networks n
        JOIN ancestors a ON n.id = a.parent_network_id
    )
    SELECT * FROM ancestors ORDER BY depth DESC
  `).all(networkId) as (Network & { depth: number })[];

  return rows.map((r) => ({
    networkId: r.id,
    networkName: r.name,
  }));
}

export function updateNetwork(id: string, data: NetworkUpdate): Network | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();

  db.prepare(
    `UPDATE networks SET name = ?, scope = ?, parent_network_id = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.scope !== undefined ? data.scope : existing.scope,
    data.parent_network_id !== undefined ? data.parent_network_id : existing.parent_network_id,
    now,
    id,
  );

  return db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network;
}

export function deleteNetwork(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM networks WHERE id = ?').run(id);
  if (result.changes > 0) {
    deleteObjectByRef('network', id);
    return true;
  }
  return false;
}

// ── App / Project Root ──

export function getAppRootNetwork(): Network | undefined {
  const db = getDatabase();
  return db.prepare(
    `SELECT * FROM networks WHERE scope = 'app' AND parent_network_id IS NULL`,
  ).get() as Network | undefined;
}

export function ensureAppRootNetwork(): Network {
  const existing = getAppRootNetwork();
  if (existing) return existing;

  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO networks (id, project_id, name, scope, parent_network_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, null, 'App Root', 'app', null, now, now);

  createLayout({ networkId: id });
  createObject('network', 'app', null, id);

  return db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network;
}

export function getProjectRootNetwork(projectId: string): Network | undefined {
  const db = getDatabase();
  const appRoot = getAppRootNetwork();
  if (!appRoot) return undefined;

  return db.prepare(
    `SELECT * FROM networks WHERE scope = 'project' AND project_id = ? AND parent_network_id = ?`,
  ).get(projectId, appRoot.id) as Network | undefined;
}

// ── Network Full Data ──

export interface NetworkFullData {
  network: Network;
  layout: Layout | undefined;
  nodes: (NetworkNode & {
    object?: ObjectRecord;
    concept?: Concept;
    file?: FileEntity;
  })[];
  edges: (Edge & { relation_type?: RelationType })[];
  nodePositions: LayoutNodePosition[];
  edgeVisuals: LayoutEdgeVisual[];
}

type RelationTypeRow = Omit<RelationType, 'directed'> & { directed: number };

export function getNetworkFull(networkId: string): NetworkFullData | undefined {
  const db = getDatabase();
  const network = db.prepare('SELECT * FROM networks WHERE id = ?').get(networkId) as Network | undefined;
  if (!network) return undefined;

  const layout = getLayoutByNetwork(networkId);

  const nodes = db.prepare(
    `SELECT nn.*,
            o.id as o_id, o.object_type as o_object_type, o.scope as o_scope,
            o.project_id as o_project_id, o.ref_id as o_ref_id, o.created_at as o_created_at,
            c.title, c.color, c.icon, c.archetype_id, c.project_id as concept_project_id,
            c.created_at as concept_created_at, c.updated_at as concept_updated_at,
            f.id as f_id, f.project_id as f_project_id, f.path as f_path, f.type as f_type,
            f.metadata as f_metadata, f.created_at as f_created_at, f.updated_at as f_updated_at
     FROM network_nodes nn
     JOIN objects o ON nn.object_id = o.id
     LEFT JOIN concepts c ON o.object_type = 'concept' AND o.ref_id = c.id
     LEFT JOIN files f ON o.object_type = 'file' AND o.ref_id = f.id
     WHERE nn.network_id = ?`,
  ).all(networkId) as (Record<string, unknown>)[];

  const parsedNodes = nodes.map((row) => {
    const objectType = row.o_object_type as string;
    const hasConcept = objectType === 'concept' && row.title != null;
    const hasFile = objectType === 'file' && row.f_id != null;

    return {
      id: row.id as string,
      network_id: row.network_id as string,
      object_id: row.object_id as string,
      node_type: (row.node_type as string) ?? 'basic',
      parent_node_id: (row.parent_node_id as string | null) ?? null,
      metadata: (row.metadata as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      object: {
        id: row.o_id as string,
        object_type: row.o_object_type as string,
        scope: row.o_scope as string,
        project_id: (row.o_project_id as string | null) ?? null,
        ref_id: row.o_ref_id as string,
        created_at: row.o_created_at as string,
      },
      ...(hasConcept ? {
        concept: {
          id: row.o_ref_id as string,
          project_id: row.concept_project_id as string,
          archetype_id: (row.archetype_id as string | null) ?? null,
          title: row.title as string,
          color: row.color as string | null,
          icon: row.icon as string | null,
          content: null,
          agent_content: null,
          created_at: row.concept_created_at as string,
          updated_at: row.concept_updated_at as string,
        },
      } : {}),
      ...(hasFile ? {
        file: {
          id: row.f_id as string,
          project_id: row.f_project_id as string,
          path: row.f_path as string,
          type: row.f_type as string,
          metadata: (row.f_metadata as string | null) ?? null,
          created_at: row.f_created_at as string,
          updated_at: row.f_updated_at as string,
        },
      } : {}),
    };
  });

  const edgeRows = db.prepare(
    `SELECT e.*, rt.id as rt_id, rt.project_id as rt_project_id, rt.name as rt_name,
            rt.description as rt_description, rt.color as rt_color,
            rt.line_style as rt_line_style, rt.directed as rt_directed,
            rt.created_at as rt_created_at, rt.updated_at as rt_updated_at
     FROM edges e
     LEFT JOIN relation_types rt ON e.relation_type_id = rt.id
     WHERE e.network_id = ?`,
  ).all(networkId) as (Record<string, unknown>)[];

  const edges = edgeRows.map((row) => {
    const hasRelationType = row.rt_id != null;
    return {
      id: row.id as string,
      network_id: row.network_id as string,
      source_node_id: row.source_node_id as string,
      target_node_id: row.target_node_id as string,
      relation_type_id: (row.relation_type_id as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      created_at: row.created_at as string,
      ...(hasRelationType ? {
        relation_type: {
          id: row.rt_id as string,
          project_id: row.rt_project_id as string,
          name: row.rt_name as string,
          description: (row.rt_description as string | null) ?? null,
          color: (row.rt_color as string | null) ?? null,
          line_style: row.rt_line_style as string,
          directed: !!(row.rt_directed as number),
          created_at: row.rt_created_at as string,
          updated_at: row.rt_updated_at as string,
        },
      } : {}),
    };
  });

  const nodePositions = layout ? getNodePositions(layout.id) : [];
  const edgeVisuals = layout ? getEdgeVisuals(layout.id) : [];

  return { network, layout, nodes: parsedNodes, edges, nodePositions, edgeVisuals } as NetworkFullData;
}

// ── Network Node ──

export function addNetworkNode(data: NetworkNodeCreate): NetworkNode {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO network_nodes (id, network_id, object_id, node_type, parent_node_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.network_id,
    data.object_id,
    data.node_type ?? 'basic',
    data.parent_node_id ?? null,
    null,
    now, now,
  );

  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
}

export function updateNetworkNode(id: string, data: { metadata?: string | null }): NetworkNode {
  const db = getDatabase();
  const sets: string[] = [];
  const values: unknown[] = [];

  if ('metadata' in data) { sets.push('metadata = ?'); values.push(data.metadata ?? null); }

  if (sets.length === 0) {
    return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
  }

  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE network_nodes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
}

export function removeNetworkNode(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM network_nodes WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Edge ──

export function createEdge(data: EdgeCreate): Edge {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO edges (id, network_id, source_node_id, target_node_id, relation_type_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.network_id, data.source_node_id, data.target_node_id,
    data.relation_type_id ?? null, data.description ?? null,
    now,
  );

  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as Edge;
}

export function getEdge(id: string): Edge | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as Edge | undefined;
}

export function updateEdge(id: string, data: EdgeUpdate): Edge | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as Edge | undefined;
  if (!existing) return undefined;

  db.prepare('UPDATE edges SET relation_type_id = ?, description = ? WHERE id = ?').run(
    data.relation_type_id !== undefined ? data.relation_type_id : existing.relation_type_id,
    data.description !== undefined ? data.description : existing.description,
    id,
  );

  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as Edge;
}

export function deleteEdge(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM edges WHERE id = ?').run(id);
  return result.changes > 0;
}
