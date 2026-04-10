export const HIERARCHY_PARENT_CONTRACT = 'core:hierarchy_parent';

const LEGACY_HIERARCHY_PARENT_CONTRACTS = new Set([
  'core:root_child',
  'core:tree_parent',
]);

export function isHierarchyParentContract(contract: string | null | undefined): boolean {
  return contract === HIERARCHY_PARENT_CONTRACT || LEGACY_HIERARCHY_PARENT_CONTRACTS.has(contract ?? '');
}
