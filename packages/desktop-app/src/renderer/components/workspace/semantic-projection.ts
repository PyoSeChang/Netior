import {
  semanticAnnotationToSystemSlot,
  systemSlotToSemanticAnnotation,
} from '@netior/shared/constants';
import type {
  ArchetypeField,
  SemanticFacetKey,
  SlotSemanticAnnotationKey,
  SystemSlotKey,
} from '@netior/shared/types';
import type { LayoutSemanticProjection } from './layout-plugins/types';
import { dateToEpochDays, isoToEpochDays } from './layout-plugins/horizontal-timeline/scale-utils';

interface ParsedTemporalMetadataValue {
  epochDay: number;
  minutesOfDay?: number;
  hasTime: boolean;
}

interface ParsedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}

interface ApplyConceptSemanticProjectionInput {
  metadata: Record<string, unknown>;
  schemaId?: string;
  facets?: SemanticFacetKey[];
  fields: ArchetypeField[];
  propertyValues: Map<string, string | null>;
}

const TEMPORAL_ANNOTATIONS = new Set<SlotSemanticAnnotationKey>([
  'time.start',
  'time.end',
  'time.due',
  'time.recurrence_until',
  'workflow.completed_at',
  'governance.approved_at',
]);

const NUMERIC_ANNOTATIONS = new Set<SlotSemanticAnnotationKey>([
  'workflow.progress',
  'workflow.estimate_value',
  'workflow.actual_value',
  'structure.order',
  'space.lat',
  'space.lng',
  'quant.measure_value',
  'quant.target_value',
  'quant.budget_amount',
  'quant.budget_limit',
  'time.recurrence_count',
]);

function toEpochDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function parseDateOnlyParts(value: string): ParsedDateTimeParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseDateTimeParts(value: string): (ParsedDateTimeParts & { hasExplicitZone: boolean }) | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    hasExplicitZone: !!match[6],
  };
}

function extractDateTimePartsInTimeZone(date: Date, timeZone: string): ParsedDateTimeParts | null {
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
      const part = parts.find((item) => item.type === type)?.value;
      return part ? Number(part) : null;
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

function parseTemporalMetadataValue(value: string, timeZone?: string | null): ParsedTemporalMetadataValue | null {
  const dateOnly = parseDateOnlyParts(value);
  if (dateOnly) {
    return {
      epochDay: toEpochDay(dateOnly.year, dateOnly.month, dateOnly.day),
      hasTime: false,
    };
  }

  const dateTimeParts = parseDateTimeParts(value);
  if (dateTimeParts) {
    if (!dateTimeParts.hasExplicitZone) {
      return {
        epochDay: toEpochDay(dateTimeParts.year, dateTimeParts.month, dateTimeParts.day),
        minutesOfDay: (dateTimeParts.hour ?? 0) * 60 + (dateTimeParts.minute ?? 0),
        hasTime: true,
      };
    }

    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      if (timeZone) {
        const zonedParts = extractDateTimePartsInTimeZone(parsed, timeZone);
        if (zonedParts) {
          return {
            epochDay: toEpochDay(zonedParts.year, zonedParts.month, zonedParts.day),
            minutesOfDay: (zonedParts.hour ?? 0) * 60 + (zonedParts.minute ?? 0),
            hasTime: true,
          };
        }
      }
      return {
        epochDay: dateToEpochDays(parsed),
        minutesOfDay: parsed.getHours() * 60 + parsed.getMinutes(),
        hasTime: true,
      };
    }
  }

  const fallbackEpochDay = isoToEpochDays(value);
  return fallbackEpochDay == null ? null : { epochDay: fallbackEpochDay, hasTime: false };
}

function parseBooleanMetadataValue(value: string): boolean | null {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}

function parseNumericMetadataValue(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSemanticValue(
  field: ArchetypeField,
  annotation: SlotSemanticAnnotationKey,
  rawValue: string,
  timeZone?: string | null,
): {
  value: unknown;
  temporal?: ParsedTemporalMetadataValue;
} {
  if (annotation === 'time.all_day') {
    return { value: parseBooleanMetadataValue(rawValue) ?? rawValue === 'true' };
  }

  if (TEMPORAL_ANNOTATIONS.has(annotation)) {
    const temporal = parseTemporalMetadataValue(rawValue, timeZone);
    if (temporal) {
      return { value: temporal.epochDay, temporal };
    }
  }

  if (
    field.field_type === 'number'
    || field.field_type === 'rating'
    || NUMERIC_ANNOTATIONS.has(annotation)
  ) {
    return { value: parseNumericMetadataValue(rawValue) ?? rawValue };
  }

  return { value: rawValue };
}

export function applyConceptSemanticProjection({
  metadata,
  schemaId,
  facets,
  fields,
  propertyValues,
}: ApplyConceptSemanticProjectionInput): LayoutSemanticProjection {
  const semantic: LayoutSemanticProjection = {
    schemaId,
    facets: facets ?? [],
    slots: {},
    slotFieldIds: {},
    legacySlotFieldIds: {},
    legacySlotFieldTypes: {},
  };
  const rawValuesByAnnotation = new Map<SlotSemanticAnnotationKey, string>();

  for (const field of fields) {
    const annotation = field.semantic_annotation ?? systemSlotToSemanticAnnotation(field.system_slot);
    if (!annotation) continue;
    const legacySlot = field.system_slot ?? semanticAnnotationToSystemSlot(annotation);
    semantic.slotFieldIds[annotation] = field.id;
    if (legacySlot) {
      semantic.legacySlotFieldIds[legacySlot] = field.id;
      semantic.legacySlotFieldTypes[legacySlot] = field.field_type;
    }

    const rawValue = propertyValues.get(field.id);
    if (rawValue == null) continue;
    rawValuesByAnnotation.set(annotation, rawValue);
  }

  const timeZone = rawValuesByAnnotation.get('time.timezone');
  for (const field of fields) {
    const annotation = field.semantic_annotation ?? systemSlotToSemanticAnnotation(field.system_slot);
    if (!annotation) continue;
    const rawValue = propertyValues.get(field.id);
    if (rawValue == null) continue;

    const legacySlot = field.system_slot ?? semanticAnnotationToSystemSlot(annotation);
    const parsed = parseSemanticValue(field, annotation, rawValue, timeZone);
    semantic.slots[annotation] = {
      annotation,
      fieldId: field.id,
      fieldType: field.field_type,
      rawValue,
      value: parsed.value,
      legacySlot,
    };
    if (legacySlot) {
      metadata[legacySlot] = parsed.value;
      if (parsed.temporal) {
        if (typeof parsed.temporal.minutesOfDay === 'number') {
          metadata[`${legacySlot}_minutes`] = parsed.temporal.minutesOfDay;
        }
        if (parsed.temporal.hasTime) {
          metadata[`${legacySlot}_has_time`] = true;
        }
      }
    }
  }

  if (Object.keys(semantic.legacySlotFieldIds).length > 0) {
    metadata.__slotFieldIds = semantic.legacySlotFieldIds;
  }
  if (Object.keys(semantic.legacySlotFieldTypes).length > 0) {
    metadata.__slotFieldTypes = semantic.legacySlotFieldTypes;
  }
  if (Object.keys(semantic.slotFieldIds).length > 0) {
    metadata.__semanticSlotFieldIds = semantic.slotFieldIds;
  }
  if (propertyValues.size > 0) {
    metadata.__fieldValues = Object.fromEntries(propertyValues);
  }

  return semantic;
}
