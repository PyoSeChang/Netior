import React from 'react';
import type { RenderEdge, RenderEdgeAnchor, RenderNode, RenderPoint } from './types';
import { isHierarchyParentContract } from '../../lib/hierarchy-contract';

interface EdgeDebugOverlayProps {
  edges: RenderEdge[];
  nodes: RenderNode[];
  zoom: number;
  panX: number;
  panY: number;
  nodeDragOffset: { id: string; dx: number; dy: number } | null;
  dragFollowerIds?: Set<string>;
}

const HIERARCHY_ROOT_TOP_OFFSET = 8;
const HIERARCHY_ROOT_BOTTOM_OFFSET = 64;

function resolveAnchorPoint(node: RenderNode, anchor: RenderEdgeAnchor | undefined): RenderPoint {
  const width = node.width ?? 160;
  const height = node.height ?? 60;

  switch (anchor) {
    case 'root-top':
      return { x: node.x, y: node.y - height / 2 + HIERARCHY_ROOT_TOP_OFFSET };
    case 'root-bottom':
      return { x: node.x, y: node.y - height / 2 + HIERARCHY_ROOT_BOTTOM_OFFSET };
    case 'top':
      return { x: node.x, y: node.y - height / 2 };
    case 'right':
      return { x: node.x + width / 2, y: node.y };
    case 'bottom':
      return { x: node.x, y: node.y + height / 2 };
    case 'left':
      return { x: node.x - width / 2, y: node.y };
    case 'center':
    default:
      return { x: node.x, y: node.y };
  }
}

function buildOrthogonalWaypoints(
  source: RenderPoint,
  target: RenderPoint,
  axis: 'horizontal' | 'vertical' | undefined,
): RenderPoint[] {
  if (axis === 'vertical') {
    const midY = (source.y + target.y) / 2;
    return [
      { x: source.x, y: midY },
      { x: target.x, y: midY },
    ];
  }

  const midX = (source.x + target.x) / 2;
  return [
    { x: midX, y: source.y },
    { x: midX, y: target.y },
  ];
}

export const EdgeDebugOverlay: React.FC<EdgeDebugOverlayProps> = ({
  edges,
  nodes,
  zoom,
  panX,
  panY,
  nodeDragOffset,
  dragFollowerIds,
}) => {
  const nodePositionMap = new Map<string, RenderNode>();
  for (const node of nodes) {
    if (nodeDragOffset && (nodeDragOffset.id === node.id || dragFollowerIds?.has(node.id))) {
      nodePositionMap.set(node.id, {
        ...node,
        x: node.x + nodeDragOffset.dx / zoom,
        y: node.y + nodeDragOffset.dy / zoom,
      });
    } else {
      nodePositionMap.set(node.id, node);
    }
  }

  const resolveVisibleCardRect = (node: RenderNode): { x: number; y: number; width: number; height: number } | null => {
    if (!node.isHierarchy) return null;
    const width = Math.min(Math.max((node.width ?? 160) - 24, 0), 220);
    return {
      x: node.x - width / 2,
      y: node.y - (node.height ?? 60) / 2 + 8,
      width,
      height: 56,
    };
  };

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex: 25,
        pointerEvents: 'none',
      }}
    >
      <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
        {Array.from(nodePositionMap.values()).map((node) => {
          const width = node.width ?? 160;
          const height = node.height ?? 60;
          const rectX = node.x - width / 2;
          const rectY = node.y - height / 2;
          const visibleCardRect = resolveVisibleCardRect(node);

          return (
            <g key={`debug-node-${node.id}`}>
              <rect
                x={rectX}
                y={rectY}
                width={width}
                height={height}
                fill="none"
                stroke="var(--status-warning)"
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.55}
              />
              {visibleCardRect && (
                <rect
                  x={visibleCardRect.x}
                  y={visibleCardRect.y}
                  width={visibleCardRect.width}
                  height={visibleCardRect.height}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={0.9}
                />
              )}
              <text
                x={rectX}
                y={rectY - 4}
                fontSize={10}
                fill="var(--text-secondary)"
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {edges.map((edge) => {
          if (edge.hidden || edge.route === 'hidden') return null;

          const source = nodePositionMap.get(edge.sourceId);
          const target = nodePositionMap.get(edge.targetId);
          if (!source || !target) return null;

          const sourcePoint = resolveAnchorPoint(source, edge.sourceAnchor);
          const targetPoint = resolveAnchorPoint(target, edge.targetAnchor);
          const routePoints = edge.routePoints
            ?? (
              edge.route === 'orthogonal'
                ? buildOrthogonalWaypoints(sourcePoint, targetPoint, edge.orthogonalAxis)
                : []
            );
          const pathPoints = [sourcePoint, ...routePoints, targetPoint];
          const pointString = pathPoints.map((point) => `${point.x},${point.y}`).join(' ');
          const isHierarchyStructure = isHierarchyParentContract(edge.systemContract);

          return (
            <g key={`debug-edge-${edge.id}`}>
              <polyline
                points={pointString}
                fill="none"
                stroke={isHierarchyStructure ? 'var(--status-warning)' : 'var(--accent)'}
                strokeWidth={1.25}
                strokeDasharray={isHierarchyStructure ? '6 3' : '3 3'}
                opacity={0.9}
              />
              <circle cx={sourcePoint.x} cy={sourcePoint.y} r={3} fill="var(--status-success)" opacity={0.9} />
              <circle cx={targetPoint.x} cy={targetPoint.y} r={3} fill="var(--status-warning)" opacity={0.9} />
              {routePoints.map((point, index) => (
                <rect
                  key={`${edge.id}-waypoint-${index}`}
                  x={point.x - 2.5}
                  y={point.y - 2.5}
                  width={5}
                  height={5}
                  fill="var(--accent)"
                  opacity={0.95}
                />
              ))}
              <text
                x={sourcePoint.x + 6}
                y={sourcePoint.y - 6}
                fontSize={10}
                fill="var(--text-secondary)"
              >
                {edge.systemContract ?? edge.id.slice(0, 6)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
};
