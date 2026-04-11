import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { EdgeVisual, Layout, NodePosition } from '@netior/shared/types';

export type { Layout };
export type LayoutNodePosition = NodePosition;
export type LayoutEdgeVisual = EdgeVisual;

// ── Layout CRUD ──

export function createLayout(data: {
  networkId?: string;
  contextId?: string;
  layoutType?: string;
}): Layout {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO layouts (id, layout_type, network_id, context_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.layoutType ?? 'freeform',
    data.networkId ?? null,
    data.contextId ?? null,
    now, now,
  );

  return db.prepare('SELECT * FROM layouts WHERE id = ?').get(id) as Layout;
}

export function getLayoutByNetwork(networkId: string): Layout | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM layouts WHERE network_id = ?').get(networkId) as Layout | undefined;
}

export function updateLayout(
  id: string,
  data: { layout_type?: string; layout_config_json?: string | null; viewport_json?: string | null },
): Layout | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM layouts WHERE id = ?').get(id) as Layout | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE layouts SET layout_type = ?, layout_config_json = ?, viewport_json = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.layout_type !== undefined ? data.layout_type : existing.layout_type,
    data.layout_config_json !== undefined ? data.layout_config_json : existing.layout_config_json,
    data.viewport_json !== undefined ? data.viewport_json : existing.viewport_json,
    now, id,
  );

  return db.prepare('SELECT * FROM layouts WHERE id = ?').get(id) as Layout;
}

export function deleteLayout(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM layouts WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Layout Nodes (position data) ──

export function setNodePosition(layoutId: string, nodeId: string, positionJson: string): void {
  const db = getDatabase();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO layout_nodes (id, layout_id, node_id, position_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(layout_id, node_id) DO UPDATE SET position_json = excluded.position_json`,
  ).run(id, layoutId, nodeId, positionJson);
}

export function getNodePositions(layoutId: string): LayoutNodePosition[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT node_id, position_json FROM layout_nodes WHERE layout_id = ?',
  ).all(layoutId) as { node_id: string; position_json: string }[];
  return rows.map((r) => ({ nodeId: r.node_id, positionJson: r.position_json }));
}

export function removeNodePosition(layoutId: string, nodeId: string): boolean {
  const db = getDatabase();
  const result = db.prepare(
    'DELETE FROM layout_nodes WHERE layout_id = ? AND node_id = ?',
  ).run(layoutId, nodeId);
  return result.changes > 0;
}

// ── Layout Edges (visual data) ──

export function setEdgeVisual(layoutId: string, edgeId: string, visualJson: string): void {
  const db = getDatabase();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO layout_edges (id, layout_id, edge_id, visual_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(layout_id, edge_id) DO UPDATE SET visual_json = excluded.visual_json`,
  ).run(id, layoutId, edgeId, visualJson);
}

export function getEdgeVisuals(layoutId: string): LayoutEdgeVisual[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT edge_id, visual_json FROM layout_edges WHERE layout_id = ?',
  ).all(layoutId) as { edge_id: string; visual_json: string }[];
  return rows.map((r) => ({ edgeId: r.edge_id, visualJson: r.visual_json }));
}

export function removeEdgeVisual(layoutId: string, edgeId: string): boolean {
  const db = getDatabase();
  const result = db.prepare(
    'DELETE FROM layout_edges WHERE layout_id = ? AND edge_id = ?',
  ).run(layoutId, edgeId);
  return result.changes > 0;
}
