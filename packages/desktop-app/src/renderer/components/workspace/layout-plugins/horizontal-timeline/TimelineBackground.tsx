import React, { useMemo } from 'react';
import type { LayoutLayerProps } from '../types';
import {
  getGranularity,
  generateHeaderCells,
  todayEpochDays,
  PIXELS_PER_DAY,
} from './scale-utils';

const HEADER_MAJOR_HEIGHT = 28;
const HEADER_MINOR_HEIGHT = 24;
export const HEADER_TOTAL_HEIGHT = HEADER_MAJOR_HEIGHT + HEADER_MINOR_HEIGHT;

export const TimelineBackground: React.FC<LayoutLayerProps> = ({
  width,
  height,
  zoom,
  panX,
  config,
}) => {
  const originDay = (config._originDay as number) ?? todayEpochDays();
  const { major, minor } = getGranularity(zoom);
  // Use a safe width for calculations (fallback to a large number to avoid 0)
  const safeWidth = width || 2000;

  const majorCells = useMemo(
    () => generateHeaderCells({ granularity: major, zoom, panX, viewportWidth: safeWidth, originDay }),
    [major, zoom, panX, safeWidth, originDay],
  );

  const minorCells = useMemo(
    () => generateHeaderCells({ granularity: minor, zoom, panX, viewportWidth: safeWidth, originDay }),
    [minor, zoom, panX, safeWidth, originDay],
  );

  const pxPerDay = PIXELS_PER_DAY * zoom;
  const todayScreenX = (todayEpochDays() - originDay) * pxPerDay + panX;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      {/* Background */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--surface-base)' }} />

      {/* Vertical grid lines */}
      <svg width="100%" height="100%" style={{ position: 'absolute', top: HEADER_TOTAL_HEIGHT, left: 0 }}>
        {minorCells.map((cell, i) => (
          <line key={i} x1={cell.screenX} y1={0} x2={cell.screenX} y2="100%" stroke="var(--border-subtle)" strokeWidth={0.5} />
        ))}
        {majorCells.map((cell, i) => (
          <line key={`m${i}`} x1={cell.screenX} y1={0} x2={cell.screenX} y2="100%" stroke="var(--border-default)" strokeWidth={1} opacity={0.5} />
        ))}
        {todayScreenX >= 0 && todayScreenX <= safeWidth && (
          <line x1={todayScreenX} y1={0} x2={todayScreenX} y2="100%" stroke="var(--accent)" strokeWidth={1.5} opacity={0.7} />
        )}
      </svg>

      {/* Fixed header */}
      <svg width="100%" height={HEADER_TOTAL_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, pointerEvents: 'auto' }}>
        {/* Header background */}
        <rect x={0} y={0} width="100%" height={HEADER_TOTAL_HEIGHT} fill="var(--surface-panel)" />
        <line x1={0} y1={0} x2={0} y2={HEADER_TOTAL_HEIGHT} stroke="var(--border-default)" strokeWidth={1} />
        <line x1={0} y1={HEADER_TOTAL_HEIGHT} x2="100%" y2={HEADER_TOTAL_HEIGHT} stroke="var(--border-default)" strokeWidth={1} />
        <line x1={0} y1={HEADER_MAJOR_HEIGHT} x2="100%" y2={HEADER_MAJOR_HEIGHT} stroke="var(--border-subtle)" strokeWidth={1} />

        {/* Major row cells */}
        {majorCells.map((cell, i) => (
          <g key={`maj-${i}`}>
            <line x1={cell.screenX} y1={0} x2={cell.screenX} y2={HEADER_MAJOR_HEIGHT} stroke="var(--border-subtle)" strokeWidth={1} />
            <text
              x={cell.screenX + 6}
              y={HEADER_MAJOR_HEIGHT / 2}
              dominantBaseline="middle"
              fill="var(--text-default)"
              fontSize={11}
              fontWeight={600}
              fontFamily="system-ui, sans-serif"
            >
              {cell.label}
            </text>
          </g>
        ))}

        {/* Minor row cells */}
        {minorCells.map((cell, i) => (
          <g key={`min-${i}`}>
            <line x1={cell.screenX} y1={HEADER_MAJOR_HEIGHT} x2={cell.screenX} y2={HEADER_TOTAL_HEIGHT} stroke="var(--border-subtle)" strokeWidth={0.5} />
            {cell.screenWidth > 10 && (
              <text
                x={cell.screenX + cell.screenWidth / 2}
                y={HEADER_MAJOR_HEIGHT + HEADER_MINOR_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--text-secondary)"
                fontSize={10}
                fontFamily="system-ui, sans-serif"
              >
                {cell.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
