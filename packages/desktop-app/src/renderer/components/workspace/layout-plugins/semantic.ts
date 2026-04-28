import { meaningBindingToMeaningSlot } from '@netior/shared/constants';
import type { FieldMeaningBindingKey, FieldMeaningKey } from '@netior/shared/types';
import type { LayoutRenderNode } from './types';

export function getMeaningBindingValues(node: LayoutRenderNode, meaning: FieldMeaningBindingKey): unknown[] {
  const projected = node.semantic?.meaningBindings[meaning];
  if (projected && projected.length > 0) return projected.map((slot) => slot.value);
  return [];
}

export function getMeaningBindingValue(node: LayoutRenderNode, meaning: FieldMeaningBindingKey): unknown {
  const projected = node.semantic?.meaningBindings[meaning]?.[0];
  if (projected) return projected.value;

  const meaningSlot = meaningBindingToMeaningSlot(meaning);
  return meaningSlot ? node.metadata[meaningSlot] : undefined;
}

export function getMeaningBindingRawValue(node: LayoutRenderNode, meaning: FieldMeaningBindingKey): string | null | undefined {
  const projected = node.semantic?.meaningBindings[meaning]?.[0];
  if (projected) return projected.rawValue;

  const fieldId = getMeaningBindingFieldIds(node, meaning)[0];
  const fieldValues = node.metadata.__fieldValues;
  if (!fieldId || typeof fieldValues !== 'object' || fieldValues == null) return undefined;
  return (fieldValues as Record<string, string | null | undefined>)[fieldId];
}

export function getMeaningBindingFieldIds(node: LayoutRenderNode, meaning: FieldMeaningBindingKey): string[] {
  const projected = node.semantic?.meaningFieldIds[meaning];
  if (projected && projected.length > 0) return projected;

  const meaningIds = node.metadata.__meaningFieldIds;
  if (typeof meaningIds === 'object' && meaningIds != null) {
    const fieldIds = (meaningIds as Record<string, unknown>)[meaning];
    if (Array.isArray(fieldIds)) return fieldIds.filter((item): item is string => typeof item === 'string');
  }

  const semanticIds = node.metadata.__semanticSlotFieldIds;
  if (typeof semanticIds === 'object' && semanticIds != null) {
    const fieldId = (semanticIds as Record<string, unknown>)[meaning];
    if (typeof fieldId === 'string') return [fieldId];
  }

  const meaningSlot = meaningBindingToMeaningSlot(meaning);
  const fallbackIds = node.metadata.__slotFieldIds;
  if (!meaningSlot || typeof fallbackIds !== 'object' || fallbackIds == null) return [];
  const fieldId = (fallbackIds as Record<string, unknown>)[meaningSlot];
  return typeof fieldId === 'string' ? [fieldId] : [];
}

export function getMeaningBindingFieldId(node: LayoutRenderNode, meaning: FieldMeaningBindingKey): string | undefined {
  return getMeaningBindingFieldIds(node, meaning)[0];
}

export const getSemanticSlotValue = getMeaningBindingValue;
export const getSemanticSlotRawValue = getMeaningBindingRawValue;
export const getSemanticSlotFieldId = getMeaningBindingFieldId;

export function getSemanticNumber(node: LayoutRenderNode, annotation: FieldMeaningKey): number | undefined {
  const value = getMeaningBindingValue(node, annotation);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getSemanticBoolean(node: LayoutRenderNode, annotation: FieldMeaningKey): boolean | undefined {
  const value = getMeaningBindingValue(node, annotation);
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}
