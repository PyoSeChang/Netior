import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background } from './Background';
import { NodeLayer } from './NodeLayer';
import { EdgeLayer } from './EdgeLayer';
import { useCanvasStore, type CanvasNodeWithConcept } from '../../stores/canvas-store';
import { useConceptStore } from '../../stores/concept-store';
import { useUIStore } from '../../stores/ui-store';
import type { RenderNode, RenderEdge } from './types';

interface ConceptWorkspaceProps {
  projectId: string;
}

function toRenderNodes(nodes: CanvasNodeWithConcept[]): RenderNode[] {
  return nodes.map((n) => ({
    id: n.id,
    x: n.position_x,
    y: n.position_y,
    label: n.concept.title,
    icon: n.concept.icon || '📌',
    semanticType: 'concept',
    semanticTypeLabel: 'Concept',
    width: n.width ?? 160,
    height: n.height ?? 60,
  }));
}

function toRenderEdges(edges: { id: string; source_node_id: string; target_node_id: string }[]): RenderEdge[] {
  return edges.map((e) => ({
    id: e.id,
    sourceId: e.source_node_id,
    targetId: e.target_node_id,
    directed: false,
    label: '',
  }));
}

export function ConceptWorkspace({ projectId }: ConceptWorkspaceProps): JSX.Element {
  const {
    currentCanvas, nodes, edges,
    loadCanvases, openCanvas,
    addNode, updateNode, removeNode,
    removeEdge, saveViewport,
  } = useCanvasStore();
  const { createConcept } = useConceptStore();
  const { canvasMode } = useUIStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [nodeDragOffset, setNodeDragOffset] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load canvases and open first one
  useEffect(() => {
    loadCanvases(projectId).then(() => {
      const store = useCanvasStore.getState();
      if (store.canvases.length > 0 && !store.currentCanvas) {
        store.openCanvas(store.canvases[0].id);
      }
    });
  }, [projectId, loadCanvases]);

  // Restore viewport from canvas
  useEffect(() => {
    if (currentCanvas) {
      setZoom(currentCanvas.viewport_zoom);
      setPanX(currentCanvas.viewport_x);
      setPanY(currentCanvas.viewport_y);
    }
  }, [currentCanvas?.id]);

  // Container resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const renderNodes = useMemo(() => toRenderNodes(nodes), [nodes]);
  const renderEdges = useMemo(() => toRenderEdges(edges), [edges]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Delete selected nodes
      if (e.key === 'Delete' && selectedIds.size > 0) {
        e.preventDefault();
        selectedIds.forEach((id) => removeNode(id));
        setSelectedIds(new Set());
      }
      // Ctrl+A: select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(renderNodes.map((n) => n.id)));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, renderNodes, removeNode]);

  // --- Mouse interaction ---

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(5, Math.max(0.1, zoom * factor));

    // Zoom toward cursor
    const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - panY) * (newZoom / zoom);

    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [zoom, panX, panY]);

  const findNodeAt = useCallback((screenX: number, screenY: number): string | null => {
    const worldX = (screenX - panX) / zoom;
    const worldY = (screenY - panY) / zoom;

    for (let i = renderNodes.length - 1; i >= 0; i--) {
      const n = renderNodes[i];
      const w = n.width ?? 160;
      const h = n.height ?? 60;
      if (worldX >= n.x && worldX <= n.x + w && worldY >= n.y && worldY <= n.y + h) {
        return n.id;
      }
    }
    return null;
  }, [renderNodes, panX, panY, zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nodeId = findNodeAt(mx, my);

    if (nodeId) {
      // Start node drag
      setDragNodeId(nodeId);
      setDragStart({ x: e.clientX, y: e.clientY });
      setSelectedIds(new Set([nodeId]));
    } else {
      // Start pan
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, panX, panY });
    }
  }, [findNodeAt, panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanX(panStart.panX + (e.clientX - panStart.x));
      setPanY(panStart.panY + (e.clientY - panStart.y));
    } else if (dragNodeId) {
      setNodeDragOffset({
        id: dragNodeId,
        dx: e.clientX - dragStart.x,
        dy: e.clientY - dragStart.y,
      });
    }
  }, [isPanning, panStart, dragNodeId, dragStart]);

  const handleMouseUp = useCallback(async () => {
    if (isPanning) {
      setIsPanning(false);
    } else if (dragNodeId && nodeDragOffset) {
      const node = renderNodes.find((n) => n.id === dragNodeId);
      if (node) {
        await updateNode(dragNodeId, {
          position_x: node.x + nodeDragOffset.dx / zoom,
          position_y: node.y + nodeDragOffset.dy / zoom,
        });
      }
      setNodeDragOffset(null);
      setDragNodeId(null);
    } else if (dragNodeId) {
      // Click without drag
      setDragNodeId(null);
    }
  }, [isPanning, dragNodeId, nodeDragOffset, renderNodes, zoom, updateNode]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setSelectedIds(new Set());
    }
  }, []);

  const handleContextMenu = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentCanvas) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nodeId = findNodeAt(mx, my);

    if (nodeId) {
      // Right-click node → delete
      await removeNode(nodeId);
    } else {
      // Right-click canvas → create concept
      const worldX = (mx - panX) / zoom;
      const worldY = (my - panY) / zoom;

      const concept = await createConcept({
        project_id: projectId,
        title: 'New Concept',
      });

      await addNode({
        canvas_id: currentCanvas.id,
        concept_id: concept.id,
        position_x: worldX,
        position_y: worldY,
      });
    }
  }, [currentCanvas, findNodeAt, panX, panY, zoom, projectId, createConcept, addNode, removeNode]);

  // Save viewport on change (debounced)
  useEffect(() => {
    if (!currentCanvas) return;
    const timer = setTimeout(() => {
      saveViewport({ viewport_x: panX, viewport_y: panY, viewport_zoom: zoom });
    }, 500);
    return () => clearTimeout(timer);
  }, [panX, panY, zoom, currentCanvas, saveViewport]);

  if (!currentCanvas) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        No canvas selected
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-surface-base"
      style={{ cursor: isPanning ? 'grabbing' : dragNodeId ? 'move' : 'default' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      onContextMenu={handleContextMenu}
    >
      <Background
        width={containerSize.width}
        height={containerSize.height}
        zoom={zoom}
        panX={panX}
        panY={panY}
      />

      <EdgeLayer
        edges={renderEdges}
        nodes={renderNodes}
        zoom={zoom}
        panX={panX}
        panY={panY}
        nodeDragOffset={nodeDragOffset}
      />

      <NodeLayer
        nodes={renderNodes}
        selectedIds={selectedIds}
        mode={canvasMode}
        zoom={zoom}
        panX={panX}
        panY={panY}
        nodeDragOffset={nodeDragOffset}
        onNodeClick={(id, e) => {
          setSelectedIds(new Set([id]));
        }}
        onNodeDoubleClick={() => {}}
        onNodeDragStart={() => {}}
      />
    </div>
  );
}
