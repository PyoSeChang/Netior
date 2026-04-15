import React, { useId, useMemo } from 'react';
import { useI18n } from '@renderer/hooks/useI18n';
import type { LayoutLayerProps } from '../types';
import {
  CALENDAR_BODY_TOP,
  CALENDAR_DAY_ALL_DAY_HEADER_HEIGHT,
  CALENDAR_DAY_ALL_DAY_LABEL_WIDTH,
  CALENDAR_DAY_HOUR_SLOT_HEIGHT,
  CALENDAR_DAY_SECTION_PADDING,
  CALENDAR_TITLE_HEIGHT,
  CALENDAR_WEEKDAY_HEIGHT,
  createCalendarSnapshot,
  epochDaysToDate,
} from './calendar-utils';

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export const CalendarBackground: React.FC<LayoutLayerProps> = ({
  width,
  height,
  panY,
  nodes,
  config,
}) => {
  const { t } = useI18n();
  const clipPathId = useId();
  const scrollClipPathId = useId();
  const snapshot = useMemo(
    () => createCalendarSnapshot({
      nodes,
      config,
      viewport: { width, height },
      scrollPx: panY,
    }),
    [config, height, nodes, panY, width],
  );
  const { frame } = snapshot;

  if ((frame.view === 'day' || frame.view === 'week') && snapshot.temporal) {
    const temporal = snapshot.temporal;
    const now = new Date();
    const todayEpochDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    const nowY = temporal.timelineTop + (now.getHours() * 60 + now.getMinutes()) * temporal.pxPerMinute - temporal.scrollPx;
    const hourRows = Array.from({ length: 25 }, (_, index) => index);
    const hasTodayColumn = temporal.columns.some((column) => column.epochDay === todayEpochDay);

    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <clipPath id={clipPathId}>
            <rect
              x={0}
              y={frame.bodyTop}
              width={frame.width}
              height={frame.height - frame.bodyTop}
            />
          </clipPath>
          <clipPath id={scrollClipPathId}>
            <rect
              x={0}
              y={frame.bodyTop}
              width={frame.width}
              height={frame.height - frame.bodyTop}
            />
          </clipPath>
        </defs>

        <rect width="100%" height="100%" fill="var(--surface-base)" />

        <rect
          x={0}
          y={0}
          width={frame.width}
          height={CALENDAR_TITLE_HEIGHT}
          fill="var(--surface-panel)"
        />
        <rect
          x={0}
          y={CALENDAR_TITLE_HEIGHT}
          width={frame.width}
          height={CALENDAR_WEEKDAY_HEIGHT}
          fill="var(--surface-panel)"
        />
        <line
          x1={0}
          y1={CALENDAR_TITLE_HEIGHT}
          x2={frame.width}
          y2={CALENDAR_TITLE_HEIGHT}
          stroke="var(--border-subtle)"
          strokeWidth={1}
        />

        {temporal.columns.map((column) => {
          const columnFill = 'transparent';
          const weekdayFill = column.isToday ? 'var(--accent)' : 'var(--text-secondary)';
          const dayFill = column.isToday
            ? 'var(--accent)'
            : column.isFocus
              ? 'var(--text-default)'
              : 'var(--text-secondary)';
          return (
            <g key={`temporal-header-${column.epochDay}`}>
              <rect
                x={column.x}
                y={CALENDAR_TITLE_HEIGHT}
                width={column.width}
                height={CALENDAR_WEEKDAY_HEIGHT}
                fill={columnFill}
              />
              <line
                x1={column.x}
                y1={CALENDAR_TITLE_HEIGHT}
                x2={column.x}
                y2={frame.height}
                stroke="var(--border-subtle)"
                strokeWidth={1}
              />
              <text
                x={column.x + column.width / 2}
                y={CALENDAR_TITLE_HEIGHT + 13}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={weekdayFill}
                fontSize={10}
                fontWeight={column.isToday ? 700 : 600}
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                {column.weekdayLabel}
              </text>
              <text
                x={column.x + column.width / 2}
                y={CALENDAR_TITLE_HEIGHT + 25}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={dayFill}
                fontSize={11}
                fontWeight={column.isToday || column.isFocus ? 700 : 600}
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                {column.label}
              </text>
            </g>
          );
        })}
        <line
          x1={0}
          y1={CALENDAR_BODY_TOP}
          x2={frame.width}
          y2={CALENDAR_BODY_TOP}
          stroke="var(--border-default)"
          strokeWidth={1}
        />

        {temporal.columns.map((column) => (
          <g key={`temporal-body-${column.epochDay}`}>
            <rect
              x={column.x}
              y={frame.bodyTop}
              width={column.width}
              height={frame.height - frame.bodyTop}
              fill={
                column.isToday
                  ? 'color-mix(in srgb, var(--accent-muted) 18%, transparent)'
                  : 'transparent'
              }
            />
          </g>
        ))}

        <g clipPath={`url(#${scrollClipPathId})`}>
          <g transform={`translate(0, ${-temporal.scrollPx})`}>
            <rect
              x={0}
              y={temporal.allDayTop}
              width={frame.width}
              height={temporal.allDayHeight}
              fill="var(--surface-card)"
            />
            <line
              x1={0}
              y1={temporal.allDayTop + CALENDAR_DAY_ALL_DAY_HEADER_HEIGHT + CALENDAR_DAY_SECTION_PADDING}
              x2={frame.width}
              y2={temporal.allDayTop + CALENDAR_DAY_ALL_DAY_HEADER_HEIGHT + CALENDAR_DAY_SECTION_PADDING}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
            <line
              x1={0}
              y1={temporal.timelineTop}
              x2={frame.width}
              y2={temporal.timelineTop}
              stroke="var(--border-default)"
              strokeWidth={1}
            />
            <text
              x={16}
              y={temporal.allDayTop + CALENDAR_DAY_SECTION_PADDING + CALENDAR_DAY_ALL_DAY_HEADER_HEIGHT / 2}
              dominantBaseline="middle"
              fill="var(--text-secondary)"
              fontSize={11}
              fontWeight={600}
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              {t('layout.calendar.allDay' as never)}
            </text>
          </g>
        </g>

        {temporal.columns.length > 0 && (
          <line
            x1={temporal.columns[temporal.columns.length - 1].x + temporal.columns[temporal.columns.length - 1].width}
            y1={CALENDAR_TITLE_HEIGHT}
            x2={temporal.columns[temporal.columns.length - 1].x + temporal.columns[temporal.columns.length - 1].width}
            y2={frame.height}
            stroke="var(--border-subtle)"
            strokeWidth={1}
          />
        )}

        <g clipPath={`url(#${clipPathId})`}>
          {hourRows.map((hour) => {
            const y = temporal.timelineTop + hour * CALENDAR_DAY_HOUR_SLOT_HEIGHT - temporal.scrollPx;
            const isBoundary = hour < 24;
            return (
              <g key={`hour-${hour}`}>
                {isBoundary && (
                  <text
                    x={CALENDAR_DAY_ALL_DAY_LABEL_WIDTH - 10}
                    y={y + 2}
                    textAnchor="end"
                    dominantBaseline="hanging"
                    fill="var(--text-muted)"
                    fontSize={10}
                    fontWeight={500}
                    style={{ fontFamily: 'var(--font-ui)' }}
                  >
                    {formatHourLabel(hour)}
                  </text>
                )}
                <line
                  x1={CALENDAR_DAY_ALL_DAY_LABEL_WIDTH}
                  y1={y}
                  x2={frame.width}
                  y2={y}
                  stroke={hour === 0 || hour === 24 ? 'var(--border-default)' : 'var(--border-subtle)'}
                  strokeWidth={1}
                />
                {isBoundary && temporal.columns.map((column) => (
                  <line
                    key={`${column.epochDay}-${hour}-half`}
                    x1={column.x}
                    y1={y + CALENDAR_DAY_HOUR_SLOT_HEIGHT / 2}
                    x2={column.x + column.width}
                    y2={y + CALENDAR_DAY_HOUR_SLOT_HEIGHT / 2}
                    stroke="color-mix(in srgb, var(--border-subtle) 60%, transparent)"
                    strokeWidth={0.8}
                  />
                ))}
              </g>
            );
          })}

          {hasTodayColumn && nowY >= frame.bodyTop && nowY <= frame.height && (() => {
            const todayColumn = temporal.columns.find((column) => column.epochDay === todayEpochDay);
            if (!todayColumn) return null;
            return (
              <>
                <line
                  x1={todayColumn.x}
                  y1={nowY}
                  x2={todayColumn.x + todayColumn.width}
                  y2={nowY}
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                />
                <circle
                  cx={todayColumn.x}
                  cy={nowY}
                  r={4}
                  fill="var(--accent)"
                />
              </>
            );
          })()}
        </g>
      </svg>
    );
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <rect width="100%" height="100%" fill="var(--surface-base)" />

      <rect
        x={0}
        y={0}
        width={frame.width}
        height={CALENDAR_TITLE_HEIGHT}
        fill="var(--surface-panel)"
      />
      <rect
        x={0}
        y={CALENDAR_TITLE_HEIGHT}
        width={frame.width}
        height={CALENDAR_WEEKDAY_HEIGHT}
        fill="color-mix(in srgb, var(--surface-panel) 92%, transparent)"
      />
      <line
        x1={0}
        y1={CALENDAR_TITLE_HEIGHT}
        x2={frame.width}
        y2={CALENDAR_TITLE_HEIGHT}
        stroke="var(--border-subtle)"
        strokeWidth={1}
      />

      {frame.weekdayLabels.map((label, index) => {
        const x = index * frame.cellWidth;
        return (
          <g key={`weekday-${index}`}>
            <line
              x1={x}
              y1={CALENDAR_TITLE_HEIGHT}
              x2={x}
              y2={frame.height}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
            <text
              x={x + frame.cellWidth / 2}
              y={CALENDAR_TITLE_HEIGHT + CALENDAR_WEEKDAY_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--text-secondary)"
              fontSize={11}
              fontWeight={600}
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              {label}
            </text>
          </g>
        );
      })}

      {frame.cells.map((cell) => {
        const x = cell.column * frame.cellWidth;
        const y = CALENDAR_BODY_TOP + cell.row * frame.cellHeight;
        const fill = cell.isToday
          ? 'color-mix(in srgb, var(--accent-muted) 42%, var(--surface-card))'
          : cell.inCurrentMonth
            ? 'var(--surface-card)'
            : 'color-mix(in srgb, var(--surface-panel) 82%, transparent)';
        return (
          <g key={`cell-${cell.epochDay}`}>
            <rect
              x={x}
              y={y}
              width={frame.cellWidth}
              height={frame.cellHeight}
              fill={fill}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
            <text
              x={x + 10}
              y={y + 16}
              fill={cell.isToday ? 'var(--accent)' : cell.inCurrentMonth ? 'var(--text-default)' : 'var(--text-muted)'}
              fontSize={11}
              fontWeight={cell.isToday || cell.isFocus ? 700 : 500}
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              {cell.label}
            </text>
          </g>
        );
      })}

      <line
        x1={0}
        y1={CALENDAR_BODY_TOP}
        x2={frame.width}
        y2={CALENDAR_BODY_TOP}
        stroke="var(--border-default)"
        strokeWidth={1}
      />
    </svg>
  );
};
