import { describe, expect, it } from 'vitest';
import { getHiddenFieldTypeCount, isFieldTypeVisibleAtLevel } from '../lib/field-complexity';

describe('field complexity visibility', () => {
  it('shows only beginner-safe field types at basic level', () => {
    expect(isFieldTypeVisibleAtLevel('text', 'basic')).toBe(true);
    expect(isFieldTypeVisibleAtLevel('multi-select', 'basic')).toBe(true);
    expect(isFieldTypeVisibleAtLevel('schema_ref', 'basic')).toBe(false);
    expect(isFieldTypeVisibleAtLevel('relation', 'basic')).toBe(false);
  });

  it('shows concept-backed selection at standard level but keeps relation hidden', () => {
    expect(isFieldTypeVisibleAtLevel('schema_ref', 'standard')).toBe(true);
    expect(isFieldTypeVisibleAtLevel('file', 'standard')).toBe(true);
    expect(isFieldTypeVisibleAtLevel('relation', 'standard')).toBe(false);
  });

  it('shows every type at advanced level', () => {
    expect(isFieldTypeVisibleAtLevel('relation', 'advanced')).toBe(true);
    expect(getHiddenFieldTypeCount('advanced')).toBe(0);
  });
});
