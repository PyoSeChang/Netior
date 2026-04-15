import React, { useMemo, useState } from 'react';
import type { LayoutLayerProps } from '../types';
import { PIXELS_PER_DAY, todayEpochDays } from './scale-utils';
import { HEADER_TOTAL_HEIGHT } from './TimelineBackground';

const BAND_HEIGHT = 28;
const BAND_GAP = 2;

export const TimelineOverlay: React.FC<LayoutLayerProps> = ({
  width,
  height,
  zoom,
  panX,
  panY,
  nodes,
  config,
  nodeDragOffset,
  spanResizeOffset,
  onSpanResizeStart,
  onNodeClick,
  onNodeDoubleClick,
  onContextMenu,
}) => {
  const originDay = (config._originDay as number) ?? todayEpochDays();
  const pxPerDay = PIXELS_PER_DAY * zoom;

  const bands = useMemo(() => {
    const rawBands: Array<{
      id: string; screenX: number; screenWidth: number; label: string;
      startValue: number; endValue: number; duration: number; color?: string;
      isReadOnlyOccurrence?: boolean;
    }> = [];

    for (const node of nodes) {
      const timeValue = node.metadata.start_at as number | undefined;
      const endTimeValue = node.metadata.end_at as number | undefined;
      const color = node.metadata.display_color as string | undefined;

      if (timeValue == null || endTimeValue == null) continue;

      const isDragging = nodeDragOffset?.id === node.id;
      let startDay = timeValue;
      let endDay = endTimeValue;

      if (isDragging) {
        const dayDelta = nodeDragOffset.dx / pxPerDay;
        startDay += dayDelta;
        endDay += dayDelta;
      }

      const isResizing = spanResizeOffset?.id === node.id;
      if (isResizing && spanResizeOffset) {
        const dayDelta = spanResizeOffset.dx / pxPerDay;
        if (spanResizeOffset.edge === 'start') startDay += dayDelta;
        else endDay += dayDelta;
      }

      const screenStartX = (startDay - originDay) * pxPerDay + panX;
      const screenEndX = (endDay - originDay) * pxPerDay + panX;
      const minX = Math.min(screenStartX, screenEndX);
      const bandWidth = Math.abs(screenEndX - screenStartX);

      const sortedStart = Math.min(timeValue, endTimeValue);
      const sortedEnd = Math.max(timeValue, endTimeValue);

      rawBands.push({
        id: node.id,
        screenX: minX,
        screenWidth: bandWidth,
        label: node.label,
        startValue: sortedStart,
        endValue: sortedEnd,
        duration: sortedEnd - sortedStart,
        color,
      });
    }

    // Lane assignment: longest → lane 0 (top)
    rawBands.sort((a, b) => b.duration - a.duration);
    const bandLanes: Array<Array<{ start: number; end: number }>> = [];
    const result: Array<typeof rawBands[0] & { lane: number }> = [];

    for (const band of rawBands) {
      let lane = -1;
      for (let i = 0; i < bandLanes.length; i++) {
        const overlaps = bandLanes[i].some(
          (iv) => band.startValue < iv.end && band.endValue > iv.start,
        );
        if (!overlaps) { lane = i; break; }
      }
      if (lane === -1) { lane = bandLanes.length; bandLanes.push([]); }
      bandLanes[lane].push({ start: band.startValue, end: band.endValue });
      result.push({ ...band, lane });
    }

    return result;
  }, [nodes, pxPerDay, panX, originDay, nodeDragOffset, spanResizeOffset]);

  const bandTopBase = HEADER_TOTAL_HEIGHT + 8;
  const [hoveredBandId, setHoveredBandId] = useState<string | null>(null);

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
        {bands.map((band) => {
          const bandY = bandTopBase + band.lane * (BAND_HEIGHT + BAND_GAP);
          const isHovered = hoveredBandId === band.id;
          return (
            <g key={`band-${band.id}`}>
              <rect
                x={band.screenX}
                y={bandY}
                width={Math.max(band.screenWidth, 2)}
                height={BAND_HEIGHT}
                fill={band.color || 'var(--accent-muted)'}
                opacity={isHovered ? 0.8 : 0.5}
                stroke={isHovered ? 'var(--accent)' : 'none'}
                strokeWidth={isHovered ? 1.5 : 0}
                rx={4}
                style={{ pointerEvents: 'all', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={() => setHoveredBandId(band.id)}
                onMouseLeave={() => setHoveredBandId(null)}
                onClick={(e) => { e.stopPropagation(); onNodeClick?.(band.id, e); }}
                onDoubleClick={(e) => { e.stopPropagation(); onNodeDoubleClick?.(band.id); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.('node', e.clientX, e.clientY, band.id); }}
              />
              <text
                x={band.screenX + band.screenWidth / 2}
                y={bandY + BAND_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isHovered ? 'var(--text-default)' : 'var(--text-secondary)'}
                fontWeight={isHovered ? 600 : 400}
                fontSize={11}
                style={{ pointerEvents: 'none', fontFamily: 'var(--font-ui)' }}
              >
                {band.screenWidth > 30 ? band.label : ''}
              </text>
              {onSpanResizeStart && (
                <>
                  <rect
                    x={band.screenX - 4}
                    y={bandY - 2}
                    width={8}
                    height={BAND_HEIGHT + 4}
                    fill="var(--accent)"
                    rx={2}
                    opacity={0.6}
                    style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onSpanResizeStart(band.id, 'start', e.clientX, band.startValue); }}
                  />
                  <rect
                    x={band.screenX + band.screenWidth - 4}
                    y={bandY - 2}
                    width={8}
                    height={BAND_HEIGHT + 4}
                    fill="var(--accent)"
                    rx={2}
                    opacity={0.6}
                    style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onSpanResizeStart(band.id, 'end', e.clientX, band.endValue); }}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
