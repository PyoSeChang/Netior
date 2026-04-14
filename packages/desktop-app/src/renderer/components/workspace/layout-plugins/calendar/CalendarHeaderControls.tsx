import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { Button } from '@renderer/components/ui/Button';
import { useI18n } from '@renderer/hooks/useI18n';
import type { LayoutControlsRendererProps, LayoutResolvedControlItem } from '../types';
import { CalendarDatePicker } from './CalendarDatePicker';
import {
  buildCalendarGrid,
  normalizeCalendarView,
  normalizeFocusEpochDay,
  normalizeWeekStartsOn,
} from './calendar-utils';

function findItem(items: LayoutResolvedControlItem[], key: string): LayoutResolvedControlItem | undefined {
  return items.find((item) => item.key === key);
}

function iconButtonClass(active = false): string {
  return [
    'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
    active
      ? 'bg-surface-card text-accent ring-1 ring-border-subtle'
      : 'text-secondary hover:bg-surface-hover hover:text-default',
  ].join(' ');
}

export const CalendarHeaderControls: React.FC<LayoutControlsRendererProps> = ({
  config,
  extraItems = [],
  setZoom,
  setPanX,
  setPanY,
  updateConfig,
}) => {
  const { t } = useI18n();
  const knownKeys = new Set([
    'calendar-previous',
    'calendar-today',
    'calendar-next',
    'calendar-day',
    'calendar-week',
    'calendar-month',
  ]);

  const previousItem = findItem(extraItems, 'calendar-previous');
  const todayItem = findItem(extraItems, 'calendar-today');
  const nextItem = findItem(extraItems, 'calendar-next');
  const dayItem = findItem(extraItems, 'calendar-day');
  const weekItem = findItem(extraItems, 'calendar-week');
  const monthItem = findItem(extraItems, 'calendar-month');
  const trailingItems = useMemo(
    () => extraItems.filter((item) => !knownKeys.has(item.key)),
    [extraItems],
  );

  const currentView = normalizeCalendarView(config.view);
  const focusEpochDay = normalizeFocusEpochDay(config._focusEpochDay);
  const weekStartsOn = normalizeWeekStartsOn(config.weekStartsOn);
  const calendarModel = useMemo(
    () => buildCalendarGrid({
      view: currentView,
      focusEpochDay,
      weekStartsOn,
    }),
    [focusEpochDay, weekStartsOn, currentView],
  );
  const jumpButtonLabel = currentView === 'day'
    ? t('layout.calendar.now' as never)
    : (todayItem?.label ?? t('layout.calendar.today' as never));

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex h-10 items-center justify-between gap-4 px-4"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="truncate text-[15px] font-semibold text-default">
          {calendarModel.title}
        </div>
        <div className="flex items-center gap-0.5">
          <CalendarDatePicker
            focusEpochDay={focusEpochDay}
            weekStartsOn={weekStartsOn}
            onSelect={(epochDay) => {
              setZoom(1);
              setPanX(0);
              setPanY(0);
              void updateConfig((current) => ({
                ...current,
                _focusEpochDay: epochDay,
              }));
            }}
          />
          {previousItem && (
            <Tooltip content={previousItem.label} position="bottom">
              <button type="button" className={iconButtonClass()} onClick={previousItem.onClick}>
                <ChevronLeft size={14} />
              </button>
            </Tooltip>
          )}
          {todayItem && (
            <Tooltip content={jumpButtonLabel} position="bottom">
              <button
                type="button"
                className="flex h-8 items-center justify-center rounded-md border border-default bg-surface-base px-3 text-[11px] font-semibold text-default transition-colors hover:bg-surface-hover"
                onClick={todayItem.onClick}
              >
                {jumpButtonLabel}
              </button>
            </Tooltip>
          )}
          {nextItem && (
            <Tooltip content={nextItem.label} position="bottom">
              <button type="button" className={iconButtonClass()} onClick={nextItem.onClick}>
                <ChevronRight size={14} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {trailingItems.length > 0 && (
          <div className="flex items-center gap-0.5">
            {trailingItems.map((item) => (
              <Tooltip key={item.key} content={item.label} position="bottom">
                <button
                  type="button"
                  className={iconButtonClass(item.active)}
                  onClick={item.onClick}
                >
                  {item.icon}
                </button>
              </Tooltip>
            ))}
          </div>
        )}
        <div className="flex items-center rounded-lg border border-subtle bg-surface-base p-0.5">
          {dayItem && (
            <Tooltip content={dayItem.label} position="bottom">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isActive={dayItem.active ?? currentView === 'day'}
                className="min-w-7 rounded-md px-2 text-[11px] font-semibold tracking-[0.04em]"
                onClick={dayItem.onClick}
              >
                D
              </Button>
            </Tooltip>
          )}
          {weekItem && (
            <Tooltip content={weekItem.label} position="bottom">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isActive={weekItem.active ?? currentView === 'week'}
                className="min-w-7 rounded-md px-2 text-[11px] font-semibold tracking-[0.04em]"
                onClick={weekItem.onClick}
              >
                W
              </Button>
            </Tooltip>
          )}
          {monthItem && (
            <Tooltip content={monthItem.label} position="bottom">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isActive={monthItem.active ?? currentView === 'month'}
                className="min-w-7 rounded-md px-2 text-[11px] font-semibold tracking-[0.04em]"
                onClick={monthItem.onClick}
              >
                M
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};
