import type { LayoutRenderNode } from './types';
import { getSemanticBoolean, getSemanticNumber, getSemanticSlotValue } from './semantic';

interface RecurrenceDefinition {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  byDay: number[] | null;
  untilEpochDay: number | null;
  untilMinutes: number | null;
  count: number | null;
}

interface TemporalDuration {
  startEpochDay: number;
  startMinutes: number;
  endEpochDay: number;
  endMinutes: number;
  durationMinutes: number;
  isTimed: boolean;
}

function buildOccurrenceKey(epochDay: number, minutesOfDay: number): string {
  return `${epochDay}:${minutesOfDay}`;
}

function epochDayToDate(epochDay: number): Date {
  const date = new Date(epochDay * 86400000 + 43200000);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function epochDayFromParts(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function getWeekStartEpochDay(epochDay: number): number {
  const date = epochDayToDate(epochDay);
  return epochDay - date.getDay();
}

function getLastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function parseByDayToken(token: string): number | null {
  switch (token) {
    case 'SU': return 0;
    case 'MO': return 1;
    case 'TU': return 2;
    case 'WE': return 3;
    case 'TH': return 4;
    case 'FR': return 5;
    case 'SA': return 6;
    default: return null;
  }
}

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getZonedDateTimeParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: Intl.DateTimeFormatPartTypes): number | null => {
      const value = parts.find((part) => part.type === type)?.value;
      return value ? Number(value) : null;
    };
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');
    if (year == null || month == null || day == null || hour == null || minute == null) {
      return null;
    }
    return { year, month, day, hour, minute };
  } catch {
    return null;
  }
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number | null {
  const zoned = getZonedDateTimeParts(date, timeZone);
  if (!zoned) return null;
  const utcFromZoned = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
  return Math.round((utcFromZoned - date.getTime()) / 60000);
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const remainder = absMinutes % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function resolveZonedInstant(
  epochDay: number,
  minutesOfDay: number,
  timeZone: string,
): { date: Date; offsetMinutes: number } | null {
  const baseDate = epochDayToDate(epochDay);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() + 1;
  const day = baseDate.getDate();
  let guess = new Date(Date.UTC(year, month - 1, day, Math.floor(minutesOfDay / 60), minutesOfDay % 60));

  for (let i = 0; i < 3; i += 1) {
    const zoned = getZonedDateTimeParts(guess, timeZone);
    if (!zoned) return null;
    const desiredUtc = Date.UTC(year, month - 1, day, Math.floor(minutesOfDay / 60), minutesOfDay % 60);
    const actualUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
    const diffMinutes = Math.round((desiredUtc - actualUtc) / 60000);
    if (diffMinutes === 0) break;
    guess = new Date(guess.getTime() + diffMinutes * 60000);
  }

  const offsetMinutes = getTimeZoneOffsetMinutes(guess, timeZone);
  if (offsetMinutes == null) return null;
  return { date: guess, offsetMinutes };
}

function parseTemporalLimit(rawValue: unknown, fallbackMinutes = 0): { epochDay: number; minutes: number } | null {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return null;
  return {
    epochDay: rawValue,
    minutes: fallbackMinutes,
  };
}

function parseRecurrenceDefinition(node: LayoutRenderNode): RecurrenceDefinition | null {
  const rawRule = getSemanticSlotValue(node, 'time.recurrence_rule');
  if (typeof rawRule !== 'string' || rawRule.trim() === '') return null;

  const params = rawRule
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [key, ...rest] = part.split('=');
      if (!key || rest.length === 0) return acc;
      acc[key.toUpperCase()] = rest.join('=');
      return acc;
    }, {});

  const freq = params.FREQ?.toUpperCase();
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') {
    return null;
  }

  const interval = Math.max(1, Number(params.INTERVAL ?? '1') || 1);
  const byDay = params.BYDAY
    ? params.BYDAY.split(',').map((token) => parseByDayToken(token.trim().toUpperCase())).filter((value): value is number => value != null)
    : null;

  const untilEpochDay = getSemanticNumber(node, 'time.recurrence_until') ?? null;
  const untilMinutes = typeof node.metadata.recurrence_until_minutes === 'number'
    ? Number(node.metadata.recurrence_until_minutes)
    : null;
  const recurrenceCount = getSemanticNumber(node, 'time.recurrence_count');
  const count = recurrenceCount == null ? null : Math.max(1, Math.floor(recurrenceCount));

  return {
    freq,
    interval,
    byDay: byDay && byDay.length > 0 ? byDay : null,
    untilEpochDay,
    untilMinutes,
    count,
  };
}

function resolveTemporalDuration(node: LayoutRenderNode): TemporalDuration | null {
  const startEpochDay = getSemanticNumber(node, 'time.start');
  if (startEpochDay == null) return null;

  const endEpochDayRaw = getSemanticNumber(node, 'time.end');
  const endEpochDay = endEpochDayRaw != null ? Math.max(startEpochDay, endEpochDayRaw) : startEpochDay;
  const startMinutes = typeof node.metadata.start_at_minutes === 'number' ? Number(node.metadata.start_at_minutes) : 0;
  const endMinutes = typeof node.metadata.end_at_minutes === 'number' ? Number(node.metadata.end_at_minutes) : startMinutes;
  const isAllDay = getSemanticBoolean(node, 'time.all_day') === true;
  const isTimed = !isAllDay && (node.metadata.start_at_has_time === true || node.metadata.end_at_has_time === true);
  const startAbs = startEpochDay * 1440 + (isTimed ? startMinutes : 0);
  let endAbs = endEpochDay * 1440 + (isTimed ? endMinutes : 1440);

  if (!endEpochDayRaw && isTimed) {
    endAbs = startAbs + 60;
  }
  if (endAbs <= startAbs) {
    endAbs = isTimed ? startAbs + 60 : (endEpochDay + 1) * 1440;
  }

  return {
    startEpochDay,
    startMinutes,
    endEpochDay,
    endMinutes,
    durationMinutes: endAbs - startAbs,
    isTimed,
  };
}

function createOccurrenceNode(
  source: LayoutRenderNode,
  occurrenceIndex: number,
  startAbsMinute: number,
  durationMinutes: number,
): LayoutRenderNode {
  const occurrenceStartDay = Math.floor(startAbsMinute / 1440);
  const occurrenceStartMinute = ((startAbsMinute % 1440) + 1440) % 1440;
  const endAbsMinute = startAbsMinute + durationMinutes;
  const occurrenceEndDay = Math.floor(endAbsMinute / 1440);
  const occurrenceEndMinute = ((endAbsMinute % 1440) + 1440) % 1440;
  const isTimed = source.metadata.all_day !== true && (
    source.metadata.start_at_has_time === true || source.metadata.end_at_has_time === true
  );
  const occurrenceKey = buildOccurrenceKey(
    occurrenceStartDay,
    isTimed ? occurrenceStartMinute : 0,
  );

  return {
    ...source,
    id: `${source.id}::occurrence::${occurrenceStartDay}::${occurrenceIndex}`,
    semantic: undefined,
    metadata: {
      ...source.metadata,
      start_at: occurrenceStartDay,
      end_at: occurrenceEndDay,
      start_at_minutes: isTimed ? occurrenceStartMinute : undefined,
      end_at_minutes: isTimed ? occurrenceEndMinute : undefined,
      start_at_has_time: isTimed ? source.metadata.start_at_has_time === true : false,
      end_at_has_time: isTimed ? source.metadata.end_at_has_time === true : false,
      __sourceNodeId: source.id,
      __virtualOccurrence: true,
      __readOnlyOccurrence: true,
      __occurrenceIndex: occurrenceIndex,
      __occurrenceKey: occurrenceKey,
    },
  };
}

function shouldIncludeOccurrence(
  startAbsMinute: number,
  durationMinutes: number,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  const endAbsMinute = startAbsMinute + durationMinutes;
  return endAbsMinute > rangeStart * 1440 && startAbsMinute < rangeEnd * 1440;
}

function projectDailyOrWeeklyOccurrences(
  node: LayoutRenderNode,
  recurrence: RecurrenceDefinition,
  duration: TemporalDuration,
  rangeStart: number,
  rangeEnd: number,
): LayoutRenderNode[] {
  const occurrences: LayoutRenderNode[] = [];
  const startAbs = duration.startEpochDay * 1440 + (duration.isTimed ? duration.startMinutes : 0);
  const sourceWeekStart = getWeekStartEpochDay(duration.startEpochDay);
  const sourceWeekday = epochDayToDate(duration.startEpochDay).getDay();
  const allowedWeekdays = recurrence.byDay ?? [sourceWeekday];
  let occurrenceIndex = 0;
  let cursorDay = duration.startEpochDay;

  while (cursorDay < rangeEnd + 366) {
    const cursorDate = epochDayToDate(cursorDay);
    const cursorWeekday = cursorDate.getDay();
    const qualifiesDaily = recurrence.freq === 'DAILY'
      && ((cursorDay - duration.startEpochDay) % recurrence.interval === 0);
    const qualifiesWeekly = recurrence.freq === 'WEEKLY'
      && ((getWeekStartEpochDay(cursorDay) - sourceWeekStart) / 7) % recurrence.interval === 0
      && allowedWeekdays.includes(cursorWeekday);

    if ((qualifiesDaily || qualifiesWeekly) && cursorDay >= duration.startEpochDay) {
      const occurrenceStartAbs = cursorDay * 1440 + (duration.isTimed ? duration.startMinutes : 0);

      if (recurrence.untilEpochDay != null) {
        const untilAbs = recurrence.untilEpochDay * 1440 + (recurrence.untilMinutes ?? 1439);
        if (occurrenceStartAbs > untilAbs) {
          break;
        }
      }

      occurrenceIndex += 1;
      if (recurrence.count != null && occurrenceIndex > recurrence.count) {
        break;
      }

      if (shouldIncludeOccurrence(occurrenceStartAbs, duration.durationMinutes, rangeStart, rangeEnd)) {
        occurrences.push(createOccurrenceNode(node, occurrenceIndex, occurrenceStartAbs, duration.durationMinutes));
      }
    }

    cursorDay += 1;
    if (cursorDay > rangeEnd && recurrence.count == null && recurrence.untilEpochDay == null && occurrences.length > 0) {
      break;
    }
  }

  return occurrences;
}

function projectMonthlyOccurrences(
  node: LayoutRenderNode,
  recurrence: RecurrenceDefinition,
  duration: TemporalDuration,
  rangeStart: number,
  rangeEnd: number,
): LayoutRenderNode[] {
  const occurrences: LayoutRenderNode[] = [];
  const startDate = epochDayToDate(duration.startEpochDay);
  const targetDay = startDate.getDate();
  let occurrenceIndex = 0;
  let monthCursor = 0;

  while (monthCursor < 240) {
    const year = startDate.getFullYear();
    const monthIndex = startDate.getMonth() + monthCursor * recurrence.interval;
    const normalizedYear = year + Math.floor(monthIndex / 12);
    const normalizedMonth = ((monthIndex % 12) + 12) % 12;
    const day = Math.min(targetDay, getLastDayOfMonth(normalizedYear, normalizedMonth));
    const occurrenceEpochDay = epochDayFromParts(normalizedYear, normalizedMonth + 1, day);
    const occurrenceStartAbs = occurrenceEpochDay * 1440 + (duration.isTimed ? duration.startMinutes : 0);

    if (occurrenceEpochDay < duration.startEpochDay) {
      monthCursor += 1;
      continue;
    }

    if (recurrence.untilEpochDay != null) {
      const untilAbs = recurrence.untilEpochDay * 1440 + (recurrence.untilMinutes ?? 1439);
      if (occurrenceStartAbs > untilAbs) {
        break;
      }
    }

    occurrenceIndex += 1;
    if (recurrence.count != null && occurrenceIndex > recurrence.count) {
      break;
    }

    if (shouldIncludeOccurrence(occurrenceStartAbs, duration.durationMinutes, rangeStart, rangeEnd)) {
      occurrences.push(createOccurrenceNode(node, occurrenceIndex, occurrenceStartAbs, duration.durationMinutes));
    }

    if (occurrenceEpochDay > rangeEnd && recurrence.count == null && recurrence.untilEpochDay == null && occurrences.length > 0) {
      break;
    }

    monthCursor += 1;
  }

  return occurrences;
}

export function projectRecurringTemporalNodes(
  nodes: LayoutRenderNode[],
  rangeStart: number,
  rangeEnd: number,
): LayoutRenderNode[] {
  const materializedKeysBySourceConceptId = new Map<string, Set<string>>();
  for (const node of nodes) {
    const sourceConceptId = typeof node.metadata.__recurrenceSourceConceptId === 'string'
      ? node.metadata.__recurrenceSourceConceptId
      : null;
    const occurrenceKey = typeof node.metadata.__occurrenceKey === 'string'
      ? node.metadata.__occurrenceKey
      : null;
    if (!sourceConceptId || !occurrenceKey) continue;

    const keys = materializedKeysBySourceConceptId.get(sourceConceptId) ?? new Set<string>();
    keys.add(occurrenceKey);
    materializedKeysBySourceConceptId.set(sourceConceptId, keys);
  }

  const projected: LayoutRenderNode[] = [];

  for (const node of nodes) {
    const recurrence = parseRecurrenceDefinition(node);
    const duration = resolveTemporalDuration(node);
    if (!recurrence || !duration) {
      projected.push(node);
      continue;
    }

    const occurrences = recurrence.freq === 'MONTHLY'
      ? projectMonthlyOccurrences(node, recurrence, duration, rangeStart, rangeEnd)
      : projectDailyOrWeeklyOccurrences(node, recurrence, duration, rangeStart, rangeEnd);
    const materializedKeys = node.conceptId
      ? materializedKeysBySourceConceptId.get(node.conceptId)
      : undefined;
    const visibleOccurrences = materializedKeys
      ? occurrences.filter((occurrence) => {
        const occurrenceKey = typeof occurrence.metadata.__occurrenceKey === 'string'
          ? occurrence.metadata.__occurrenceKey
          : null;
        return !occurrenceKey || !materializedKeys.has(occurrenceKey);
      })
      : occurrences;

    if (visibleOccurrences.length === 0) {
      continue;
    }

    projected.push(...visibleOccurrences);
  }

  return projected;
}

export function getSourceNodeId(node: LayoutRenderNode): string {
  const sourceId = node.metadata.__sourceNodeId;
  return typeof sourceId === 'string' && sourceId ? sourceId : node.id;
}

export function isReadOnlyOccurrence(node: LayoutRenderNode): boolean {
  return node.metadata.__readOnlyOccurrence === true;
}

export function getOccurrenceKey(node: LayoutRenderNode): string | null {
  const occurrenceKey = node.metadata.__occurrenceKey;
  return typeof occurrenceKey === 'string' && occurrenceKey ? occurrenceKey : null;
}

export function formatTemporalSlotValueForWriteback(
  node: LayoutRenderNode,
  slot: 'start_at' | 'end_at',
  epochDay: number,
  minutesOfDay?: number,
  forceDateOnly = false,
): string {
  const date = epochDayToDate(epochDay);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const supportsTime = node.metadata.__slotFieldTypes
    && typeof node.metadata.__slotFieldTypes === 'object'
    && (node.metadata.__slotFieldTypes as Record<string, string>)[slot] === 'datetime';
  const isAllDay = getSemanticBoolean(node, 'time.all_day') === true;
  const timeZoneValue = getSemanticSlotValue(node, 'time.timezone');
  const timeZone = typeof timeZoneValue === 'string' && timeZoneValue.trim() !== ''
    ? timeZoneValue.trim()
    : null;

  if (forceDateOnly || isAllDay || !supportsTime || typeof minutesOfDay !== 'number') {
    return `${year}-${month}-${day}`;
  }

  const safeMinutes = Math.max(0, Math.min(1439, minutesOfDay));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (!timeZone) {
    return `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const zonedInstant = resolveZonedInstant(epochDay, safeMinutes, timeZone);
  if (!zonedInstant) {
    return `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}${formatOffset(zonedInstant.offsetMinutes)}`;
}

export function hasRecurrence(node: LayoutRenderNode): boolean {
  const recurrenceRule = getSemanticSlotValue(node, 'time.recurrence_rule');
  return typeof recurrenceRule === 'string' && recurrenceRule.trim() !== '';
}

export function isDateOnlyTemporalValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && isDateOnlyString(value);
}
