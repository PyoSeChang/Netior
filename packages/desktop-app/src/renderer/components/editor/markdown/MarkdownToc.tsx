import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { EdgePanel } from '../../ui/EdgePanel';
import { useI18n } from '../../../hooks/useI18n';

export interface TocHeading {
  lineNumber: number;
  level: number;
  text: string;
}

interface MarkdownTocProps {
  headings: TocHeading[];
  currentLine: number;
  onNavigate: (lineNumber: number) => void;
}

export function extractHeadings(content: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = content.split('\n');
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```|^~~~/.test(lines[i].trim())) { inCode = !inCode; continue; }
    if (inCode) continue;
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        lineNumber: i + 1,
        level: match[1].length,
        text: match[2].replace(/\s+#+\s*$/, '').trim(),
      });
    }
  }
  return headings;
}

// ============================================
// Tree structure
// ============================================

interface TocTreeNode {
  heading: TocHeading;
  children: TocTreeNode[];
}

function buildHeadingTree(headings: TocHeading[]): TocTreeNode[] {
  const roots: TocTreeNode[] = [];
  const stack: TocTreeNode[] = [];

  for (const heading of headings) {
    const node: TocTreeNode = { heading, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].heading.level >= heading.level) {
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

/** Default expand depth: heading level 1-2 (depth 0-1) always expanded. */
const DEFAULT_EXPAND_DEPTH = 1;

function findActivePathKeys(
  tree: TocTreeNode[],
  currentLine: number,
): { activeKey: string | null; ancestorKeys: Set<string> } {
  let bestHeading: TocHeading | null = null;
  let bestPath: string[] = [];

  function walk(nodes: TocTreeNode[], path: string[]): void {
    for (const node of nodes) {
      if (node.heading.lineNumber <= currentLine) {
        if (!bestHeading || node.heading.lineNumber > bestHeading.lineNumber) {
          bestHeading = node.heading;
          bestPath = [...path, toKey(node.heading)];
        }
        walk(node.children, [...path, toKey(node.heading)]);
      }
    }
  }

  walk(tree, []);

  return {
    activeKey: bestHeading ? toKey(bestHeading) : null,
    ancestorKeys: new Set(bestPath.slice(0, -1)),
  };
}

function toKey(h: TocHeading): string {
  return `${h.lineNumber}`;
}

// ============================================
// Component
// ============================================

export function MarkdownToc({ headings, currentLine, onNavigate }: MarkdownTocProps): JSX.Element | null {
  const { t } = useI18n();
  const [pinned, setPinned] = useState(false);
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildHeadingTree(headings), [headings]);
  const { activeKey, ancestorKeys } = useMemo(
    () => findActivePathKeys(tree, currentLine),
    [tree, currentLine],
  );

  const isExpanded = useCallback((key: string, depth: number) => {
    if (manualCollapsed.has(key)) return false;
    if (manualExpanded.has(key)) return true;
    // Auto-expand: active path OR default depth
    return ancestorKeys.has(key) || depth <= DEFAULT_EXPAND_DEPTH;
  }, [manualExpanded, manualCollapsed, ancestorKeys]);

  const toggleExpand = useCallback((key: string) => {
    // Determine current state to toggle (need depth, but we can just check via the callback approach)
    setManualExpanded((prev) => {
      const next = new Set(prev);
      if (manualCollapsed.has(key)) {
        // Currently collapsed → expand
        setManualCollapsed((s) => { const n = new Set(s); n.delete(key); return n; });
        next.add(key);
      } else {
        // Currently expanded → collapse
        setManualCollapsed((s) => { const n = new Set(s); n.add(key); return n; });
        next.delete(key);
      }
      return next;
    });
  }, [manualCollapsed]);

  // Reset manual overrides when active heading changes
  useEffect(() => {
    setManualCollapsed(new Set());
    setManualExpanded(new Set());
  }, [activeKey]);

  if (headings.length === 0) return null;

  return (
    <EdgePanel
      side="left"
      width={240}
      topOffset={8}
      pinned={pinned}
      onPinChange={setPinned}
      title={t('markdown.toc')}
    >
      <div className="overflow-y-auto py-1">
        {tree.map((node) => (
          <TocNode
            key={toKey(node.heading)}
            node={node}
            activeKey={activeKey}
            isExpanded={isExpanded}
            onToggle={toggleExpand}
            onNavigate={onNavigate}
            depth={0}
          />
        ))}
      </div>
    </EdgePanel>
  );
}

// ============================================
// Recursive tree node
// ============================================

interface TocNodeProps {
  node: TocTreeNode;
  activeKey: string | null;
  isExpanded: (key: string, depth: number) => boolean;
  onToggle: (key: string) => void;
  onNavigate: (lineNumber: number) => void;
  depth: number;
}

function TocNode({ node, activeKey, isExpanded, onToggle, onNavigate, depth }: TocNodeProps): JSX.Element {
  const { heading, children } = node;
  const key = toKey(heading);
  const hasChildren = children.length > 0;
  const expanded = hasChildren && isExpanded(key, depth);
  const isActive = key === activeKey;
  const isRoot = depth === 0;

  return (
    <>
      <div
        className={`flex w-full items-center gap-0.5 pr-2 transition-colors cursor-pointer hover:bg-surface-hover ${
          isActive ? 'bg-interactive-muted' : ''
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            className="flex shrink-0 items-center justify-center w-4 h-4 rounded text-muted hover:text-default"
            onClick={(e) => { e.stopPropagation(); onToggle(key); }}
          >
            <ChevronRight
              size={10}
              className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <button
          className={`flex flex-1 items-baseline gap-2 py-1 text-left min-w-0 ${
            isActive ? 'text-accent' : ''
          }`}
          onClick={() => onNavigate(heading.lineNumber)}
        >
          <span className={`truncate text-[11px] leading-relaxed ${
            isRoot ? 'font-semibold text-default' : 'text-secondary'
          } ${isActive ? '!text-accent' : ''}`}>
            {heading.text}
          </span>
        </button>
      </div>

      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <TocNode
              key={toKey(child.heading)}
              node={child}
              activeKey={activeKey}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </>
  );
}
