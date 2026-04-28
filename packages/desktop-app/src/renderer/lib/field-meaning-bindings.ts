import { meaningBindingToMeaningSlot } from '@netior/shared/constants';
import type { SchemaField, MeaningSlotKey } from '@netior/shared/types';

export function getFieldMeaningSlot(field: Pick<SchemaField, 'meaning_bindings'>): MeaningSlotKey | null {
  for (const binding of field.meaning_bindings) {
    const slot = meaningBindingToMeaningSlot(binding);
    if (slot) return slot;
  }
  return null;
}

export function fieldHasMeaningSlot(
  field: Pick<SchemaField, 'meaning_bindings'>,
  slot: MeaningSlotKey,
): boolean {
  return field.meaning_bindings.some((binding) => meaningBindingToMeaningSlot(binding) === slot);
}
