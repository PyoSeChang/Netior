import type { Edge, Model, ModelRefKey } from '@netior/shared/types';

export const CONTAINS_MODEL_KEY = 'contains_relation' as const;
export const ENTRY_PORTAL_MODEL_KEY = 'entry_portal_relation' as const;
export const HIERARCHY_PARENT_MODEL_KEY = 'parent_relation' as const;

export type EdgeWithModel = Edge & { model?: Model };

export function systemEdgeModelId(projectId: string | null | undefined, key: ModelRefKey): string | null {
  return projectId ? `model-${projectId}-${key}` : null;
}

export function getEdgeModelKey(edge: Pick<EdgeWithModel, 'model'>): string | null {
  return edge.model?.key ?? null;
}

export function isContainsEdge(edge: Pick<EdgeWithModel, 'model'>): boolean {
  return getEdgeModelKey(edge) === CONTAINS_MODEL_KEY;
}

export function isEntryPortalEdge(edge: Pick<EdgeWithModel, 'model'>): boolean {
  return getEdgeModelKey(edge) === ENTRY_PORTAL_MODEL_KEY;
}

export function isHierarchyParentEdge(edge: Pick<EdgeWithModel, 'model'>): boolean {
  return getEdgeModelKey(edge) === HIERARCHY_PARENT_MODEL_KEY;
}
