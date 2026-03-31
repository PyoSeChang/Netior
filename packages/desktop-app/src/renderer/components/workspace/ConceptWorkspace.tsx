import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeLayer } from './NodeLayer';
import { EdgeLayer } from './EdgeLayer';
import { NodeContextMenu } from './NodeContextMenu';
import { CanvasContextMenu } from './CanvasContextMenu';
import { CanvasControls } from './CanvasControls';
import { useInteraction } from './InteractionLayer';
import { EdgeContextMenu } from './EdgeContextMenu';
import { FileNodeAddModal } from './FileNodeAddModal';
import { useCanvasStore, type CanvasNodeWithConcept, type EdgeWithRelationType } from '../../stores/canvas-store';
import { canvasService } from '../../services';
import { conceptPropertyService } from '../../services';
import { useConceptStore } from '../../stores/concept-store';
import { useEditorStore } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import type { Archetype } from '@moc/shared/types';
import { useI18n } from '../../hooks/useI18n';
import type { RenderNode, RenderEdge } from './types';
import { getLayout } from './layout-plugins/registry';
import type { LayoutRenderNode } from './layout-plugins/types';
import { isoToEpochDays } from './layout-plugins/horizontal-timeline/scale-utils';

interface ConceptWorkspaceProps {
  projectId: string;
}

function toRenderNodes(nodes: CanvasNodeWithConcept[], archetypes: Archetype[]): RenderNode[] {
  const archMap = new Map(archetypes.map((a) => [a.id, a]));
  return nodes.map((n) => {
    if (n.concept) {
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
        conceptId: n.concept_id ?? undefined,
        canvasCount: n.canvas_count,
        nodeType: 'concept' as const,
      };
    }
    // file or dir node
    const isFile = !!n.file_path;
    return {
      id: n.id,
      x: n.position_x,
      y: n.position_y,
      label: (isFile ? n.file_path : n.dir_path)?.split('/').pop() || '?',
      icon: isFile ? '📄' : '📁',
      semanticType: isFile ? 'file' : 'directory',
      semanticTypeLabel: isFile ? 'File' : 'Directory',
      width: n.width ?? 140,
      height: n.height ?? 50,
      canvasCount: 0,
      nodeType: isFile ? 'file' as const : 'dir' as const,
      filePath: n.file_path ?? undefined,
      dirPath: n.dir_path ?? undefined,
    };
  });
}

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  conceptId?: string;
  canvasCount: number;
}

function toRenderEdges(edges: EdgeWithRelationType[]): RenderEdge[] {
  return edges.map((e) => ({
    id: e.id,
    sourceId: e.source_node_id,
    targetId: e.target_node_id,
    directed: e.directed != null ? !!e.directed : (e.relation_type?.directed ?? false),
    label: e.relation_type?.name ?? '',
    color: e.color ?? e.relation_type?.color ?? undefined,
    lineStyle: (e.line_style ?? e.relation_type?.line_style ?? undefined) as 'solid' | 'dashed' | 'dotted' | undefined,
  }));
}

export function ConceptWorkspace({ projectId }: ConceptWorkspaceProps): JSX.Element {
  const {
    currentCanvas, nodes, edges,
    loadCanvases, openCanvas,
    addNode, updateNode, removeNode,
    addEdge, removeEdge, saveViewport,
    drillInto, navigateBack,
  } = useCanvasStore();
  const { createConcept } = useConceptStore();
  const { canvasMode } = useUIStore();
  const { t } = useI18n();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [edgeLinkingState, setEdgeLinkingState] = useState<{ sourceNodeId: string } | null>(null);
  const [fileNodeModalOpen, setFileNodeModalOpen] = useState(false);

  // Load canvases and open first one
  useEffect(() => {
    loadCanvases(projectId).then(() => {
      const store = useCanvasStore.getState();
      if (store.canvases.length > 0 && !store.currentCanvas) {
        store.openCanvas(store.canvases[0].id);
      }
    });
  }, [projectId, loadCanvases]);

  // Cancel edge linking when mode changes
  useEffect(() => {
    setEdgeLinkingState(null);
  }, [canvasMode]);

  // Restore viewport from canvas
  useEffect(() => {
    if (currentCanvas) {
      setZoom(currentCanvas.viewport_zoom);
      setPanX(currentCanvas.viewport_x);
      setPanY(currentCanvas.viewport_y);
    }
  }, [currentCanvas?.id]);

  // Reset viewport when layout changes (e.g., freeform → timeline)
  // Reset viewport when layout changes or on first load of non-freeform
  const prevLayoutRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!currentCanvas || !containerSize.width) return;
    const newLayout = currentCanvas.layout;
    const isFirstLoad = prevLayoutRef.current === undefined;
    const layoutChanged = prevLayoutRef.current !== undefined && prevLayoutRef.current !== newLayout;

    if ((isFirstLoad && newLayout !== 'freeform') || layoutChanged) {
      if (newLayout === 'horizontal-timeline') {
        // Center on today, panY=0 (header is fixed)
        setZoom(1);
        setPanX(containerSize.width / 2);
        setPanY(0);
      } else {
        setZoom(1);
        setPanX(containerSize.width / 2);
        setPanY(containerSize.height / 2);
      }
    }
    prevLayoutRef.current = newLayout;
  }, [currentCanvas?.layout, currentCanvas?.id, containerSize]);

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

  // --- Layout plugin ---
  const layoutPlugin = useMemo(() => getLayout(currentCanvas?.layout), [currentCanvas?.layout]);
  const layoutConfig = currentCanvas?.layout_config ?? {};

  // Load concept_properties for all concept nodes
  const [nodeProperties, setNodeProperties] = useState<Record<string, Array<{ field_id: string; value: string | null }>>>({});
  useEffect(() => {
    if (currentCanvas?.layout === 'freeform' || !currentCanvas) return;
    const conceptIds = nodes.filter((n) => n.concept_id).map((n) => n.concept_id!);
    if (conceptIds.length === 0) return;

    Promise.all(
      conceptIds.map((cid) =>
        conceptPropertyService.getByConcept(cid).then((props) => [cid, props] as const),
      ),
    ).then((results) => {
      const map: Record<string, Array<{ field_id: string; value: string | null }>> = {};
      for (const [cid, props] of results) map[cid] = props;
      setNodeProperties(map);
    });
  }, [nodes, currentCanvas?.layout, currentCanvas?.id]);

  // Build LayoutRenderNodes with metadata from field_mappings + concept_properties
  const fieldMappingsConfig = (layoutConfig.field_mappings ?? {}) as Record<string, Record<string, string>>;

  const layoutRenderNodes = useMemo<LayoutRenderNode[]>(() =>
    renderNodes.map((n) => {
      const archetypeId = n.nodeType === 'concept'
        ? nodes.find((cn) => cn.id === n.id)?.concept?.archetype_id ?? undefined
        : undefined;

      // Build metadata from field_mappings
      const metadata: Record<string, unknown> = {};
      if (archetypeId && fieldMappingsConfig[archetypeId]) {
        const mapping = fieldMappingsConfig[archetypeId];
        const conceptId = n.conceptId;
        const props = conceptId ? nodeProperties[conceptId] ?? [] : [];

        for (const [metaKey, fieldIdOrValue] of Object.entries(mapping)) {
          // 'role' is stored directly as a value, not a field_id
          if (metaKey === 'role') {
            metadata[metaKey] = fieldIdOrValue;
            continue;
          }
          // Find the property value by field_id
          const prop = props.find((p) => p.field_id === fieldIdOrValue);
          if (prop?.value != null) {
            // Try date parsing first (for timeline date fields)
            const epochDays = isoToEpochDays(prop.value);
            if (epochDays != null) {
              metadata[metaKey] = epochDays;
            } else {
              const num = Number(prop.value);
              metadata[metaKey] = isNaN(num) ? prop.value : num;
            }
          }
        }
      }

      return { ...n, metadata, archetypeId };
    }),
  [renderNodes, nodes, fieldMappingsConfig, nodeProperties]);

  // Compute layout positions (freeform returns same positions, timeline computes from metadata)
  const layoutResult = useMemo(
    () => layoutPlugin.computeLayout({
      nodes: layoutRenderNodes,
      edges: renderEdges,
      viewport: { width: containerSize.width, height: containerSize.height },
      config: layoutConfig,
    }),
    [layoutPlugin, layoutRenderNodes, renderEdges, containerSize, layoutConfig],
  );

  // Apply computed positions to nodes
  const positionedNodes = useMemo<LayoutRenderNode[]>(() =>
    layoutRenderNodes.map((n) => {
      const pos = layoutResult[n.id];
      if (!pos) return n;
      return { ...n, x: pos.x, y: pos.y, width: pos.width ?? n.width };
    }),
  [layoutRenderNodes, layoutResult]);

  // Classify nodes (freeform: all as cardNodes, timeline: period+span → overlay)
  const { cardNodes } = useMemo(
    () => layoutPlugin.classifyNodes(positionedNodes),
    [layoutPlugin, positionedNodes],
  );
  const cardRenderNodes = useMemo<RenderNode[]>(() => cardNodes, [cardNodes]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape: cancel edge linking
      if (e.key === 'Escape' && edgeLinkingState) {
        setEdgeLinkingState(null);
        return;
      }
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
  }, [selectedIds, renderNodes, removeNode, edgeLinkingState]);

  // --- Mouse interaction (via useInteraction, same pattern as Culturium) ---

  const isTimeline = layoutPlugin.key !== 'freeform';

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    if (isTimeline) {
      // Timeline: Ctrl+wheel = zoom (X only), wheel = horizontal scroll, Shift+wheel = vertical scroll
      if (e.ctrlKey) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouseX = e.clientX - rect.left;
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.min(50, Math.max(0.01, zoom * factor));
        const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
        setZoom(newZoom);
        setPanX(newPanX);
      } else if (e.shiftKey) {
        setPanY((py) => py - e.deltaY);
      } else {
        setPanX((px) => px - e.deltaY);
      }
      return;
    }

    // Freeform: Ctrl+wheel = canvas hierarchy, wheel = zoom-toward-cursor
    if (e.ctrlKey) {
      if (e.deltaY < 0) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const worldX = (e.clientX - rect.left - panX) / zoom;
        const worldY = (e.clientY - rect.top - panY) / zoom;
        const hitNode = nodes.find((n) => {
          const w = n.width ?? 160;
          const h = n.height ?? 60;
          return (
            n.concept_id &&
            n.canvas_count > 0 &&
            worldX >= n.position_x - w / 2 &&
            worldX <= n.position_x + w / 2 &&
            worldY >= n.position_y - h / 2 &&
            worldY <= n.position_y + h / 2
          );
        });
        if (hitNode?.concept_id) drillInto(hitNode.concept_id);
      } else {
        navigateBack();
      }
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(5, Math.max(0.005, zoom * factor));
    const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - panY) * (newZoom / zoom);
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [zoom, panX, panY, nodes, drillInto, navigateBack, isTimeline]);

  const handleNodeDragEnd = useCallback(async (nodeId: string, x: number, y: number) => {
    if (layoutPlugin.onNodeDrop) {
      const node = positionedNodes.find((n) => n.id === nodeId);
      if (node) {
        const result = layoutPlugin.onNodeDrop({
          nodeId,
          newX: x,
          newY: y,
          config: currentCanvas?.layout_config ?? {},
          node,
        });
        await updateNode(nodeId, { position_x: result.position.x, position_y: result.position.y });
        // TODO: Phase 8 — save propertyUpdates to concept_properties via service
        return;
      }
    }
    await updateNode(nodeId, { position_x: x, position_y: y });
  }, [updateNode, layoutPlugin, positionedNodes, currentCanvas]);

  const handlePanChange = useCallback((newPanX: number, newPanY: number) => {
    setPanX(newPanX);
    setPanY(newPanY);
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedIds(new Set());
    setContextMenu(null);
    setCanvasContextMenu(null);
    setEdgeLinkingState(null);
    setEdgeContextMenu(null);
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
    constraints: layoutPlugin.interactionConstraints,
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
      onMouseDown={(e) => {
        setCanvasContextMenu(null);
        setContextMenu(null);
        setEdgeContextMenu(null);
        handleCanvasMouseDown(e);
      }}
      onContextMenu={handleContextMenu}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/moc-node')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={async (e) => {
        const raw = e.dataTransfer.getData('application/moc-node');
        if (!raw || !currentCanvas) return;
        e.preventDefault();
        const data = JSON.parse(raw) as { type: 'file' | 'dir'; path: string };
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const worldX = (e.clientX - rect.left - panX) / zoom;
        const worldY = (e.clientY - rect.top - panY) / zoom;
        await addNode({
          canvas_id: currentCanvas.id,
          ...(data.type === 'file' ? { file_path: data.path } : { dir_path: data.path }),
          position_x: worldX,
          position_y: worldY,
        });
      }}
    >
      <CanvasControls
        mode={canvasMode}
        zoom={zoom}
        canGoBack={canvasHistory.length > 0}
        canGoForward={false}
        onToggleMode={toggleMode}
        onZoomIn={() => setZoom((z) => Math.min(5, z * 1.2))}
        onZoomOut={() => setZoom((z) => Math.max(0.005, z / 1.2))}
        onFitToScreen={fitToScreen}
        onNavigateBack={() => navigateBack()}
        onNavigateForward={() => {}}
      />

      <layoutPlugin.BackgroundComponent
        width={containerSize.width}
        height={containerSize.height}
        zoom={zoom}
        panX={panX}
        panY={panY}
        nodes={positionedNodes}
        edges={renderEdges}
        config={currentCanvas.layout_config ?? {}}
        nodeDragOffset={nodeDragOffset}
      />

      <EdgeLayer
        edges={renderEdges}
        nodes={renderNodes}
        zoom={zoom}
        panX={panX}
        panY={panY}
        nodeDragOffset={nodeDragOffset}
        onContextMenu={(type, x, y, targetId) => {
          if (type === 'edge' && targetId && canvasMode === 'edit') {
            setEdgeContextMenu({ x, y, edgeId: targetId });
          }
        }}
        onDoubleClick={(edgeId) => {
          const edge = edges.find((e) => e.id === edgeId);
          if (!edge) return;
          const srcNode = nodes.find((n) => n.id === edge.source_node_id);
          const tgtNode = nodes.find((n) => n.id === edge.target_node_id);
          const srcLabel = srcNode?.concept?.title ?? srcNode?.file_path?.split('/').pop() ?? '?';
          const tgtLabel = tgtNode?.concept?.title ?? tgtNode?.file_path?.split('/').pop() ?? '?';
          useEditorStore.getState().openTab({
            type: 'edge',
            targetId: edgeId,
            title: `${srcLabel} → ${tgtLabel}`,
          });
        }}
      />

      {layoutPlugin.OverlayComponent && (
        <layoutPlugin.OverlayComponent
          width={containerSize.width}
          height={containerSize.height}
          zoom={zoom}
          panX={panX}
          panY={panY}
          nodes={positionedNodes}
          edges={renderEdges}
          config={currentCanvas.layout_config ?? {}}
          nodeDragOffset={nodeDragOffset}
          onNodeClick={(id, event) => {
            setSelectedIds(new Set([id]));
          }}
          onNodeDoubleClick={(id) => {
            const node = nodes.find((n) => n.id === id);
            if (node?.concept_id && node.concept) {
              useEditorStore.getState().openTab({
                type: 'concept',
                targetId: node.concept_id,
                title: node.concept.title,
              });
            }
          }}
          onContextMenu={(type, x, y, targetId) => {
            if (type === 'node' && targetId) {
              const node = nodes.find((n) => n.id === targetId);
              if (node) {
                setContextMenu({
                  x, y,
                  nodeId: targetId,
                  conceptId: node.concept_id ?? undefined,
                  canvasCount: node.canvas_count,
                });
              }
            }
          }}
        />
      )}

      {edgeLinkingState && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-accent/90 text-text-on-accent px-4 py-1.5 rounded-full text-xs flex items-center gap-2 shadow-lg">
          <span>{t('canvas.selectTarget') ?? 'Click a node to connect'}</span>
          <button
            type="button"
            className="underline opacity-80 hover:opacity-100"
            onClick={() => setEdgeLinkingState(null)}
          >
            {t('common.cancel') ?? 'Cancel'}
          </button>
        </div>
      )}

      <NodeLayer
        nodes={cardRenderNodes}
        selectedIds={selectedIds}
        highlightedIds={edgeLinkingState ? new Set(renderNodes.filter((n) => n.id !== edgeLinkingState.sourceNodeId).map((n) => n.id)) : undefined}
        mode={canvasMode}
        zoom={zoom}
        panX={panX}
        panY={panY}
        timelineMode={isTimeline}
        nodeDragOffset={nodeDragOffset}
        onNodeClick={(id) => {
          if (edgeLinkingState) {
            if (id !== edgeLinkingState.sourceNodeId && currentCanvas) {
              addEdge({
                canvas_id: currentCanvas.id,
                source_node_id: edgeLinkingState.sourceNodeId,
                target_node_id: id,
              }).then((edge) => {
                openCanvas(currentCanvas.id);
                const srcNode = nodes.find((n) => n.id === edgeLinkingState.sourceNodeId);
                const tgtNode = nodes.find((n) => n.id === id);
                const srcLabel = srcNode?.concept?.title ?? '?';
                const tgtLabel = tgtNode?.concept?.title ?? '?';
                useEditorStore.getState().openTab({
                  type: 'edge',
                  targetId: edge.id,
                  title: `${srcLabel} → ${tgtLabel}`,
                });
              });
            }
            setEdgeLinkingState(null);
            return;
          }
          setSelectedIds(new Set([id]));
        }}
        onNodeDoubleClick={(id) => {
          const node = nodes.find((n) => n.id === id);
          if (node?.concept_id && node.concept) {
            useEditorStore.getState().openTab({
              type: 'concept',
              targetId: node.concept_id,
              title: node.concept.title,
            });
          } else if (node?.file_path) {
            useEditorStore.getState().openTab({
              type: 'file',
              targetId: node.file_path,
              title: node.file_path.split('/').pop() || 'File',
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
                conceptId: node.concept_id ?? undefined,
                canvasCount: node.canvas_count,
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
          canvasCount={contextMenu.canvasCount}
          mode={canvasMode}
          onAddConnection={(nodeId) => {
            setEdgeLinkingState({ sourceNodeId: nodeId });
            setContextMenu(null);
          }}
          onCreateCanvas={async (conceptId) => {
            if (!currentCanvas) return;
            const node = nodes.find((n) => n.concept_id === conceptId);
            const name = node?.concept ? `${node.concept.title} Canvas` : 'New Canvas';
            const canvas = await canvasService.create({
              project_id: currentCanvas.project_id,
              name,
              concept_id: conceptId,
            });
            // Reload to update canvas_count + canvases list
            await openCanvas(currentCanvas.id);
            await useCanvasStore.getState().loadCanvases(currentCanvas.project_id);
            // Open CanvasEditor for the new canvas
            useEditorStore.getState().openTab({
              type: 'canvas',
              targetId: canvas.id,
              title: canvas.name,
            });
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {edgeContextMenu && (
        <EdgeContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          edgeId={edgeContextMenu.edgeId}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}

      {canvasContextMenu && (
        <CanvasContextMenu
          x={canvasContextMenu.x}
          y={canvasContextMenu.y}
          onCreateConcept={() => {
            if (!currentCanvas) return;
            const draftId = `draft-${Date.now()}`;
            const worldX = canvasContextMenu.worldX;
            const worldY = canvasContextMenu.worldY;
            setCanvasContextMenu(null);
            useEditorStore.getState().openTab({
              type: 'concept',
              targetId: draftId,
              title: t('concept.defaultTitle'),
              draftData: {
                canvasId: currentCanvas.id,
                positionX: worldX,
                positionY: worldY,
              },
            });
          }}
          onAddFileNode={() => {
            setFileNodeModalOpen(true);
            setCanvasContextMenu(null);
          }}
          onClose={() => setCanvasContextMenu(null)}
        />
      )}

      <FileNodeAddModal
        open={fileNodeModalOpen}
        onClose={() => setFileNodeModalOpen(false)}
        onSelect={async (path, type) => {
          if (!currentCanvas) return;
          await addNode({
            canvas_id: currentCanvas.id,
            ...(type === 'file' ? { file_path: path } : { dir_path: path }),
            position_x: canvasContextMenu?.worldX ?? 0,
            position_y: canvasContextMenu?.worldY ?? 0,
          });
          setFileNodeModalOpen(false);
        }}
      />

    </div>
  );
}
