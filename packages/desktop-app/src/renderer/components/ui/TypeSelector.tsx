import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Type, Hash, ToggleLeft, Calendar, Clock, List, CheckSquare, CircleDot, Link2, FileText, Globe, Palette, Star, Tags } from 'lucide-react';
import type { FieldType } from '@moc/shared/types';
import { useI18n } from '../../hooks/useI18n';

interface TypeSelectorProps {
  value?: FieldType;
  onChange?: (type: FieldType) => void;
}

interface TypeOption {
  value: FieldType;
  i18nKey: string;
  icon: React.FC<{ size?: string | number }>;
}

interface TypeCategory {
  key: string;
  types: TypeOption[];
}

const CATEGORIES: TypeCategory[] = [
  {
    key: 'basic',
    types: [
      { value: 'text', i18nKey: 'text', icon: Type },
      { value: 'textarea', i18nKey: 'textarea', icon: FileText },
      { value: 'number', i18nKey: 'number', icon: Hash },
      { value: 'boolean', i18nKey: 'boolean', icon: ToggleLeft },
    ],
  },
  {
    key: 'date',
    types: [
      { value: 'date', i18nKey: 'dateType', icon: Calendar },
      { value: 'datetime', i18nKey: 'datetime', icon: Clock },
    ],
  },
  {
    key: 'choice',
    types: [
      { value: 'select', i18nKey: 'select', icon: List },
      { value: 'multi-select', i18nKey: 'multi-select', icon: CheckSquare },
      { value: 'radio', i18nKey: 'radio', icon: CircleDot },
    ],
  },
  {
    key: 'reference',
    types: [
      { value: 'relation', i18nKey: 'relation', icon: Link2 },
      { value: 'file', i18nKey: 'file', icon: FileText },
    ],
  },
  {
    key: 'rich',
    types: [
      { value: 'url', i18nKey: 'url', icon: Globe },
      { value: 'color', i18nKey: 'color', icon: Palette },
      { value: 'rating', i18nKey: 'rating', icon: Star },
      { value: 'tags', i18nKey: 'tags', icon: Tags },
    ],
  },
];

const ALL_TYPES = CATEGORIES.flatMap((c) => c.types);

export const TypeSelector: React.FC<TypeSelectorProps> = ({ value, onChange }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Filter types by search
  const filteredCategories = useMemo(() => {
    if (!search) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.map((cat) => ({
      ...cat,
      types: cat.types.filter((tp) => {
        const label = t(`typeSelector.${tp.i18nKey}`).toLowerCase();
        return label.includes(q) || tp.value.toLowerCase().includes(q);
      }),
    })).filter((cat) => cat.types.length > 0);
  }, [search, t]);

  // Display types based on active category
  const displayTypes = useMemo(() => {
    if (activeCategory === 'all') return filteredCategories.flatMap((c) => c.types);
    const cat = filteredCategories.find((c) => c.key === activeCategory);
    return cat?.types ?? [];
  }, [filteredCategories, activeCategory]);

  const selected = ALL_TYPES.find((tp) => tp.value === value);

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(!open);
    setSearch('');
    setActiveCategory('all');
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-input border border-input rounded-lg cursor-pointer outline-none transition-all duration-fast hover:border-strong focus:border-accent min-w-[120px] ${open ? 'border-accent' : ''}`}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected && <selected.icon size={14} />}
        <span className={`flex-1 text-left ${selected ? 'text-default' : 'text-muted'}`}>
          {selected ? t(`typeSelector.${selected.i18nKey}`) : t('typeSelector.type')}
        </span>
        <ChevronDown size={12} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-surface-panel border border-default rounded-lg overflow-hidden flex"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: 340,
            zIndex: 10001,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Left: categories */}
          <div className="w-[100px] shrink-0 border-r border-subtle bg-surface-base flex flex-col">
            <button
              className={`px-2.5 py-1.5 text-xs text-left transition-colors ${
                activeCategory === 'all'
                  ? 'bg-accent/10 text-accent'
                  : 'text-secondary hover:bg-surface-hover hover:text-default'
              }`}
              onClick={() => setActiveCategory('all')}
            >
              {t('typeSelector.all')}
            </button>
            {CATEGORIES.map((cat) => {
              const hasResults = filteredCategories.some((fc) => fc.key === cat.key);
              if (search && !hasResults) return null;
              return (
                <button
                  key={cat.key}
                  className={`px-2.5 py-1.5 text-xs text-left transition-colors ${
                    activeCategory === cat.key
                      ? 'bg-accent/10 text-accent'
                      : 'text-secondary hover:bg-surface-hover hover:text-default'
                  }`}
                  onClick={() => setActiveCategory(cat.key)}
                >
                  {t(`typeSelector.${cat.key}`)}
                </button>
              );
            })}
          </div>

          {/* Right: search + list */}
          <div className="flex-1 flex flex-col max-h-[320px]">
            {/* Search */}
            <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-subtle">
              <Search size={12} className="shrink-0 text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveCategory('all');
                }}
                placeholder={t('typeSelector.search')}
                className="w-full bg-transparent text-xs text-default outline-none placeholder:text-muted"
              />
            </div>

            {/* Type list */}
            <div className="overflow-y-auto py-1">
              {displayTypes.length > 0 ? (
                displayTypes.map((tp) => (
                  <button
                    key={tp.value}
                    type="button"
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover ${
                      tp.value === value ? 'text-accent bg-accent-muted' : 'text-default'
                    }`}
                    onClick={() => {
                      onChange?.(tp.value);
                      setOpen(false);
                    }}
                  >
                    <tp.icon size={14} />
                    {t(`typeSelector.${tp.i18nKey}`)}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-xs text-muted text-center">
                  {t('typeSelector.noResults')}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
