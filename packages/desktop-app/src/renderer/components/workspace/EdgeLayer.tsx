import React from 'react';
import { EdgeRouteLine } from './EdgeRouteLine';
import type { RenderNode, RenderEdge, RenderEdgeAnchor, RenderPoint } from './types';
import type { LayoutViewportMode } from './layout-plugins/types';

interface EdgeLayerProps {
  edges: RenderEdge[];
  nodes: RenderNode[];
  zoom: number;
  panX: number;
  panY: number;
  viewportMode?: LayoutViewportMode;
  zIndex?: number;
  renderHitArea?: boolean;
  renderVisibleStroke?: boolean;
  nodeDragOffset: { id: string; dx: number; dy: number } | null;
  dragFollowerIds?: Set<string>;
  onContextMenu?: (type: 'workspace' | 'node' | 'edge', x: number, y: number, targetId?: string) => void;
  onDoubleClick?: (edgeId: string) => void;
}

/**
 * EdgeLayer
 *
 * Renders all edges as SVG with viewport transform.
 * Calculates edge endpoints from node positions (with drag offset).
 */
export const EdgeLayer: React.FC<EdgeLayerProps> = ({
  edges,
  nodes,
  zoom,
  panX,
  panY,
  viewportMode = 'world',
  zIndex = 1,
  renderHitArea = true,
  renderVisibleStroke = true,
  nodeDragOffset,
  dragFollowerIds,
  onContextMenu,
  onDoubleClick,
}) => {
  const HIERARCHY_ROOT_TOP_OFFSET = 8;
  const HIERARCHY_ROOT_BOTTOM_OFFSET = 64;
  const isTimeline = viewportMode === 'timeline';
  const isScreen = viewportMode === 'screen';

  // Build node position map (with drag offset)
  const nodePositionMap = new Map<string, RenderNode>();
  for (const node of nodes) {
    if (nodeDragOffset && (nodeDragOffset.id === node.id || dragFollowerIds?.has(node.id))) {
      const offsetX = isScreen ? nodeDragOffset.dx : nodeDragOffset.dx / zoom;
      const offsetY = isTimeline || isScreen ? nodeDragOffset.dy : nodeDragOffset.dy / zoom;
      nodePositionMap.set(node.id, {
        ...node,
        x: node.x + offsetX,
        y: node.y + offsetY,
      });
    } else {
      nodePositionMap.set(node.id, node);
    }
  }

  const resolveAnchorPoint = (node: RenderNode, anchor: RenderEdgeAnchor | undefined): RenderPoint => {
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
  };

  const buildOrthogonalWaypoints = (
    source: RenderPoint,
    target: RenderPoint,
    axis: 'horizontal' | 'vertical' | undefined,
  ): RenderPoint[] => {
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
  };

  const buildHierarchyBranchWaypoints = (
    source: RenderPoint,
    target: RenderPoint,
    sourceId: string,
    targetId: string,
  ): RenderPoint[] => {
    const verticalGap = target.y - source.y;
    if (verticalGap <= 16) {
      return buildOrthogonalWaypoints(source, target, 'vertical');
    }

    const branchOffset = Math.max(12, Math.min(28, verticalGap * 0.35));
    const minBranchY = source.y + 12;
    const maxBranchY = target.y - 12;
    let branchY = Math.min(source.y + branchOffset, maxBranchY);

    if (branchY <= source.y || branchY >= target.y) {
      return buildOrthogonalWaypoints(source, target, 'vertical');
    }

    const horizontalMinX = Math.min(source.x, target.x);
    const horizontalMaxX = Math.max(source.x, target.x);
    const padding = 10;

    const intersectsHorizontalSegment = (node: RenderNode, y: number): boolean => {
      if (node.id === sourceId || node.id === targetId) return false;
      const width = (node.width ?? 160) + padding * 2;
      const height = (node.height ?? 60) + padding * 2;
      const left = node.x - width / 2;
      const right = node.x + width / 2;
      const top = node.y - height / 2;
      const bottom = node.y + height / 2;

      if (horizontalMaxX < left || horizontalMinX > right) return false;
      return y >= top && y <= bottom;
    };

    for (let i = 0; i < 4; i += 1) {
      const blockers = Array.from(nodePositionMap.values()).filter((node) => intersectsHorizontalSegment(node, branchY));
      if (blockers.length === 0) break;

      const lowestBottom = Math.max(...blockers.map((node) => node.y + (node.height ?? 60) / 2 + padding));
      const nextBranchY = Math.max(minBranchY, lowestBottom);
      if (nextBranchY >= maxBranchY) {
        branchY = maxBranchY;
        break;
      }
      branchY = nextBranchY;
    }

    if (branchY <= source.y || branchY >= target.y) {
      return buildOrthogonalWaypoints(source, target, 'vertical');
    }

    return [
      { x: source.x, y: branchY },
      { x: target.x, y: branchY },
    ];
  };

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex,
        pointerEvents: 'none',
      }}
    >
      <g
        transform={
          viewportMode === 'world'
            ? `translate(${panX}, ${panY}) scale(${zoom})`
            : viewportMode === 'timeline'
              ? `translate(${panX}, ${panY}) scale(${zoom}, 1)`
              : undefined
        }
        style={{ pointerEvents: 'auto' }}
      >
        {edges.map((edge) => {
          if (edge.hidden || edge.route === 'hidden') return null;

          const source = nodePositionMap.get(edge.sourceId);
          const target = nodePositionMap.get(edge.targetId);
          if (!source || !target) return null;

          const sourcePoint = resolveAnchorPoint(source, edge.sourceAnchor);
          const targetPoint = resolveAnchorPoint(target, edge.targetAnchor);
          const routePoints = edge.routePoints
            ?? (edge.routeStrategy === 'hierarchy-branch'
              ? buildHierarchyBranchWaypoints(sourcePoint, targetPoint, source.id, target.id)
              : edge.route === 'orthogonal'
              ? buildOrthogonalWaypoints(sourcePoint, targetPoint, edge.orthogonalAxis)
              : undefined);
          const trimEndpoints = edge.sourceAnchor == null && edge.targetAnchor == null && !edge.routePoints;

          return (
            <g key={edge.id} style={{ opacity: edge.dimmed ? 0.2 : 1, transition: 'opacity 120ms ease' }}>
              <EdgeRouteLine
                id={edge.id}
                sourceX={sourcePoint.x}
                sourceY={sourcePoint.y}
                targetX={targetPoint.x}
                targetY={targetPoint.y}
                directed={edge.directed}
                label={edge.label}
                color={edge.color}
                lineStyle={edge.lineStyle}
                route={edge.route === 'orthogonal' ? 'orthogonal' : 'straight'}
                routePoints={routePoints}
                trimEndpoints={trimEndpoints}
                renderHitArea={renderHitArea}
                renderVisibleStroke={renderVisibleStroke}
                onContextMenu={onContextMenu}
                onDoubleClick={onDoubleClick}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
};
