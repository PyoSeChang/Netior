import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background } from './Background';
import { NodeLayer } from './NodeLayer';
import { EdgeLayer } from './EdgeLayer';
import { NodeContextMenu } from './NodeContextMenu';
import { CanvasContextMenu } from './CanvasContextMenu';
import { CanvasControls } from './CanvasControls';
import { ConceptCreateModal } from './ConceptCreateModal';
import { useInteraction } from './InteractionLayer';
import { useCanvasStore, type CanvasNodeWithConcept } from '../../stores/canvas-store';
import { useConceptStore } from '../../stores/concept-store';
import { useEditorStore } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import type { Archetype } from '@moc/shared/types';
import type { RenderNode, RenderEdge } from './types';

interface ConceptWorkspaceProps {
  projectId: string;
}

function toRenderNodes(nodes: CanvasNodeWithConcept[], archetypes: Archetype[]): RenderNode[] {
  const archMap = new Map(archetypes.map((a) => [a.id, a]));
  return nodes.map((n) => {
    const arch = n.concept.archetype_id ? archMap.get(n.concept.archetype_id) : undefined;
    return {
      id: n.id,
      x: n.position_x,
      y: n.position_y,
      label: n.concept.title,
      icon: n.concept.icon || arch?.icon || '📌',
      shape: arch?.node_shape ?? undefined,
      semanticType: arch?.name || 'concept',
      semanticTypeLabel: arch?.name || 'Concept',
      width: n.width ?? 160,
      height: n.height ?? 60,
      conceptId: n.concept_id,
      hasSubCanvas: n.has_sub_canvas,
    };
  });
}

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  conceptId: string;
  hasSubCanvas: boolean;
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createPosition, setCreatePosition] = useState({ x: 0, y: 0 });

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

  // Container resize observer — shift viewport center when canvas resizes
  const prevSizeRef = useRef<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const prev = prevSizeRef.current;
      if (prev) {
        const dx = width - prev.width;
        const dy = height - prev.height;
        if (dx !== 0 || dy !== 0) {
          setPanX((p) => p + dx / 2);
          setPanY((p) => p + dy / 2);
        }
      }
      prevSizeRef.current = { width, height };
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const archetypes = useArchetypeStore((s) => s.archetypes);
  const renderNodes = useMemo(() => toRenderNodes(nodes, archetypes), [nodes, archetypes]);
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

  // --- Mouse interaction (via useInteraction, same pattern as Culturium) ---

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(5, Math.max(0.1, zoom * factor));

    const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - panY) * (newZoom / zoom);

    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [zoom, panX, panY]);

  const handleNodeDragEnd = useCallback(async (nodeId: string, x: number, y: number) => {
    await updateNode(nodeId, { position_x: x, position_y: y });
  }, [updateNode]);

  const handlePanChange = useCallback((newPanX: number, newPanY: number) => {
    setPanX(newPanX);
    setPanY(newPanY);
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedIds(new Set());
    setContextMenu(null);
    setCanvasContextMenu(null);
  }, []);

  const handleSelectionBox = useCallback((nodeIds: string[]) => {
    setSelectedIds(new Set(nodeIds));
  }, []);

  const { dragState, nodeDragOffset, handleCanvasMouseDown, handleNodeDragStart } = useInteraction({
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    nodes: renderNodes,
    zoom,
    panX,
    panY,
    mode: canvasMode,
    renderingMode: 'canvas',
    onPanChange: handlePanChange,
    onNodeDragEnd: handleNodeDragEnd,
    onSelectionBox: handleSelectionBox,
    onCanvasClick: handleCanvasClick,
    onWheel: handleWheel,
  });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentCanvas) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Node right-clicks are handled by NodeLayer's onContextMenu (stopPropagation).
    // This handler only fires for blank canvas right-clicks.
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = (mx - panX) / zoom;
    const worldY = (my - panY) / zoom;
    setCanvasContextMenu({ x: e.clientX, y: e.clientY, worldX, worldY });
  }, [currentCanvas, panX, panY, zoom]);

  // Save viewport on change (debounced)
  useEffect(() => {
    if (!currentCanvas) return;
    const timer = setTimeout(() => {
      saveViewport({ viewport_x: panX, viewport_y: panY, viewport_zoom: zoom });
    }, 500);
    return () => clearTimeout(timer);
  }, [panX, panY, zoom, currentCanvas, saveViewport]);

  const fitToScreen = useCallback(() => {
    if (renderNodes.length === 0 || !containerSize.width) return;
    const padding = 80;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of renderNodes) {
      const w = n.width ?? 160;
      const h = n.height ?? 60;
      minX = Math.min(minX, n.x - w / 2);
      minY = Math.min(minY, n.y - h / 2);
      maxX = Math.max(maxX, n.x + w / 2);
      maxY = Math.max(maxY, n.y + h / 2);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) return;
    const scaleX = (containerSize.width - padding * 2) / contentW;
    const scaleY = (containerSize.height - padding * 2) / contentH;
    const newZoom = Math.min(scaleX, scaleY, 2);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setZoom(newZoom);
    setPanX(containerSize.width / 2 - centerX * newZoom);
    setPanY(containerSize.height / 2 - centerY * newZoom);
  }, [renderNodes, containerSize]);

  const canvasHistory = useCanvasStore((s) => s.canvasHistory);
  const navigateBack = useCanvasStore((s) => s.navigateBack);
  const toggleMode = useCallback(() => {
    useUIStore.getState().setCanvasMode(canvasMode === 'browse' ? 'edit' : 'browse');
  }, [canvasMode]);

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
      style={{ cursor: dragState.type === 'pan' ? 'grabbing' : dragState.type === 'node' ? 'move' : 'default' }}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={handleContextMenu}
    >
      <CanvasControls
        mode={canvasMode}
        zoom={zoom}
        canGoBack={canvasHistory.length > 0}
        canGoForward={false}
        onToggleMode={toggleMode}
        onZoomIn={() => setZoom((z) => Math.min(5, z * 1.2))}
        onZoomOut={() => setZoom((z) => Math.max(0.1, z / 1.2))}
        onFitToScreen={fitToScreen}
        onNavigateBack={() => navigateBack()}
        onNavigateForward={() => {}}
      />

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
        onNodeClick={(id) => {
          setSelectedIds(new Set([id]));
        }}
        onNodeDoubleClick={(id) => {
          const node = nodes.find((n) => n.id === id);
          if (node) {
            useEditorStore.getState().openTab({
              type: 'concept',
              targetId: node.concept_id,
              title: node.concept.title,
            });
          }
        }}
        onNodeDragStart={handleNodeDragStart}
        onContextMenu={(type, x, y, targetId) => {
          if (type === 'node' && targetId) {
            const node = nodes.find((n) => n.id === targetId);
            if (node) {
              setContextMenu({
                x,
                y,
                nodeId: targetId,
                conceptId: node.concept_id,
                hasSubCanvas: node.has_sub_canvas,
              });
            }
          }
        }}
      />

      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          conceptId={contextMenu.conceptId}
          hasSubCanvas={contextMenu.hasSubCanvas}
          onClose={() => setContextMenu(null)}
        />
      )}

      {canvasContextMenu && (
        <CanvasContextMenu
          x={canvasContextMenu.x}
          y={canvasContextMenu.y}
          onCreateConcept={() => {
            setCreatePosition({ x: canvasContextMenu.worldX, y: canvasContextMenu.worldY });
            setCreateModalOpen(true);
            setCanvasContextMenu(null);
          }}
          onClose={() => setCanvasContextMenu(null)}
        />
      )}

      <ConceptCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={async (data) => {
          if (!currentCanvas) return;
          const concept = await createConcept({
            project_id: projectId,
            ...data,
          });
          await addNode({
            canvas_id: currentCanvas.id,
            concept_id: concept.id,
            position_x: createPosition.x,
            position_y: createPosition.y,
          });
        }}
      />
    </div>
  );
}
