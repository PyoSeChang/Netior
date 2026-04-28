export const HIERARCHY_PARENT_MEANING = 'structure.parent';

const FALLBACK_HIERARCHY_PARENT_MEANINGS = new Set([
  'core:root_child',
  'core:tree_parent',
]);

export function isHierarchyParentMeaning(meaning: string | null | undefined): boolean {
  return meaning === HIERARCHY_PARENT_MEANING || FALLBACK_HIERARCHY_PARENT_MEANINGS.has(meaning ?? '');
}
