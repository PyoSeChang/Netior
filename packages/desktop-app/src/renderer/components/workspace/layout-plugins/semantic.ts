import { semanticAnnotationToSystemSlot } from '@netior/shared/constants';
import type { SlotSemanticAnnotationKey } from '@netior/shared/types';
import type { LayoutRenderNode } from './types';

export function getSemanticSlotValue(node: LayoutRenderNode, annotation: SlotSemanticAnnotationKey): unknown {
  const projected = node.semantic?.slots[annotation];
  if (projected) return projected.value;

  const legacySlot = semanticAnnotationToSystemSlot(annotation);
  return legacySlot ? node.metadata[legacySlot] : undefined;
}

export function getSemanticSlotRawValue(node: LayoutRenderNode, annotation: SlotSemanticAnnotationKey): string | null | undefined {
  const projected = node.semantic?.slots[annotation];
  if (projected) return projected.rawValue;

  const fieldId = getSemanticSlotFieldId(node, annotation);
  const fieldValues = node.metadata.__fieldValues;
  if (!fieldId || typeof fieldValues !== 'object' || fieldValues == null) return undefined;
  return (fieldValues as Record<string, string | null | undefined>)[fieldId];
}

export function getSemanticSlotFieldId(node: LayoutRenderNode, annotation: SlotSemanticAnnotationKey): string | undefined {
  const projected = node.semantic?.slotFieldIds[annotation];
  if (projected) return projected;

  const semanticIds = node.metadata.__semanticSlotFieldIds;
  if (typeof semanticIds === 'object' && semanticIds != null) {
    const fieldId = (semanticIds as Record<string, unknown>)[annotation];
    if (typeof fieldId === 'string') return fieldId;
  }

  const legacySlot = semanticAnnotationToSystemSlot(annotation);
  const legacyIds = node.metadata.__slotFieldIds;
  if (!legacySlot || typeof legacyIds !== 'object' || legacyIds == null) return undefined;
  const fieldId = (legacyIds as Record<string, unknown>)[legacySlot];
  return typeof fieldId === 'string' ? fieldId : undefined;
}

export function getSemanticNumber(node: LayoutRenderNode, annotation: SlotSemanticAnnotationKey): number | undefined {
  const value = getSemanticSlotValue(node, annotation);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getSemanticBoolean(node: LayoutRenderNode, annotation: SlotSemanticAnnotationKey): boolean | undefined {
  const value = getSemanticSlotValue(node, annotation);
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}
