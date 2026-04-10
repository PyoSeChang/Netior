import React, { useCallback, useState } from 'react';
import type { RenderPoint } from '../workspace/types';

export interface EdgeRouteLineProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  directed: boolean;
  label: string;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  route?: 'straight' | 'orthogonal';
  routePoints?: RenderPoint[];
  trimEndpoints?: boolean;
  renderHitArea?: boolean;
  renderVisibleStroke?: boolean;
  onContextMenu?: (type: 'canvas' | 'node' | 'edge', x: number, y: number, targetId?: string) => void;
  onDoubleClick?: (edgeId: string) => void;
}

const ARROW_SIZE = 8;
const NODE_RADIUS = 30;

function distance(a: RenderPoint, b: RenderPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function trimAlongSegment(origin: RenderPoint, next: RenderPoint, trim: number): RenderPoint {
  const segmentLength = distance(origin, next);
  if (segmentLength < 1) return origin;

  const ratio = Math.min(trim / segmentLength, 0.49);
  return {
    x: origin.x + (next.x - origin.x) * ratio,
    y: origin.y + (next.y - origin.y) * ratio,
  };
}

function buildPathPoints(
  source: RenderPoint,
  target: RenderPoint,
  route: 'straight' | 'orthogonal',
  routePoints?: RenderPoint[],
  trimEndpoints = true,
): RenderPoint[] {
  const middlePoints = routePoints && routePoints.length > 0
    ? routePoints
    : route === 'orthogonal'
      ? [
          { x: (source.x + target.x) / 2, y: source.y },
          { x: (source.x + target.x) / 2, y: target.y },
        ]
      : [];

  const rawPoints = [source, ...middlePoints, target];
  if (rawPoints.length < 2) return rawPoints;
  if (!trimEndpoints) return rawPoints;

  const trimmed = [...rawPoints];
  trimmed[0] = trimAlongSegment(rawPoints[0], rawPoints[1], NODE_RADIUS);
  trimmed[trimmed.length - 1] = trimAlongSegment(rawPoints[rawPoints.length - 1], rawPoints[rawPoints.length - 2], NODE_RADIUS);
  return trimmed;
}

function getMidpoint(points: RenderPoint[]): RenderPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 1; i < points.length; i += 1) {
    const len = distance(points[i - 1], points[i]);
    segmentLengths.push(len);
    totalLength += len;
  }

  const midpointDistance = totalLength / 2;
  let traversed = 0;
  for (let i = 1; i < points.length; i += 1) {
    const len = segmentLengths[i - 1];
    if (traversed + len >= midpointDistance && len > 0) {
      const ratio = (midpointDistance - traversed) / len;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * ratio,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * ratio,
      };
    }
    traversed += len;
  }

  return points[Math.floor(points.length / 2)];
}

export const EdgeRouteLine: React.FC<EdgeRouteLineProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  directed,
  label,
  color,
  lineStyle,
  route = 'straight',
  routePoints,
  trimEndpoints = true,
  renderHitArea = true,
  renderVisibleStroke = true,
  onContextMenu,
  onDoubleClick,
}) => {
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onDoubleClick?.(id);
    },
    [id, onDoubleClick],
  );
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.('edge', e.clientX, e.clientY, id);
    },
    [id, onContextMenu],
  );

  const pathPoints = buildPathPoints(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    route,
    routePoints,
    trimEndpoints,
  );

  if (pathPoints.length < 2) return null;

  const start = pathPoints[0];
  const end = pathPoints[pathPoints.length - 1];
  const preEnd = pathPoints[pathPoints.length - 2];
  const angle = Math.atan2(end.y - preEnd.y, end.x - preEnd.x);
  const midpoint = getMidpoint(pathPoints);
  const isPolyline = route === 'orthogonal' || pathPoints.length > 2;
  const pointString = pathPoints.map((point) => `${point.x},${point.y}`).join(' ');

  const defaultColor = color || 'var(--edge-default)';
  const lineStroke = hovered ? 'var(--edge-hover)' : defaultColor;
  const lineWidth = hovered ? 2 : 1.5;
  const arrowFill = hovered ? 'var(--edge-hover)' : defaultColor;
  const dashArray = lineStyle === 'dashed' ? '8,4' : lineStyle === 'dotted' ? '2,2' : undefined;

  return (
    <g onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {renderHitArea && (isPolyline ? (
        <polyline
          points={pointString}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="stroke"
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleDoubleClick}
        />
      ) : (
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="transparent"
          strokeWidth={12}
          pointerEvents="stroke"
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleDoubleClick}
        />
      ))}
      {renderVisibleStroke && (isPolyline ? (
        <polyline
          points={pointString}
          fill="none"
          stroke={lineStroke}
          strokeWidth={lineWidth}
          strokeDasharray={dashArray}
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />
      ) : (
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={lineStroke}
          strokeWidth={lineWidth}
          strokeDasharray={dashArray}
          pointerEvents="none"
        />
      ))}
      {renderVisibleStroke && directed && (
        <polygon
          points={`0,${-ARROW_SIZE / 2} ${ARROW_SIZE},0 0,${ARROW_SIZE / 2}`}
          transform={`translate(${end.x}, ${end.y}) rotate(${(angle * 180) / Math.PI})`}
          fill={arrowFill}
          pointerEvents="none"
        />
      )}
      {renderVisibleStroke && hovered && label && (
        <text
          x={midpoint.x}
          y={midpoint.y - 8}
          textAnchor="middle"
          style={{ fontSize: 11, fill: 'var(--text-secondary)', pointerEvents: 'none' }}
        >
          {label}
        </text>
      )}
    </g>
  );
};
