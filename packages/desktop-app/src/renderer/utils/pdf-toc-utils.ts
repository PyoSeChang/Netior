import type { PdfTocEntry } from '@netior/shared/types';

/** Sort TOC entries by destPage (ascending), with level as tiebreaker. */
export function sortTocEntries(entries: PdfTocEntry[]): PdfTocEntry[] {
  return [...entries].sort((a, b) => a.destPage - b.destPage || a.level - b.level);
}

// ============================================
// Tree structure
// ============================================

export interface TocTreeNode {
  entry: PdfTocEntry;
  children: TocTreeNode[];
}

/** Build a tree from flat sorted entries using level hierarchy. */
export function buildTocTree(entries: PdfTocEntry[]): TocTreeNode[] {
  const sorted = sortTocEntries(entries);
  const roots: TocTreeNode[] = [];
  const stack: TocTreeNode[] = [];

  for (const entry of sorted) {
    const node: TocTreeNode = { entry, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].entry.level >= entry.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return roots;
}

/**
 * Find the active entry id and its ancestor path for the current page.
 * Returns the deepest entry whose destPage <= currentPage,
 * plus the path of ancestor ids from root to active.
 */
export function findActivePathIds(
  tree: TocTreeNode[],
  currentPage: number,
): { activeId: string | null; ancestorIds: Set<string> } {
  let bestEntry: PdfTocEntry | null = null;
  let bestPath: string[] = [];

  function walk(nodes: TocTreeNode[], path: string[]): void {
    for (const node of nodes) {
      if (node.entry.destPage <= currentPage) {
        if (
          !bestEntry ||
          node.entry.destPage > bestEntry.destPage ||
          (node.entry.destPage === bestEntry.destPage && node.entry.level > bestEntry.level)
        ) {
          bestEntry = node.entry;
          bestPath = [...path, node.entry.id];
        }
        walk(node.children, [...path, node.entry.id]);
      }
    }
  }

  walk(tree, []);

  const finalEntry = bestEntry as PdfTocEntry | null;
  return {
    activeId: finalEntry?.id ?? null,
    ancestorIds: new Set(bestPath.slice(0, -1)),
  };
}
