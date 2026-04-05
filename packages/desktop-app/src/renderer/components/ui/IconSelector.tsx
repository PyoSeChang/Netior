import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { iconNames, getIconComponent } from './lucide-utils';
import { ICON_CATEGORIES, CATEGORY_ORDER } from './icon-categories';
import { Tooltip } from './Tooltip';
import { useI18n } from '../../hooks/useI18n';
import type { TranslationKey } from '@netior/shared/i18n';

interface IconSelectorProps {
  value?: string;
  onChange?: (name: string) => void;
  placeholder?: string;
}

export const IconSelector: React.FC<IconSelectorProps> = ({ value, onChange, placeholder }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    },
    [],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEsc);
      setSearch('');
      setActiveCategory('all');
      setTimeout(() => searchRef.current?.focus(), 100);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, handleEsc]);

  // Filter icons by search query
  const filtered = useMemo(() => {
    if (!search) return iconNames;
    const q = search.toLowerCase();
    return iconNames.filter((n) => n.toLowerCase().includes(q));
  }, [search]);

  // Get icons for the active category
  const displayIcons = useMemo(() => {
    if (activeCategory === 'all') return filtered;
    const categoryIcons = ICON_CATEGORIES[activeCategory];
    if (!categoryIcons) return filtered;
    const categorySet = new Set(categoryIcons);
    return filtered.filter((n) => categorySet.has(n));
  }, [filtered, activeCategory]);

  const filteredSet = useMemo(() => new Set(filtered), [filtered]);

  // Filter categories that have matching icons when searching
  const visibleCategories = useMemo(() => {
    if (!search) return CATEGORY_ORDER;
    return CATEGORY_ORDER.filter((cat) => {
      const catIcons = ICON_CATEGORIES[cat];
      return catIcons?.some((n) => filteredSet.has(n));
    });
  }, [search, filtered, filteredSet]);

  // Scroll grid to top on category change
  useEffect(() => {
    gridRef.current?.scrollTo(0, 0);
  }, [activeCategory, search]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleSelect = (name: string) => {
    onChange?.(name);
    setOpen(false);
  };

  const SelectedIcon = value ? getIconComponent(value) : null;
  const displayPlaceholder = placeholder ?? t('iconSelector.selectIcon');

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2 text-sm bg-input border border-input rounded-lg cursor-pointer outline-none transition-all duration-fast hover:border-strong focus:border-accent"
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
        tabIndex={0}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {SelectedIcon ? <SelectedIcon size={16} /> : null}
        <span className={value ? 'text-default' : 'text-muted'}>
          {value || displayPlaceholder}
        </span>
      </div>

      {open && createPortal(
        <div
          className="fixed inset-0 flex animate-in fade-in duration-200"
          style={{ zIndex: 10001 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative z-10 m-auto flex h-[70vh] w-[min(90vw,720px)] overflow-hidden rounded-xl border border-subtle bg-surface-modal shadow-2xl ring-1 ring-black/10 animate-in zoom-in-95 duration-200">
            {/* Left sidebar: categories */}
            <div className="flex w-44 shrink-0 flex-col border-r border-subtle bg-surface-panel">
              <div className="px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                {t('iconSelector.categories')}
              </div>
              <nav className="flex-1 overflow-y-auto px-2 pb-3">
                {/* All */}
                <button
                  className={`flex w-full items-center rounded-md px-3 py-1.5 text-sm transition-colors mb-0.5 ${
                    activeCategory === 'all'
                      ? 'bg-interactive-selected text-accent'
                      : 'text-secondary hover:bg-surface-hover hover:text-default'
                  }`}
                  onClick={() => setActiveCategory('all')}
                >
                  {t('iconSelector.all')}
                  <span className="ml-auto text-xs text-muted">{filtered.length}</span>
                </button>
                {visibleCategories.map((cat) => {
                  const catIcons = ICON_CATEGORIES[cat];
                  const count = search
                    ? catIcons?.filter((n) => filteredSet.has(n)).length ?? 0
                    : catIcons?.length ?? 0;
                  return (
                    <button
                      key={cat}
                      className={`flex w-full items-center rounded-md px-3 py-1.5 text-sm transition-colors mb-0.5 ${
                        activeCategory === cat
                          ? 'bg-interactive-selected text-accent'
                          : 'text-secondary hover:bg-surface-hover hover:text-default'
                      }`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {t(`iconSelector.${cat}` as TranslationKey)}
                      <span className="ml-auto text-xs text-muted">{count}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right content */}
            <div className="flex flex-1 flex-col">
              {/* Header: search + close */}
              <div className="flex items-center gap-2 border-b border-subtle px-4 py-3">
                <div className="flex flex-1 items-center gap-2 rounded-md border border-subtle bg-surface-base px-3 py-1.5">
                  <Search size={14} className="shrink-0 text-muted" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setActiveCategory('all');
                    }}
                    placeholder={t('iconSelector.searchIcons')}
                    className="w-full bg-transparent text-sm text-default outline-none placeholder:text-muted"
                  />
                  {search && (
                    <button
                      className="text-muted hover:text-default"
                      onClick={() => setSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  className="rounded-md p-1 text-muted transition-colors hover:bg-surface-hover hover:text-default"
                  onClick={() => setOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Icon grid */}
              <div ref={gridRef} className="flex-1 overflow-y-auto p-3">
                {displayIcons.length > 0 ? (
                  <div className="grid grid-cols-10 gap-1">
                    {displayIcons.map((name) => {
                      const Icon = getIconComponent(name);
                      if (!Icon) return null;
                      return (
                        <Tooltip key={name} content={name} position="top">
                          <button
                            type="button"
                            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                              name === value
                                ? 'bg-accent text-on-accent'
                                : 'text-default hover:bg-surface-hover'
                            }`}
                            onClick={() => handleSelect(name)}
                          >
                            <Icon size={18} />
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted">
                    <Search size={32} className="mb-3 opacity-40" />
                    <p className="text-sm">{t('iconSelector.noIconsFound')}</p>
                  </div>
                )}
              </div>

              {/* Footer: count + selected */}
              <div className="flex items-center justify-between border-t border-subtle px-4 py-2 text-xs text-muted">
                <span>{t('iconSelector.iconCount').replace('{count}', String(displayIcons.length))}</span>
                {value && (
                  <span className="text-default">
                    {t('iconSelector.selected').replace('{name}', value)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
