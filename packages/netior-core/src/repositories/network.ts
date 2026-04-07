import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type {
  Network, NetworkCreate, NetworkUpdate,
  NetworkNode, NetworkNodeCreate, NetworkNodeUpdate,
  Edge, EdgeCreate, EdgeUpdate,
  Concept,
  FileEntity,
  RelationType,
  NetworkBreadcrumbItem,
} from '@netior/shared/types';

// ── Network ──

/** Parse layout_config JSON from DB row */
function parseNetworkRow(row: Record<string, unknown>): Network {
  return {
    ...row,
    layout_config: row.layout_config ? JSON.parse(row.layout_config as string) : null,
  } as Network;
}

export function createNetwork(data: NetworkCreate): Network {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO networks (id, project_id, name, concept_id, layout, layout_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.project_id, data.name,
    data.concept_id ?? null,
    data.layout ?? 'freeform',
    data.layout_config ? JSON.stringify(data.layout_config) : null,
    now, now,
  );

  const row = db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Record<string, unknown>;
  return parseNetworkRow(row);
}

export function listNetworks(projectId: string, rootOnly = false): Network[] {
  const db = getDatabase();
  const sql = rootOnly
    ? 'SELECT * FROM networks WHERE project_id = ? AND concept_id IS NULL ORDER BY created_at'
    : 'SELECT * FROM networks WHERE project_id = ? ORDER BY created_at';
  const rows = db.prepare(sql).all(projectId) as Record<string, unknown>[];
  return rows.map(parseNetworkRow);
}

export interface NetworkTreeNode {
  network: Network;
  conceptTitle: string | null;
  children: NetworkTreeNode[];
}

export function getNetworkTree(projectId: string): NetworkTreeNode[] {
  const db = getDatabase();

  // All networks for this project
  const allNetworks = (db.prepare('SELECT * FROM networks WHERE project_id = ? ORDER BY created_at')
    .all(projectId) as Record<string, unknown>[]).map(parseNetworkRow);

  // All network_nodes: which concept is placed in which network
  const nodeRows = db.prepare(
    `SELECT nn.network_id, nn.concept_id, c.title as concept_title
     FROM network_nodes nn
     JOIN concepts c ON nn.concept_id = c.id
     WHERE nn.concept_id IS NOT NULL
       AND nn.network_id IN (SELECT id FROM networks WHERE project_id = ?)`,
  ).all(projectId) as { network_id: string; concept_id: string; concept_title: string }[];

  // Map: concept_id → which network it's placed in (parent network)
  const conceptToParentNetwork = new Map<string, string>();
  const conceptTitles = new Map<string, string>();
  for (const row of nodeRows) {
    conceptToParentNetwork.set(row.concept_id, row.network_id);
    conceptTitles.set(row.concept_id, row.concept_title);
  }

  // Map: network_id → Network
  const networkMap = new Map(allNetworks.map((n) => [n.id, n]));

  // Group networks by their parent network
  // A network's parent = the network that contains its concept_id as a node
  const childrenOf = new Map<string, NetworkTreeNode[]>(); // parent_network_id → children
  const roots: NetworkTreeNode[] = [];

  for (const network of allNetworks) {
    const node: NetworkTreeNode = {
      network,
      conceptTitle: network.concept_id ? (conceptTitles.get(network.concept_id) ?? null) : null,
      children: [],
    };

    if (!network.concept_id) {
      // Root network
      roots.push(node);
    } else {
      const parentNetworkId = conceptToParentNetwork.get(network.concept_id);
      if (parentNetworkId) {
        const siblings = childrenOf.get(parentNetworkId) ?? [];
        siblings.push(node);
        childrenOf.set(parentNetworkId, siblings);
      } else {
        // Concept exists but isn't placed on any network — treat as orphan root
        roots.push(node);
      }
    }
  }

  // Recursively attach children
  function attachChildren(nodes: NetworkTreeNode[]): void {
    for (const node of nodes) {
      node.children = childrenOf.get(node.network.id) ?? [];
      attachChildren(node.children);
    }
  }
  attachChildren(roots);

  return roots;
}

export function getNetworksByConceptId(conceptId: string): Network[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM networks WHERE concept_id = ? ORDER BY created_at')
    .all(conceptId) as Record<string, unknown>[];
  return rows.map(parseNetworkRow);
}

export function getNetworkAncestors(networkId: string): NetworkBreadcrumbItem[] {
  const db = getDatabase();
  const breadcrumbs: NetworkBreadcrumbItem[] = [];
  const visited = new Set<string>();
  let currentId: string | null = networkId;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const networkRow = db.prepare('SELECT * FROM networks WHERE id = ?').get(currentId) as Record<string, unknown> | undefined;
    if (!networkRow) break;
    const network = parseNetworkRow(networkRow);

    let conceptTitle: string | null = null;
    if (network.concept_id) {
      const concept = db.prepare('SELECT title FROM concepts WHERE id = ?').get(network.concept_id) as { title: string } | undefined;
      conceptTitle = concept?.title ?? null;
    }

    breadcrumbs.unshift({
      networkId: network.id,
      networkName: network.name,
      conceptTitle,
    });

    if (!network.concept_id) break;

    // Find parent network: which network contains this concept as a node?
    const parentNode = db.prepare(
      'SELECT network_id FROM network_nodes WHERE concept_id = ? LIMIT 1',
    ).get(network.concept_id) as { network_id: string } | undefined;

    currentId = parentNode?.network_id ?? null;
  }

  return breadcrumbs;
}

export function updateNetwork(id: string, data: NetworkUpdate): Network | undefined {
  const db = getDatabase();
  const existingRow = db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existingRow) return undefined;
  const existing = parseNetworkRow(existingRow);

  const now = new Date().toISOString();
  const newLayoutConfig = data.layout_config !== undefined
    ? (data.layout_config ? JSON.stringify(data.layout_config) : null)
    : (existingRow.layout_config as string | null);

  db.prepare(
    `UPDATE networks SET name = ?, layout = ?, layout_config = ?, viewport_x = ?, viewport_y = ?, viewport_zoom = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.layout !== undefined ? data.layout : existing.layout,
    newLayoutConfig,
    data.viewport_x !== undefined ? data.viewport_x : existing.viewport_x,
    data.viewport_y !== undefined ? data.viewport_y : existing.viewport_y,
    data.viewport_zoom !== undefined ? data.viewport_zoom : existing.viewport_zoom,
    now,
    id,
  );

  const row = db.prepare('SELECT * FROM networks WHERE id = ?').get(id) as Record<string, unknown>;
  return parseNetworkRow(row);
}

export function deleteNetwork(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM networks WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Network Full Data ──

export interface NetworkFullData {
  network: Network;
  nodes: (NetworkNode & { concept?: Concept; file?: FileEntity; network_count: number })[];
  edges: (Edge & { relation_type?: RelationType })[];
}

type RelationTypeRow = Omit<RelationType, 'directed'> & { directed: number };

export function getNetworkFull(networkId: string): NetworkFullData | undefined {
  const db = getDatabase();
  const networkRow = db.prepare('SELECT * FROM networks WHERE id = ?').get(networkId) as Record<string, unknown> | undefined;
  if (!networkRow) return undefined;
  const network = parseNetworkRow(networkRow);

  const nodes = db.prepare(
    `SELECT nn.*, c.title, c.color, c.icon, c.archetype_id, c.project_id as concept_project_id,
            c.created_at as concept_created_at, c.updated_at as concept_updated_at,
            f.id as f_id, f.project_id as f_project_id, f.path as f_path, f.type as f_type,
            f.metadata as f_metadata, f.created_at as f_created_at, f.updated_at as f_updated_at,
            (SELECT COUNT(*) FROM networks sub WHERE sub.concept_id = nn.concept_id) as network_count
     FROM network_nodes nn
     LEFT JOIN concepts c ON nn.concept_id = c.id
     LEFT JOIN files f ON nn.file_id = f.id
     WHERE nn.network_id = ?`,
  ).all(networkId) as (Record<string, unknown>)[];

  const parsedNodes = nodes.map((row) => {
    const hasConcept = row.concept_id != null && row.title != null;
    const hasFile = row.f_id != null;
    return {
      id: row.id as string,
      network_id: row.network_id as string,
      concept_id: (row.concept_id as string | null) ?? null,
      file_id: (row.file_id as string | null) ?? null,
      metadata: (row.metadata as string | null) ?? null,
      position_x: row.position_x as number,
      position_y: row.position_y as number,
      width: row.width as number | null,
      height: row.height as number | null,
      ...(hasConcept ? {
        concept: {
          id: row.concept_id as string,
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
      network_count: (row.network_count as number) ?? 0,
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
      color: (row.color as string | null) ?? null,
      line_style: (row.line_style as string | null) ?? null,
      directed: row.directed != null ? (row.directed as number) : null,
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

  return { network, nodes: parsedNodes, edges } as NetworkFullData;
}

// ── Network Node ──

export function addNetworkNode(data: NetworkNodeCreate): NetworkNode {
  const db = getDatabase();
  const id = randomUUID();

  // Validate: exactly one of concept_id, file_id must be set
  const setCount = [data.concept_id, data.file_id].filter(Boolean).length;
  if (setCount !== 1) {
    throw new Error('Exactly one of concept_id or file_id must be provided');
  }

  db.prepare(
    `INSERT INTO network_nodes (id, network_id, concept_id, file_id, metadata, position_x, position_y, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.network_id,
    data.concept_id ?? null, data.file_id ?? null, data.metadata ?? null,
    data.position_x, data.position_y, data.width ?? null, data.height ?? null,
  );

  return db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode;
}

export function updateNetworkNode(id: string, data: NetworkNodeUpdate): NetworkNode | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM network_nodes WHERE id = ?').get(id) as NetworkNode | undefined;
  if (!existing) return undefined;

  db.prepare(
    `UPDATE network_nodes SET position_x = ?, position_y = ?, width = ?, height = ?, metadata = ? WHERE id = ?`,
  ).run(
    data.position_x !== undefined ? data.position_x : existing.position_x,
    data.position_y !== undefined ? data.position_y : existing.position_y,
    data.width !== undefined ? data.width : existing.width,
    data.height !== undefined ? data.height : existing.height,
    data.metadata !== undefined ? data.metadata : existing.metadata,
    id,
  );

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
    `INSERT INTO edges (id, network_id, source_node_id, target_node_id, relation_type_id, description, color, line_style, directed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.network_id, data.source_node_id, data.target_node_id,
    data.relation_type_id ?? null, data.description ?? null,
    data.color ?? null, data.line_style ?? null, data.directed != null ? (data.directed ? 1 : 0) : null,
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

  db.prepare('UPDATE edges SET relation_type_id = ?, description = ?, color = ?, line_style = ?, directed = ? WHERE id = ?').run(
    data.relation_type_id !== undefined ? data.relation_type_id : existing.relation_type_id,
    data.description !== undefined ? data.description : existing.description,
    data.color !== undefined ? data.color : existing.color,
    data.line_style !== undefined ? data.line_style : existing.line_style,
    data.directed !== undefined ? (data.directed != null ? (data.directed ? 1 : 0) : null) : existing.directed,
    id,
  );

  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as Edge;
}

export function deleteEdge(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM edges WHERE id = ?').run(id);
  return result.changes > 0;
}
