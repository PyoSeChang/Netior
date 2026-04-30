export { HIERARCHY_PARENT_MODEL_KEY } from './edge-models';

export function isHierarchyParentModelKey(key: string | null | undefined): boolean {
  return key === 'parent_relation';
}
