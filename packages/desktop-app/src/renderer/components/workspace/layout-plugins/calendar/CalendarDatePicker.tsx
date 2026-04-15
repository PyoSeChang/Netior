import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildCalendarGrid,
  epochDaysToDate,
  normalizeFocusEpochDay,
  shiftFocusEpochDay,
} from './calendar-utils';

interface CalendarDatePickerProps {
  focusEpochDay: number;
  weekStartsOn: 0 | 1;
  onSelect: (epochDay: number) => void;
}

function formatButtonLabel(epochDay: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(epochDaysToDate(epochDay));
}

export const CalendarDatePicker: React.FC<CalendarDatePickerProps> = ({
  focusEpochDay,
  weekStartsOn,
  onSelect,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pickerMonthFocus, setPickerMonthFocus] = useState(focusEpochDay);

  useEffect(() => {
    if (open) {
      setPickerMonthFocus(focusEpochDay);
    }
  }, [focusEpochDay, open]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  const grid = useMemo(
    () => buildCalendarGrid({
      view: 'month',
      focusEpochDay: pickerMonthFocus,
      weekStartsOn,
    }),
    [pickerMonthFocus, weekStartsOn],
  );

  const selectedEpochDay = normalizeFocusEpochDay(focusEpochDay);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="inline-flex h-8 items-center gap-2 rounded-md border border-default bg-surface-base px-3 text-[11px] font-semibold text-default transition-colors hover:bg-surface-hover"
        onClick={() => setOpen((value) => !value)}
      >
        <CalendarDays size={13} />
        <span>{formatButtonLabel(selectedEpochDay)}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-40 w-[280px] rounded-xl border border-subtle bg-surface-panel p-3 shadow-lg">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface-hover hover:text-default"
              onClick={() => setPickerMonthFocus((value) => shiftFocusEpochDay('month', value, -1))}
            >
              <ChevronLeft size={14} />
            </button>
            <div className="text-sm font-semibold text-default">
              {grid.title}
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface-hover hover:text-default"
              onClick={() => setPickerMonthFocus((value) => shiftFocusEpochDay('month', value, 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {grid.weekdayLabels.map((label) => (
              <div
                key={label}
                className="flex h-7 items-center justify-center text-[10px] font-semibold text-secondary"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.cells.map((cell) => {
              const isSelected = cell.epochDay === selectedEpochDay;
              return (
                <button
                  key={cell.epochDay}
                  type="button"
                  className={[
                    'flex h-8 items-center justify-center rounded-md text-[11px] font-medium transition-colors',
                    isSelected
                      ? 'bg-accent text-on-accent'
                      : cell.isToday
                        ? 'bg-accent-muted text-default'
                        : cell.inCurrentMonth
                          ? 'text-default hover:bg-surface-hover'
                          : 'text-muted hover:bg-surface-hover',
                  ].join(' ')}
                  onClick={() => {
                    onSelect(cell.epochDay);
                    setOpen(false);
                  }}
                >
                  {cell.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
