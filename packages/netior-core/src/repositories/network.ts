import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createLayout, getLayoutByNetwork, getNodePositions, getEdgeVisuals } from './layout';
import { createObject, deleteObjectByRef } from './objects';
import {
  ensureProjectOntologyNetworkForDb,
  ensureUniverseNetworkForDb,
  getProjectOntologyNetworkForDb,
  getUniverseNetworkForDb,
} from './system-networks';
import type {
  Network, NetworkCreate, NetworkUpdate,
  NetworkNode, NetworkNodeCreate, NetworkNodeUpdate,
  Edge, EdgeCreate, EdgeUpdate,
  ObjectRecord,
  Concept,
  FileEntity,
  Model,
  EdgeLineStyle,
  NetworkBreadcrumbItem,
  NetworkFullData,
  ModelRefKey,
  SemanticCategoryRefKey,
  SemanticMeaningKey,
  MeaningSlotKey,
  ModelTargetKind,
} from '@netior/shared/types';

// ── Network ──

export function createNetwork(data: NetworkCreate): Network {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const scope = data.scope ?? 'project';
  const kind = data.kind ?? 'network';
  if (kind !== 'network') {
    throw new Error('System networks must be created through the system network repository');
  }

  db.prepare(
    `INSERT INTO networks (id, project_id, name, scope, kind, parent_network_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.project_id, data.name,
    scope,
    kind,
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
  const orderBy = `ORDER BY CASE kind WHEN 'ontology' THEN 0 ELSE 1 END, created_at`;
  const sql = rootOnly
    ? `SELECT * FROM networks WHERE project_id = ? AND parent_network_id IS NULL ${orderBy}`
    : `SELECT * FROM networks WHERE project_id = ? ${orderBy}`;
  return db.prepare(sql).all(projectId) as Network[];
}

export interface NetworkTreeNode {
  network: Network;
  children: NetworkTreeNode[];
}

export function getNetworkTree(projectId: string): NetworkTreeNode[] {
  const db = getDatabase();

  const allNetworks = db.prepare(
    `SELECT * FROM networks
      WHERE project_id = ?
      ORDER BY CASE kind WHEN 'ontology' THEN 0 ELSE 1 END, created_at`,
  ).all(projectId) as Network[];
  const networkIds = new Set(allNetworks.map((network) => network.id));

  // Group by parent_network_id
  const childrenOf = new Map<string, NetworkTreeNode[]>();
  const roots: NetworkTreeNode[] = [];

  for (const network of allNetworks) {
    const node: NetworkTreeNode = { network, children: [] };

    if (!network.parent_network_id || !networkIds.has(network.parent_network_id)) {
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
    WITH RECURSIVE ancestors(id, project_id, name, scope, kind, parent_network_id, created_at, updated_at, depth) AS (
      SELECT id, project_id, name, scope, kind, parent_network_id, created_at, updated_at, 0
        FROM networks WHERE id = ?
      UNION ALL
      SELECT n.id, n.project_id, n.name, n.scope, n.kind, n.parent_network_id, n.created_at, n.updated_at, a.depth + 1
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

  if (existing.kind === 'universe' || existing.kind === 'ontology') {
    const nameChanged = data.name !== undefined && data.name !== existing.name;
    const scopeChanged = data.scope !== undefined && data.scope !== existing.scope;
    const parentChanged = data.parent_network_id !== undefined && data.parent_network_id !== existing.parent_network_id;
    if (nameChanged || scopeChanged || parentChanged) {
      throw new Error(`${existing.name} is a system network and cannot be edited`);
    }
    return existing;
  }

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
  const existing = db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Network | undefined;
  if (!existing) return false;
  if (existing.kind === 'universe' || existing.kind === 'ontology') {
    throw new Error(`${existing.name} is a system network and cannot be deleted`);
  }
  const result = db.prepare('DELETE FROM networks WHERE id = ?').run(id);
  if (result.changes > 0) {
    deleteObjectByRef('network', id);
    return true;
  }
  return false;
}

// ── System Networks ──

export function getUniverseNetwork(): Network | undefined {
  return getUniverseNetworkForDb(getDatabase());
}

export function ensureUniverseNetwork(): Network {
  return ensureUniverseNetworkForDb(getDatabase());
}

export function getProjectOntologyNetwork(projectId: string): Network | undefined {
  return getProjectOntologyNetworkForDb(getDatabase(), projectId);
}

export function ensureProjectOntologyNetwork(projectId: string): Network {
  return ensureProjectOntologyNetworkForDb(getDatabase(), projectId);
}

// ── Network Full Data ──

type ModelRow = Omit<Model, 'meaning_keys' | 'core_slots' | 'optional_slots' | 'recipe' | 'built_in' | 'directed'> & {
  meaning_keys: string | null;
  core_slots: string | null;
  optional_slots: string | null;
  recipe_json: string | null;
  built_in: number;
  directed: number | null;
};
type EdgeRow = Edge;

function parseStringArray<T extends string>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is T => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseModelRecipe(raw: string | null | undefined): Model['recipe'] {
  if (!raw) return { meanings: [], rules: [] };
  try {
    const parsed = JSON.parse(raw) as Model['recipe'];
    return {
      meanings: Array.isArray(parsed.meanings) ? parsed.meanings : [],
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    };
  } catch {
    return { meanings: [], rules: [] };
  }
}

function toModel(row: ModelRow): Model {
  return {
    ...row,
    key: row.key as ModelRefKey,
    category: row.category as SemanticCategoryRefKey,
    target_kind: (row.target_kind ?? 'object') as ModelTargetKind,
    meaning_keys: parseStringArray<SemanticMeaningKey>(row.meaning_keys),
    core_slots: parseStringArray<MeaningSlotKey>(row.core_slots),
    optional_slots: parseStringArray<MeaningSlotKey>(row.optional_slots),
    recipe: parseModelRecipe(row.recipe_json),
    line_style: (row.line_style ?? null) as EdgeLineStyle | null,
    directed: row.directed == null ? null : !!row.directed,
    built_in: !!row.built_in,
  };
}

export function getNetworkFull(networkId: string): NetworkFullData | undefined {
  const db = getDatabase();
  const network = db.prepare('SELECT * FROM networks WHERE id = ?').get(networkId) as Network | undefined;
  if (!network) return undefined;

  const layout = getLayoutByNetwork(networkId);

  const nodes = db.prepare(
    `SELECT nn.*,
            o.id as o_id, o.object_type as o_object_type, o.scope as o_scope,
            o.project_id as o_project_id, o.ref_id as o_ref_id, o.created_at as o_created_at,
            c.title, c.color, c.icon, c.schema_id, c.project_id as concept_project_id,
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
      node_type: ((row.node_type as string) === 'box' ? 'group' : ((row.node_type as string) ?? 'basic')),
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
          schema_id: (row.schema_id as string | null) ?? null,
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
    `SELECT e.*,
            m.id as m_id, m.project_id as m_project_id, m.key as m_key, m.name as m_name,
            m.description as m_description, m.category as m_category, m.target_kind as m_target_kind,
            m.meaning_keys as m_meaning_keys, m.core_slots as m_core_slots,
            m.optional_slots as m_optional_slots, m.recipe_json as m_recipe_json,
            m.color as m_color, m.icon as m_icon, m.line_style as m_line_style,
            m.directed as m_directed, m.built_in as m_built_in,
            m.created_at as m_created_at, m.updated_at as m_updated_at
     FROM edges e
     LEFT JOIN models m ON e.model_id = m.id
     WHERE e.network_id = ?`,
  ).all(networkId) as (Record<string, unknown>)[];

  const edges = edgeRows.map((row) => {
    const hasModel = row.m_id != null;
    return {
      id: row.id as string,
      network_id: row.network_id as string,
      source_node_id: row.source_node_id as string,
      target_node_id: row.target_node_id as string,
      model_id: (row.model_id as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      created_at: row.created_at as string,
      ...(hasModel ? {
        model: toModel({
          id: row.m_id as string,
          project_id: row.m_project_id as string,
          key: row.m_key as string,
          name: row.m_name as string,
          description: (row.m_description as string | null) ?? null,
          category: row.m_category as string,
          target_kind: ((row.m_target_kind as string | null) ?? 'object') as ModelTargetKind,
          meaning_keys: (row.m_meaning_keys as string | null) ?? null,
          core_slots: (row.m_core_slots as string | null) ?? null,
          optional_slots: (row.m_optional_slots as string | null) ?? null,
          recipe_json: (row.m_recipe_json as string | null) ?? null,
          color: (row.m_color as string | null) ?? null,
          icon: (row.m_icon as string | null) ?? null,
          line_style: ((row.m_line_style as string | null) ?? null) as EdgeLineStyle | null,
          directed: (row.m_directed as number | null) ?? null,
          built_in: (row.m_built_in as number | null) ?? 0,
          created_at: row.m_created_at as string,
          updated_at: row.m_updated_at as string,
        }),
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
    data.metadata ?? null,
    now, now,
  );

  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
}

export function getNetworkNode(id: string): NetworkNode | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode | undefined;
}

export function updateNetworkNode(id: string, data: NetworkNodeUpdate): NetworkNode {
  const db = getDatabase();
  const sets: string[] = [];
  const values: unknown[] = [];

  if ('node_type' in data) { sets.push('node_type = ?'); values.push(data.node_type); }
  if ('parent_node_id' in data) { sets.push('parent_node_id = ?'); values.push(data.parent_node_id ?? null); }
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
    `INSERT INTO edges (id, network_id, source_node_id, target_node_id, model_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.network_id, data.source_node_id, data.target_node_id,
    data.model_id ?? null, data.description ?? null,
    now,
  );

  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as EdgeRow;
}

export function getEdge(id: string): Edge | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as EdgeRow | undefined;
}

export function updateEdge(id: string, data: EdgeUpdate): Edge | undefined {
  const db = getDatabase();
  const existingRow = db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as EdgeRow | undefined;
  if (!existingRow) return undefined;

  db.prepare('UPDATE edges SET model_id = ?, description = ? WHERE id = ?').run(
    data.model_id !== undefined ? data.model_id : existingRow.model_id,
    data.description !== undefined ? data.description : existingRow.description,
    id,
  );

  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as EdgeRow;
}

export function deleteEdge(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM edges WHERE id = ?').run(id);
  return result.changes > 0;
}
