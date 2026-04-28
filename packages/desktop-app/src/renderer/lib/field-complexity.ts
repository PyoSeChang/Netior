import type { FieldType } from '@netior/shared/types';
import type { FieldComplexityLevel } from '../stores/settings-store';

const LEVEL_RANK: Record<FieldComplexityLevel, number> = {
  basic: 0,
  standard: 1,
  advanced: 2,
};

export const FIELD_TYPE_MIN_LEVEL: Record<FieldType, FieldComplexityLevel> = {
  text: 'basic',
  textarea: 'basic',
  number: 'basic',
  boolean: 'basic',
  date: 'basic',
  datetime: 'basic',
  select: 'basic',
  'multi-select': 'basic',
  radio: 'basic',
  file: 'standard',
  url: 'standard',
  color: 'standard',
  rating: 'standard',
  tags: 'standard',
  schema_ref: 'standard',
  relation: 'advanced',
};

export function isFieldTypeVisibleAtLevel(type: FieldType, level: FieldComplexityLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[FIELD_TYPE_MIN_LEVEL[type]];
}

export function getHiddenFieldTypeCount(level: FieldComplexityLevel): number {
  return (Object.keys(FIELD_TYPE_MIN_LEVEL) as FieldType[]).filter((type) => !isFieldTypeVisibleAtLevel(type, level)).length;
}
