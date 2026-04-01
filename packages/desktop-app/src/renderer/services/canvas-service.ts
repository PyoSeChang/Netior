import type {
  Canvas, CanvasCreate, CanvasUpdate,
  CanvasNode, CanvasNodeCreate, CanvasNodeUpdate,
  Edge, EdgeCreate, EdgeUpdate,
  Concept, RelationType, CanvasBreadcrumbItem,
  CanvasTreeNode,
} from '@netior/shared/types';

export interface CanvasFullData {
  canvas: Canvas;
  nodes: (CanvasNode & { concept?: Concept; canvas_count: number })[];
  edges: (Edge & { relation_type?: RelationType })[];
}
import { unwrapIpc } from './ipc';

// Canvas
export async function createCanvas(data: CanvasCreate): Promise<Canvas> {
  return unwrapIpc(await window.electron.canvas.create(data as unknown as Record<string, unknown>));
}

export async function listCanvases(projectId: string, rootOnly?: boolean): Promise<Canvas[]> {
  return unwrapIpc(await window.electron.canvas.list(projectId, rootOnly));
}

export async function updateCanvas(id: string, data: CanvasUpdate): Promise<Canvas> {
  return unwrapIpc(await window.electron.canvas.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteCanvas(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.canvas.delete(id));
}

export async function getCanvasFull(canvasId: string): Promise<CanvasFullData | undefined> {
  return unwrapIpc(await window.electron.canvas.getFull(canvasId));
}

export async function getCanvasesByConcept(conceptId: string): Promise<Canvas[]> {
  return unwrapIpc(await window.electron.canvas.getByConcept(conceptId));
}

export async function getCanvasAncestors(canvasId: string): Promise<CanvasBreadcrumbItem[]> {
  return unwrapIpc(await window.electron.canvas.getAncestors(canvasId));
}

export async function getCanvasTree(projectId: string): Promise<CanvasTreeNode[]> {
  return unwrapIpc(await window.electron.canvas.getTree(projectId));
}

// Canvas Node
export async function addCanvasNode(data: CanvasNodeCreate): Promise<CanvasNode> {
  return unwrapIpc(await window.electron.canvasNode.add(data as unknown as Record<string, unknown>));
}

export async function updateCanvasNode(id: string, data: CanvasNodeUpdate): Promise<CanvasNode> {
  return unwrapIpc(await window.electron.canvasNode.update(id, data as unknown as Record<string, unknown>));
}

export async function removeCanvasNode(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.canvasNode.remove(id));
}

// Edge
export async function createEdge(data: EdgeCreate): Promise<Edge> {
  return unwrapIpc(await window.electron.edge.create(data as unknown as Record<string, unknown>));
}

export async function getEdge(id: string): Promise<Edge | undefined> {
  return unwrapIpc(await window.electron.edge.get(id));
}

export async function updateEdge(id: string, data: EdgeUpdate): Promise<Edge> {
  return unwrapIpc(await window.electron.edge.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteEdge(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.edge.delete(id));
}

export const canvasService = {
  create: createCanvas, list: listCanvases, update: updateCanvas,
  delete: deleteCanvas, getFull: getCanvasFull,
  getCanvasesByConcept, getAncestors: getCanvasAncestors, getTree: getCanvasTree,
  node: { add: addCanvasNode, update: updateCanvasNode, remove: removeCanvasNode },
  edge: { create: createEdge, get: getEdge, update: updateEdge, delete: deleteEdge },
};
