import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ArrowRight, Minus } from 'lucide-react';
import { narreService, type MentionResult } from '../../../services/narre-service';
import { useI18n } from '../../../hooks/useI18n';
import { Spinner } from '../../ui/Spinner';
import type { TranslationKey } from '@netior/shared/i18n';
import { logShortcut } from '../../../shortcuts/shortcut-utils';

interface NarreMentionPickerProps {
  query: string;
  projectId: string;
  position: { bottom: number; left: number };
  onSelect: (mention: MentionResult) => void;
  onClose: () => void;
}

const MENTION_CATEGORIES = [
  { key: 'all', i18nKey: 'narre.mentionAll' },
  { key: 'concept', i18nKey: 'narre.mentionConcept' },
  { key: 'canvas', i18nKey: 'narre.mentionCanvas' },
  { key: 'archetype', i18nKey: 'narre.mentionArchetype' },
  { key: 'relationType', i18nKey: 'narre.mentionRelationType' },
  { key: 'canvasType', i18nKey: 'narre.mentionCanvasType' },
  { key: 'file', i18nKey: 'narre.mentionFile' },
] as const;

function PreviewPanel({ item, t }: { item: MentionResult; t: (key: TranslationKey) => string }): JSX.Element {
  const catLabel = MENTION_CATEGORIES.find((c) => c.key === item.type)?.i18nKey;
  const conceptArchetype = item.type === 'concept' && typeof item.meta?.archetype === 'string' ? item.meta.archetype : null;
  const archetypeNodeShape = item.type === 'archetype' && typeof item.meta?.nodeShape === 'string' ? item.meta.nodeShape : null;
  const relationDirected = item.type === 'relationType' && typeof item.meta?.directed === 'boolean' ? item.meta.directed : null;
  const relationLineStyle = item.type === 'relationType' && typeof item.meta?.lineStyle === 'string' ? item.meta.lineStyle : null;
  const filePath = item.type === 'file' && typeof item.meta?.path === 'string' ? item.meta.path : null;

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        {item.icon && <span className="text-base">{item.icon}</span>}
        {item.color && (
          <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
        )}
        <span className="text-xs font-medium text-default truncate">{item.display}</span>
      </div>

      {/* Type badge */}
      <span className="inline-flex self-start rounded px-1.5 py-0.5 text-[10px] font-medium bg-interactive-selected text-accent">
        {catLabel ? t(catLabel as TranslationKey) : item.type}
      </span>

      {/* Description */}
      {item.description && (
        <p className="text-[11px] text-secondary leading-relaxed">{item.description}</p>
      )}

      {/* Type-specific meta */}
      {item.meta && (
        <div className="flex flex-col gap-1 text-[10px] text-muted">
          {conceptArchetype && (
            <div className="flex items-center gap-1">
              <span className="text-secondary">Archetype:</span>
              <span className="text-default">{conceptArchetype}</span>
            </div>
          )}
          {archetypeNodeShape && (
            <div className="flex items-center gap-1">
              <span className="text-secondary">Shape:</span>
              <span className="text-default">{archetypeNodeShape}</span>
            </div>
          )}
          {item.type === 'relationType' && (
            <>
              {relationDirected !== null && (
                <div className="flex items-center gap-1.5">
                  {relationDirected ? <ArrowRight size={10} /> : <Minus size={10} />}
                  <span>{relationDirected ? 'Directed' : 'Undirected'}</span>
                </div>
              )}
              {relationLineStyle && (
                <div className="flex items-center gap-1">
                  <span className="text-secondary">Style:</span>
                  <span className="text-default">{relationLineStyle}</span>
                </div>
              )}
            </>
          )}
          {filePath && (
            <div className="flex items-center gap-1">
              <span className="text-secondary">Path:</span>
              <span className="text-default truncate">{filePath}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NarreMentionPicker({
  query,
  projectId,
  position,
  onSelect,
  onClose,
}: NarreMentionPickerProps): JSX.Element {
  const { t } = useI18n();
  const [results, setResults] = useState<MentionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState(query);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const activeCategoryRef = useRef(activeCategory);
  activeCategoryRef.current = activeCategory;

  // Sync external query to internal search
  useEffect(() => { setSearch(query); }, [query]);

  // Search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = search ? 150 : 0;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await narreService.searchMentions(projectId, search);
        setResults(data);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, projectId]);

  // Filter by active category
  const displayResults = useMemo(() => {
    if (activeCategory === 'all') return results;
    return results.filter((r) => r.type === activeCategory);
  }, [results, activeCategory]);

  // Categories with results
  const visibleCategories = useMemo(() => {
    const types = new Set(results.map((r) => r.type));
    return MENTION_CATEGORIES.filter((c) => c.key === 'all' || types.has(c.key));
  }, [results]);

  // Preview item
  const previewItem = displayResults[selectedIndex] ?? null;

  // Keyboard navigation: arrows, enter, escape, tab
  // stopImmediatePropagation prevents the event from reaching contentEditable's handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopImmediatePropagation();
      logShortcut('shortcut.narreMentionPicker.selectNext');
      setSelectedIndex((prev) => Math.min(prev + 1, displayResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopImmediatePropagation();
      logShortcut('shortcut.narreMentionPicker.selectPrevious');
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const cats = visibleCategories;
      const curIdx = cats.findIndex((c) => c.key === activeCategoryRef.current);
      const next = e.shiftKey
        ? (curIdx - 1 + cats.length) % cats.length
        : (curIdx + 1) % cats.length;
      setActiveCategory(cats[next].key);
      setSelectedIndex(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (displayResults[selectedIndex]) {
        logShortcut('shortcut.narreMentionPicker.confirmSelection');
        onSelect(displayResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      logShortcut('shortcut.narreMentionPicker.close');
      onClose();
    }
  }, [displayResults, selectedIndex, visibleCategories, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Don't auto-focus search — contentEditable must keep focus for chip insertion.
  // Search syncs from the external query (text after @).

  const showPreview = previewItem && (previewItem.description || previewItem.meta);

  return createPortal(
    <div
      ref={containerRef}
      className="fixed bg-surface-panel border border-default rounded-lg overflow-hidden flex"
      style={{
        bottom: position.bottom,
        left: position.left,
        width: showPreview ? 500 : 360,
        zIndex: 10001,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Left: categories */}
      <div className="w-[90px] shrink-0 border-r border-subtle bg-surface-base flex flex-col py-1">
        {visibleCategories.map((cat) => (
          <button
            key={cat.key}
            className={`px-2.5 py-1.5 text-xs text-left transition-colors ${
              activeCategory === cat.key
                ? 'bg-interactive-selected text-accent'
                : 'text-secondary hover:bg-surface-hover hover:text-default'
            }`}
            onClick={() => { setActiveCategory(cat.key); setSelectedIndex(0); }}
          >
            {t(cat.i18nKey as TranslationKey)}
          </button>
        ))}
        {/* Tab hint */}
        <div className="mt-auto px-2 py-1.5 text-[9px] text-muted">
          Tab ↹
        </div>
      </div>

      {/* Middle: search + list */}
      <div className="flex-1 flex flex-col max-h-[280px] min-w-0">
        <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-subtle">
          <Search size={12} className="shrink-0 text-muted" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveCategory('all'); }}
            placeholder={t('narre.mentionSearch' as TranslationKey)}
            className="w-full bg-transparent text-xs text-default outline-none placeholder:text-muted"
          />
        </div>
        <div className="overflow-y-auto py-1">
          {loading && (
            <div className="flex items-center justify-center py-3"><Spinner size="sm" /></div>
          )}
          {!loading && displayResults.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted text-center">{t('common.noResults')}</div>
          )}
          {!loading && displayResults.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const categoryLabel = MENTION_CATEGORIES.find((c) => c.key === item.type)?.i18nKey;
            return (
              <div
                key={`${item.type}-${item.id}`}
                className={[
                  'flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors',
                  isSelected ? 'bg-surface-hover text-default' : 'text-secondary hover:bg-surface-hover',
                ].join(' ')}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                {item.icon && <span className="shrink-0 text-sm">{item.icon}</span>}
                {item.color && !item.icon && (
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                )}
                <span className="truncate">{item.display}</span>
                {activeCategory === 'all' && (
                  <span className="ml-auto shrink-0 text-[10px] text-muted">
                    {categoryLabel ? t(categoryLabel as TranslationKey) : item.type}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: preview panel */}
      {showPreview && (
        <div className="w-[140px] shrink-0 border-l border-subtle overflow-y-auto">
          <PreviewPanel item={previewItem} t={t} />
        </div>
      )}
    </div>,
    document.body,
  );
}
