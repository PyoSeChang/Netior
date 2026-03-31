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

  const majorCells = useMemo(
    () => generateHeaderCells({ granularity: major, zoom, panX, canvasWidth: width, originDay }),
    [major, zoom, panX, width, originDay],
  );

  const minorCells = useMemo(
    () => generateHeaderCells({ granularity: minor, zoom, panX, canvasWidth: width, originDay }),
    [minor, zoom, panX, width, originDay],
  );

  // Today marker
  const pxPerDay = PIXELS_PER_DAY * zoom;
  const todayScreenX = (todayEpochDays() - originDay) * pxPerDay + panX;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {/* Background */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'var(--surface-base)' }} />

      {/* Vertical grid lines from minor cells */}
      <svg style={{ position: 'absolute', top: HEADER_TOTAL_HEIGHT, left: 0, width: '100%', height: `calc(100% - ${HEADER_TOTAL_HEIGHT}px)` }}>
        {minorCells.map((cell, i) => (
          <line
            key={i}
            x1={cell.screenX}
            y1={0}
            x2={cell.screenX}
            y2="100%"
            stroke="var(--border-subtle)"
            strokeWidth={0.5}
          />
        ))}
        {/* Major division lines (thicker) */}
        {majorCells.map((cell, i) => (
          <line
            key={`m${i}`}
            x1={cell.screenX}
            y1={0}
            x2={cell.screenX}
            y2="100%"
            stroke="var(--border-default)"
            strokeWidth={1}
            opacity={0.5}
          />
        ))}
        {/* Today line */}
        {todayScreenX >= 0 && todayScreenX <= width && (
          <line
            x1={todayScreenX}
            y1={0}
            x2={todayScreenX}
            y2="100%"
            stroke="var(--accent)"
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}
      </svg>

      {/* Fixed header — screen space, no canvas transform */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: HEADER_TOTAL_HEIGHT,
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--surface-panel)',
          zIndex: 10,
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        {/* Major row */}
        <div style={{ position: 'relative', height: HEADER_MAJOR_HEIGHT, borderBottom: '1px solid var(--border-subtle)' }}>
          {majorCells.map((cell, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: cell.screenX,
                width: cell.screenWidth,
                height: HEADER_MAJOR_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 6,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-default)',
                borderRight: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {cell.label}
            </div>
          ))}
        </div>

        {/* Minor row */}
        <div style={{ position: 'relative', height: HEADER_MINOR_HEIGHT }}>
          {minorCells.map((cell, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: cell.screenX,
                width: cell.screenWidth,
                height: HEADER_MINOR_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: 'var(--text-secondary)',
                borderRight: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {cell.screenWidth > 20 ? cell.label : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
