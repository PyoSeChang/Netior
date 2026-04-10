import React, { useMemo } from 'react';
import type { RenderNode } from './types';
import type { CanvasMode } from '../../stores/ui-store';
import { NodeCardDefault } from '../canvas/node-components/NodeCardDefault';
import type { NodeResizeDirection } from '../canvas/node-components/types';

interface NodeLayerProps {
  nodes: RenderNode[];
  selectedIds: Set<string>;
  highlightedIds?: Set<string>;
  mode: CanvasMode;
  zoom: number;
  panX: number;
  panY: number;
  /** Timeline mode: zoom only affects X position, nodes render at fixed size */
  timelineMode?: boolean;
  nodeDragOffset: { id: string; dx: number; dy: number } | null;
  onNodeClick: (id: string, event: React.MouseEvent) => void;
  onNodeDoubleClick: (id: string) => void;
  onNodeDragStart: (nodeId: string, startX: number, startY: number) => void;
  onNodeResizeStart?: (nodeId: string, direction: NodeResizeDirection, startX: number, startY: number) => void;
  onNodeToggleCollapse?: (nodeId: string) => void;
  onContextMenu?: (type: 'canvas' | 'node' | 'edge', x: number, y: number, targetId?: string) => void;
  onNodeMouseEnter?: (id: string, screenX: number, screenY: number) => void;
  onNodeMouseLeave?: (id: string) => void;
}

export const NodeLayer: React.FC<NodeLayerProps> = ({
  nodes,
  selectedIds,
  highlightedIds,
  mode,
  zoom,
  panX,
  panY,
  timelineMode,
  nodeDragOffset,
  onNodeClick,
  onNodeDoubleClick,
  onNodeDragStart,
  onNodeResizeStart,
  onNodeToggleCollapse,
  onContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
}) => {
  const orderedNodes = useMemo(
    () => [...nodes].sort((a, b) => (b.isContainer ? 1 : 0) - (a.isContainer ? 1 : 0)),
    [nodes],
  );

  const getNodePosition = (node: RenderNode) => {
    let x = node.x;
    let y = node.y;

    if (nodeDragOffset && nodeDragOffset.id === node.id) {
      if (timelineMode) {
        // In timeline, dx is screen pixels, convert to canvas X delta
        x += nodeDragOffset.dx / zoom;
        y += nodeDragOffset.dy;
      } else {
        x += nodeDragOffset.dx / zoom;
        y += nodeDragOffset.dy / zoom;
      }
    }

    if (timelineMode) {
      // Timeline: X uses zoom, Y is direct screen offset
      return { x: x * zoom + panX, y: y + panY };
    }

    return { x, y };
  };

  // Timeline: no container transform, positions are screen coords
  // Freeform: container transform with scale(zoom)
  const containerStyle = timelineMode
    ? { position: 'absolute' as const, left: 0, top: 0 }
    : { position: 'absolute' as const, left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${panX}px, ${panY}px) scale(${zoom})` };

  return (
    <div style={containerStyle}>
      {orderedNodes.map((node) => {
        const t = getNodePosition(node);

        return (
          <div key={node.id} style={{ opacity: node.dimmed ? 0.25 : 1, transition: 'opacity 120ms ease' }}>
            <NodeCardDefault
              id={node.id}
              x={t.x}
              y={t.y}
              label={node.label}
              icon={node.icon}
              semanticType={node.semanticType}
              semanticTypeLabel={node.semanticTypeLabel}
              selected={selectedIds.has(node.id)}
              highlighted={highlightedIds?.has(node.id)}
              mode={mode}
              shape={(node.shape as import('../canvas/node-components/types').NodeShape) || 'rectangle'}
              width={node.width}
              height={node.height}
              resizable={!!onNodeResizeStart && !timelineMode && !!node.isContainer}
              onResizeStart={onNodeResizeStart}
              collapsed={node.isCollapsed}
              onToggleCollapse={onNodeToggleCollapse}
              onClick={onNodeClick}
              onDoubleClick={onNodeDoubleClick}
              onDragStart={onNodeDragStart}
              onContextMenu={onContextMenu}
              onMouseEnter={onNodeMouseEnter ? (e: React.MouseEvent) => onNodeMouseEnter(node.id, e.clientX, e.clientY) : undefined}
              onMouseLeave={onNodeMouseLeave ? () => onNodeMouseLeave(node.id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
};
