/**
 * Timeline Scale Utilities — Calendar-based (date only)
 *
 * All time values are epoch days (days since 1970-01-01).
 * Axis always shows real dates: years, months, days.
 * Zoom level determines which granularity is visible.
 */

/** Convert Date to epoch days (local timezone) */
export function dateToEpochDays(d: Date): number {
  // Use local date components to avoid timezone offset issues
  const utcDate = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(utcDate / 86400000);
}

/** Convert epoch days to Date (local date, noon UTC to avoid boundary issues) */
export function epochDaysToDate(days: number): Date {
  const d = new Date(days * 86400000 + 43200000); // +12h to avoid timezone boundary
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Convert ISO date string to epoch days */
export function isoToEpochDays(iso: string): number | null {
  // Parse as local date: "2024-03-15" → local March 15
  const parts = iso.split('-');
  if (parts.length < 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return null;
  return dateToEpochDays(d);
}

/** Today in epoch days */
export function todayEpochDays(): number {
  return dateToEpochDays(new Date());
}

// ── Zoom level thresholds ──
// pixelsPerDay = PIXELS_PER_DAY * zoom
// At different pixelsPerDay ranges, show different granularity

export const PIXELS_PER_DAY = 4; // base: 4px per day at zoom=1

export type TimeGranularity = 'day' | 'month' | 'year' | 'decade';

/**
 * Determine the granularity based on current zoom.
 * Returns what the MINOR (lower header) and MAJOR (upper header) units should be.
 */
export function getGranularity(zoom: number): { major: TimeGranularity; minor: TimeGranularity } {
  const pxPerDay = PIXELS_PER_DAY * zoom;

  if (pxPerDay >= 15) {
    // Very zoomed in: show individual days, months as major
    return { major: 'month', minor: 'day' };
  } else if (pxPerDay >= 1.5) {
    // Medium: show months, years as major
    return { major: 'year', minor: 'month' };
  } else if (pxPerDay >= 0.1) {
    // Zoomed out: show years, decades as major
    return { major: 'decade', minor: 'year' };
  } else {
    // Very zoomed out: decades only
    return { major: 'decade', minor: 'decade' };
  }
}

// ── Header cell generation ──

export interface HeaderCell {
  label: string;
  screenX: number;
  screenWidth: number;
  epochDay: number; // start of this cell
}

/**
 * Generate header cells for the visible range.
 */
export function generateHeaderCells(params: {
  granularity: TimeGranularity;
  zoom: number;
  panX: number;
  canvasWidth: number;
  originDay: number;
}): HeaderCell[] {
  const { granularity, zoom, panX, canvasWidth, originDay } = params;
  const pxPerDay = PIXELS_PER_DAY * zoom;

  // Visible epoch-day range
  const leftDay = originDay + (-panX) / pxPerDay;
  const rightDay = originDay + (canvasWidth - panX) / pxPerDay;

  const cells: HeaderCell[] = [];
  const maxCells = 200;

  if (granularity === 'day') {
    const start = Math.floor(leftDay);
    const end = Math.ceil(rightDay);
    for (let d = start; d <= end && cells.length < maxCells; d++) {
      const date = epochDaysToDate(d);
      const screenX = (d - originDay) * pxPerDay + panX;
      const screenWidth = pxPerDay;
      cells.push({
        label: String(date.getDate()),
        screenX,
        screenWidth,
        epochDay: d,
      });
    }
  } else if (granularity === 'month') {
    // Start from the first day of the month containing leftDay
    const startDate = epochDaysToDate(Math.floor(leftDay));
    const endDate = epochDaysToDate(Math.ceil(rightDay));
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endTime = new Date(endDate.getFullYear(), endDate.getMonth() + 2, 1).getTime();

    while (current.getTime() < endTime && cells.length < maxCells) {
      const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      const startDay = dateToEpochDays(current);
      const endDay = dateToEpochDays(next);
      const screenX = (startDay - originDay) * pxPerDay + panX;
      const screenWidth = (endDay - startDay) * pxPerDay;

      cells.push({
        label: `${current.getMonth() + 1}월`,
        screenX,
        screenWidth,
        epochDay: startDay,
      });
      current = next;
    }
  } else if (granularity === 'year') {
    const startDate = epochDaysToDate(Math.floor(leftDay));
    const endDate = epochDaysToDate(Math.ceil(rightDay));
    let year = startDate.getFullYear();
    const endYear = endDate.getFullYear() + 2;

    while (year < endYear && cells.length < maxCells) {
      const startDay = dateToEpochDays(new Date(year, 0, 1));
      const endDay = dateToEpochDays(new Date(year + 1, 0, 1));
      const screenX = (startDay - originDay) * pxPerDay + panX;
      const screenWidth = (endDay - startDay) * pxPerDay;

      cells.push({
        label: `${year}`,
        screenX,
        screenWidth,
        epochDay: startDay,
      });
      year++;
    }
  } else if (granularity === 'decade') {
    const startDate = epochDaysToDate(Math.floor(leftDay));
    const endDate = epochDaysToDate(Math.ceil(rightDay));
    let decade = Math.floor(startDate.getFullYear() / 10) * 10;
    const endDecade = Math.floor(endDate.getFullYear() / 10) * 10 + 20;

    while (decade < endDecade && cells.length < maxCells) {
      const startDay = dateToEpochDays(new Date(decade, 0, 1));
      const endDay = dateToEpochDays(new Date(decade + 10, 0, 1));
      const screenX = (startDay - originDay) * pxPerDay + panX;
      const screenWidth = (endDay - startDay) * pxPerDay;

      cells.push({
        label: `${decade}s`,
        screenX,
        screenWidth,
        epochDay: startDay,
      });
      decade += 10;
    }
  }

  return cells;
}

/**
 * Convert screen X to epoch days.
 */
export function screenXToEpochDays(screenX: number, zoom: number, panX: number, originDay: number): number {
  const pxPerDay = PIXELS_PER_DAY * zoom;
  return originDay + (screenX - panX) / pxPerDay;
}

/**
 * Convert epoch days to screen X.
 */
export function epochDaysToScreenX(epochDay: number, zoom: number, panX: number, originDay: number): number {
  const pxPerDay = PIXELS_PER_DAY * zoom;
  return (epochDay - originDay) * pxPerDay + panX;
}
