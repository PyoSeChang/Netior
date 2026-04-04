import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import type { PdfToc } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';
import { EdgePanel } from '../../ui/EdgePanel';
import { buildTocTree, findActivePathIds, type TocTreeNode } from '../../../utils/pdf-toc-utils';

interface PdfTocSidebarProps {
  toc: PdfToc | null;
  currentPage: number;
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
  onPageJump: (destPage: number) => void;
}

export function PdfTocSidebar({ toc, currentPage, pinned, onPinChange, onPageJump }: PdfTocSidebarProps): JSX.Element {
  const { t } = useI18n();
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(new Set());

  const tree = useMemo(() => toc ? buildTocTree(toc.entries) : [], [toc]);
  const { activeId, ancestorIds } = useMemo(
    () => findActivePathIds(tree, currentPage),
    [tree, currentPage],
  );

  const isExpanded = useCallback((id: string) => {
    if (manualCollapsed.has(id)) return false;
    if (manualExpanded.has(id)) return true;
    return ancestorIds.has(id);
  }, [manualExpanded, manualCollapsed, ancestorIds]);

  const toggleExpand = useCallback((id: string) => {
    if (isExpanded(id)) {
      setManualCollapsed((s) => { const n = new Set(s); n.add(id); return n; });
      setManualExpanded((s) => { const n = new Set(s); n.delete(id); return n; });
    } else {
      setManualExpanded((s) => { const n = new Set(s); n.add(id); return n; });
      setManualCollapsed((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [isExpanded]);

  useEffect(() => {
    setManualCollapsed(new Set());
    setManualExpanded(new Set());
  }, [activeId]);

  const handleNavigate = useCallback((destPage: number) => {
    onPageJump(destPage);
  }, [onPageJump]);

  return (
    <EdgePanel
      side="left"
      width={260}
      pinned={pinned}
      onPinChange={onPinChange}
      title={t('pdfToc.sidebar')}
    >
      {tree.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <span className="text-xs font-medium text-secondary">{t('pdfToc.emptyTitle')}</span>
          <span className="text-[11px] leading-relaxed text-muted">{t('pdfToc.emptyHint')}</span>
        </div>
      ) : (
        <div className="overflow-y-auto py-1">
          {tree.map((node) => (
            <TocNode
              key={node.entry.id}
              node={node}
              activeId={activeId}
              isExpanded={isExpanded}
              onToggle={toggleExpand}
              onNavigate={handleNavigate}
              depth={0}
            />
          ))}
        </div>
      )}
    </EdgePanel>
  );
}

interface TocNodeProps {
  node: TocTreeNode;
  activeId: string | null;
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  onNavigate: (destPage: number) => void;
  depth: number;
}

function TocNode({ node, activeId, isExpanded, onToggle, onNavigate, depth }: TocNodeProps): JSX.Element {
  const { entry, children } = node;
  const hasChildren = children.length > 0;
  const expanded = hasChildren && isExpanded(entry.id);
  const isActive = entry.id === activeId;
  const isRoot = depth === 0;

  return (
    <>
      <div
        className={`flex w-full items-center gap-0.5 pr-2 transition-colors cursor-pointer hover:bg-surface-hover ${
          isActive ? 'bg-accent/10' : ''
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            className="flex shrink-0 items-center justify-center w-4 h-4 rounded text-muted hover:text-default"
            onClick={(e) => { e.stopPropagation(); onToggle(entry.id); }}
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
          className={`flex flex-1 items-baseline justify-between gap-2 py-1 text-left min-w-0 ${
            isActive ? 'text-accent' : ''
          }`}
          onClick={() => onNavigate(entry.destPage)}
        >
          <span className={`truncate text-[11px] leading-relaxed ${
            isRoot ? 'font-semibold text-default' : 'text-secondary'
          } ${isActive ? '!text-accent' : ''}`}>
            {entry.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted tabular-nums">
            {entry.destPage}
          </span>
        </button>
      </div>

      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <TocNode
              key={child.entry.id}
              node={child}
              activeId={activeId}
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
