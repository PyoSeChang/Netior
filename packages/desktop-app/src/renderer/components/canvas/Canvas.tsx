import React, { useRef, useCallback, useState, useEffect } from 'react';
import { SelectionBox } from './SelectionBox';
import { CanvasControls } from './CanvasControls';
import { NodeLayer } from '../workspace/NodeLayer';
import { EdgeLayer } from '../workspace/EdgeLayer';
import { Background } from '../workspace/Background';
import { useInteraction } from '../workspace/InteractionLayer';
import type { CanvasMode, RenderingMode } from '../../stores/ui-store';
import type { RenderNode, RenderEdge, LayoutNode } from '../workspace/types';
import type { InteractionConstraints } from '../workspace/layout-plugins/types';

// Re-export workspace types for backward compatibility
export type CanvasNodeData = RenderNode;
export type CanvasEdgeData = RenderEdge;

export interface CanvasProps {
  nodes: CanvasNodeData[];
  edges: CanvasEdgeData[];
  layoutNodes: LayoutNode[];
  selectedIds: Set<string>;
  highlightedIds?: Set<string>;
  zoom: number;
  panOffset: { x: number; y: number };
  focusSchemaId: string | null;
  mode: CanvasMode;
  renderingMode: RenderingMode;
  canUndo: boolean;
  canRedo: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onNodeClick: (id: string, event: React.MouseEvent) => void;
  onNodeDoubleClick: (id: string) => void;
  onNodeDragEnd: (id: string, x: number, y: number) => Promise<void>;
  onSpanResizeEnd?: (nodeId: string, edge: 'start' | 'end', newValue: number) => Promise<void>;
  onSelectionBox: (nodeIds: string[]) => void;
  onCanvasClick: () => void;
  onZoomChange: (zoom: number) => void;
  onPanChange: (offset: { x: number; y: number }) => void;
  onFitToScreen: () => void;
  onBackToOverview: () => void;
  onToggleMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  isTransitioning?: boolean;
  onContextMenu?: (type: 'canvas' | 'node' | 'edge', x: number, y: number, targetId?: string) => void;
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3.0;
const DEFAULT_CONSTRAINTS: InteractionConstraints = {
  panAxis: null,
  nodeDragAxis: null,
  enableSpanResize: false,
};

export const Canvas: React.FC<CanvasProps> = ({
  nodes,
  edges,
  layoutNodes,
  selectedIds,
  highlightedIds,
  zoom,
  panOffset,
  focusSchemaId,
  mode,
  renderingMode,
  canUndo,
  canRedo,
  canGoBack,
  canGoForward,
  onNodeClick,
  onNodeDoubleClick,
  onNodeDragEnd,
  onSpanResizeEnd,
  onSelectionBox,
  onCanvasClick,
  onZoomChange,
  onPanChange,
  onFitToScreen,
  onBackToOverview,
  onToggleMode,
  onUndo,
  onRedo,
  onNavigateBack,
  onNavigateForward,
  isTransitioning,
  onContextMenu,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });

  // --- Track container size ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Use interaction hook for gesture handling ---
  const { dragState, nodeDragOffset, spanResizeOffset, handleCanvasMouseDown, handleNodeDragStart, handleSpanResizeStart } = useInteraction({
    containerRef,
    nodes,
    zoom,
    panX: panOffset.x,
    panY: panOffset.y,
    mode,
    constraints: DEFAULT_CONSTRAINTS,
    onPanChange: (panX, panY) => onPanChange({ x: panX, y: panY }),
    onNodeDragEnd,
    onSpanResizeEnd,
    onSelectionBox,
    onCanvasClick,
    onWheel: (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
      if (newZoom === zoom) return;

      // Zoom toward cursor: keep world position under cursor fixed
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - panOffset.x) / zoom;
        const worldY = (mouseY - panOffset.y) / zoom;
        onPanChange({ x: mouseX - worldX * newZoom, y: mouseY - worldY * newZoom });
      }
      onZoomChange(newZoom);
    },
  });

  // --- Canvas context menu ---
  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu?.('canvas', e.clientX, e.clientY);
    },
    [onContextMenu],
  );

  return (
    <div
      ref={containerRef}
      className="bg-canvas-bg select-none"
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={handleCanvasContextMenu}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: isTransitioning ? 'none' : undefined,
      }}
    >
      {/* Background Layer */}
      <Background
        width={containerSize.width}
        height={containerSize.height}
        zoom={zoom}
        panX={panOffset.x}
        panY={panOffset.y}
      />

      {/* Edge Layer (SVG) */}
      <EdgeLayer
        edges={edges}
        nodes={nodes}
        zoom={zoom}
        panX={panOffset.x}
        panY={panOffset.y}
        nodeDragOffset={nodeDragOffset}
        onContextMenu={onContextMenu}
      />

      {/* Node Layer */}
      <NodeLayer
        nodes={nodes}
        selectedIds={selectedIds}
        highlightedIds={highlightedIds}
        mode={mode}
        zoom={zoom}
        panX={panOffset.x}
        panY={panOffset.y}
        nodeDragOffset={nodeDragOffset}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={handleNodeDragStart}
        onContextMenu={onContextMenu}
      />

      {/* Selection Box */}
      {dragState.type === 'selection' && (
        <SelectionBox
          startX={dragState.startX}
          startY={dragState.startY}
          currentX={dragState.currentX}
          currentY={dragState.currentY}
        />
      )}

      {/* Controls */}
      <CanvasControls
        zoom={zoom}
        focusSchemaId={focusSchemaId}
        mode={mode}
        canUndo={canUndo}
        canRedo={canRedo}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onZoomIn={() => onZoomChange(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
        onZoomOut={() => onZoomChange(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
        onFitToScreen={onFitToScreen}
        onBackToOverview={onBackToOverview}
        onToggleMode={onToggleMode}
        onUndo={onUndo}
        onRedo={onRedo}
        onNavigateBack={onNavigateBack}
        onNavigateForward={onNavigateForward}
      />
    </div>
  );
};
