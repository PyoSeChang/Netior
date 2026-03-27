import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type {
  Canvas, CanvasCreate, CanvasUpdate,
  CanvasNode, CanvasNodeCreate, CanvasNodeUpdate,
  Edge, EdgeCreate,
  Concept,
  CanvasBreadcrumbItem,
} from '@moc/shared/types';

// ── Canvas ──

export function createCanvas(data: CanvasCreate): Canvas {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO canvases (id, project_id, name, concept_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, data.project_id, data.name, data.concept_id ?? null, now, now);

  return db.prepare('SELECT * FROM canvases WHERE id = ?').get(id) as Canvas;
}

export function listCanvases(projectId: string, rootOnly = false): Canvas[] {
  const db = getDatabase();
  const sql = rootOnly
    ? 'SELECT * FROM canvases WHERE project_id = ? AND concept_id IS NULL ORDER BY created_at'
    : 'SELECT * FROM canvases WHERE project_id = ? ORDER BY created_at';
  return db.prepare(sql).all(projectId) as Canvas[];
}

export function getCanvasByConceptId(conceptId: string): Canvas | undefined {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM canvases WHERE concept_id = ?')
    .get(conceptId) as Canvas | undefined;
}

export function getCanvasAncestors(canvasId: string): CanvasBreadcrumbItem[] {
  const db = getDatabase();
  const breadcrumbs: CanvasBreadcrumbItem[] = [];
  const visited = new Set<string>();
  let currentId: string | null = canvasId;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const canvas = db.prepare('SELECT * FROM canvases WHERE id = ?').get(currentId) as Canvas | undefined;
    if (!canvas) break;

    let conceptTitle: string | null = null;
    if (canvas.concept_id) {
      const concept = db.prepare('SELECT title FROM concepts WHERE id = ?').get(canvas.concept_id) as { title: string } | undefined;
      conceptTitle = concept?.title ?? null;
    }

    breadcrumbs.unshift({
      canvasId: canvas.id,
      canvasName: canvas.name,
      conceptTitle,
    });

    if (!canvas.concept_id) break;

    // Find parent canvas: which canvas contains this concept as a node?
    const parentNode = db.prepare(
      'SELECT canvas_id FROM canvas_nodes WHERE concept_id = ? LIMIT 1',
    ).get(canvas.concept_id) as { canvas_id: string } | undefined;

    currentId = parentNode?.canvas_id ?? null;
  }

  return breadcrumbs;
}

export function updateCanvas(id: string, data: CanvasUpdate): Canvas | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM canvases WHERE id = ?').get(id) as Canvas | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE canvases SET name = ?, viewport_x = ?, viewport_y = ?, viewport_zoom = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.viewport_x !== undefined ? data.viewport_x : existing.viewport_x,
    data.viewport_y !== undefined ? data.viewport_y : existing.viewport_y,
    data.viewport_zoom !== undefined ? data.viewport_zoom : existing.viewport_zoom,
    now,
    id,
  );

  return db.prepare('SELECT * FROM canvases WHERE id = ?').get(id) as Canvas;
}

export function deleteCanvas(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM canvases WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Canvas Full Data ──

export interface CanvasFullData {
  canvas: Canvas;
  nodes: (CanvasNode & { concept: Concept; has_sub_canvas: boolean })[];
  edges: Edge[];
}

export function getCanvasFull(canvasId: string): CanvasFullData | undefined {
  const db = getDatabase();
  const canvas = db.prepare('SELECT * FROM canvases WHERE id = ?').get(canvasId) as Canvas | undefined;
  if (!canvas) return undefined;

  const nodes = db.prepare(
    `SELECT cn.*, c.title, c.color, c.icon, c.archetype_id, c.project_id as concept_project_id,
            c.created_at as concept_created_at, c.updated_at as concept_updated_at,
            (EXISTS(SELECT 1 FROM canvases sub WHERE sub.concept_id = cn.concept_id)) as has_sub_canvas
     FROM canvas_nodes cn
     JOIN concepts c ON cn.concept_id = c.id
     WHERE cn.canvas_id = ?`,
  ).all(canvasId) as (Record<string, unknown>)[];

  const parsedNodes = nodes.map((row) => ({
    id: row.id as string,
    canvas_id: row.canvas_id as string,
    concept_id: row.concept_id as string,
    position_x: row.position_x as number,
    position_y: row.position_y as number,
    width: row.width as number | null,
    height: row.height as number | null,
    concept: {
      id: row.concept_id as string,
      project_id: row.concept_project_id as string,
      archetype_id: row.archetype_id as string | null ?? null,
      title: row.title as string,
      color: row.color as string | null,
      icon: row.icon as string | null,
      content: null,
      agent_content: null,
      created_at: row.concept_created_at as string,
      updated_at: row.concept_updated_at as string,
    },
    has_sub_canvas: !!(row.has_sub_canvas as number),
  }));

  const edges = db
    .prepare('SELECT * FROM edges WHERE canvas_id = ?')
    .all(canvasId) as Edge[];

  return { canvas, nodes: parsedNodes, edges };
}

// ── Canvas Node ──

export function addCanvasNode(data: CanvasNodeCreate): CanvasNode {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO canvas_nodes (id, canvas_id, concept_id, position_x, position_y, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.canvas_id, data.concept_id, data.position_x, data.position_y, data.width ?? null, data.height ?? null);

  return db.prepare('SELECT * FROM canvas_nodes WHERE id = ?').get(id) as CanvasNode;
}

export function updateCanvasNode(id: string, data: CanvasNodeUpdate): CanvasNode | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM canvas_nodes WHERE id = ?').get(id) as CanvasNode | undefined;
  if (!existing) return undefined;

  db.prepare(
    `UPDATE canvas_nodes SET position_x = ?, position_y = ?, width = ?, height = ? WHERE id = ?`,
  ).run(
    data.position_x !== undefined ? data.position_x : existing.position_x,
    data.position_y !== undefined ? data.position_y : existing.position_y,
    data.width !== undefined ? data.width : existing.width,
    data.height !== undefined ? data.height : existing.height,
    id,
  );

  return db.prepare('SELECT * FROM canvas_nodes WHERE id = ?').get(id) as CanvasNode;
}

export function removeCanvasNode(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM canvas_nodes WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Edge ──

export function createEdge(data: EdgeCreate): Edge {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO edges (id, canvas_id, source_node_id, target_node_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, data.canvas_id, data.source_node_id, data.target_node_id, now);

  return db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as Edge;
}

export function deleteEdge(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM edges WHERE id = ?').run(id);
  return result.changes > 0;
}
