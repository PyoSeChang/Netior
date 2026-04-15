import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Boxes,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock,
  FileText,
  Globe,
  Hash,
  Link2,
  List,
  Palette,
  Search,
  Star,
  Tags,
  ToggleLeft,
  Type,
} from 'lucide-react';
import type { FieldType } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import { useI18n } from '../../hooks/useI18n';
import { isFieldTypeVisibleAtLevel } from '../../lib/field-complexity';
import { useSettingsStore } from '../../stores/settings-store';
import { useUIStore } from '../../stores/ui-store';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';

interface TypeSelectorProps {
  value?: FieldType;
  onChange?: (type: FieldType) => void;
  allowedTypes?: FieldType[];
  disabled?: boolean;
  constraintLabel?: string;
  constraintDescription?: string;
  allowedTypeLabels?: string[];
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
      { value: 'archetype_ref', i18nKey: 'archetype_ref', icon: Boxes },
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

const ALL_TYPES = CATEGORIES.flatMap((category) => category.types);

export const TypeSelector: React.FC<TypeSelectorProps> = ({
  value,
  onChange,
  allowedTypes,
  disabled = false,
  constraintLabel,
  constraintDescription,
  allowedTypeLabels,
}) => {
  const { t } = useI18n();
  const fieldComplexityLevel = useSettingsStore((s) => s.fieldComplexityLevel);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAllTypes, setShowAllTypes] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownPos = useAnchoredDropdown(open, triggerRef, {
    estimatedHeight: 340,
    minWidth: 340,
  }, dropdownRef);

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

  const availableTypes = useMemo(() => (
    allowedTypes ? ALL_TYPES.filter((typeOption) => allowedTypes.includes(typeOption.value)) : ALL_TYPES
  ), [allowedTypes]);

  const visibleTypes = useMemo(() => {
    if (showAllTypes) return availableTypes;
    return availableTypes.filter((typeOption) => (
      typeOption.value === value || isFieldTypeVisibleAtLevel(typeOption.value, fieldComplexityLevel)
    ));
  }, [availableTypes, fieldComplexityLevel, showAllTypes, value]);

  const visibleCategories = useMemo(() => (
    CATEGORIES.map((category) => ({
      ...category,
      types: category.types.filter((typeOption) => visibleTypes.some((visibleType) => visibleType.value === typeOption.value)),
    })).filter((category) => category.types.length > 0)
  ), [visibleTypes]);

  const filteredCategories = useMemo(() => {
    if (!search) return visibleCategories;
    const q = search.toLowerCase();
    return visibleCategories.map((category) => ({
      ...category,
      types: category.types.filter((typeOption) => {
        const label = t(`typeSelector.${typeOption.i18nKey}` as TranslationKey).toLowerCase();
        return label.includes(q) || typeOption.value.toLowerCase().includes(q);
      }),
    })).filter((category) => category.types.length > 0);
  }, [search, t, visibleCategories]);

  const displayTypes = useMemo(() => {
    if (activeCategory === 'all') return filteredCategories.flatMap((category) => category.types);
    const category = filteredCategories.find((item) => item.key === activeCategory);
    return category?.types ?? [];
  }, [filteredCategories, activeCategory]);

  const selected = ALL_TYPES.find((typeOption) => typeOption.value === value);
  const hiddenTypeCount = Math.max(0, availableTypes.length - visibleTypes.length);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(!open);
    setSearch('');
    setActiveCategory('all');
    setShowAllTypes(false);
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
        className={`flex min-w-[140px] items-start gap-2 rounded-lg border border-input bg-input px-2.5 py-1.5 text-sm outline-none transition-all duration-fast hover:border-strong focus:border-accent ${open ? 'border-accent' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
      >
        {selected && (
          <div className="mt-0.5 shrink-0">
            <selected.icon size={14} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className={`truncate text-left ${selected ? 'text-default' : 'text-muted'}`}>
            {selected ? t(`typeSelector.${selected.i18nKey}` as TranslationKey) : t('typeSelector.type')}
          </div>
          {(constraintLabel || (allowedTypeLabels?.length ?? 0) > 0) && (
            <div className="mt-0.5 truncate text-[11px] text-secondary">
              {constraintLabel ?? allowedTypeLabels?.join(', ')}
            </div>
          )}
        </div>
        <ChevronDown size={12} className={`mt-0.5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed flex overflow-hidden rounded-lg border border-default bg-surface-panel"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight,
            visibility: dropdownPos.ready ? 'visible' : 'hidden',
            zIndex: 10001,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex w-[100px] shrink-0 flex-col border-r border-subtle bg-surface-base">
            <button
              className={`px-2.5 py-1.5 text-left text-xs transition-colors ${
                activeCategory === 'all'
                  ? 'bg-interactive-selected text-accent'
                  : 'text-secondary hover:bg-surface-hover hover:text-default'
              }`}
              onClick={() => setActiveCategory('all')}
            >
              {t('typeSelector.all')}
            </button>
            {visibleCategories.map((category) => {
              const hasResults = filteredCategories.some((filteredCategory) => filteredCategory.key === category.key);
              if (search && !hasResults) return null;
              return (
                <button
                  key={category.key}
                  className={`px-2.5 py-1.5 text-left text-xs transition-colors ${
                    activeCategory === category.key
                      ? 'bg-interactive-selected text-accent'
                      : 'text-secondary hover:bg-surface-hover hover:text-default'
                  }`}
                  onClick={() => setActiveCategory(category.key)}
                >
                  {t(`typeSelector.${category.key}` as TranslationKey)}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-1.5 border-b border-subtle px-2.5 py-2">
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

            {(constraintLabel || constraintDescription || (allowedTypeLabels?.length ?? 0) > 0) && (
              <div className="border-b border-subtle bg-surface-base px-3 py-2">
                {constraintLabel && (
                  <div className="text-xs font-medium text-default">
                    {constraintLabel}
                  </div>
                )}
                {constraintDescription && (
                  <div className="mt-1 text-[11px] leading-relaxed text-secondary">
                    {constraintDescription}
                  </div>
                )}
                {(allowedTypeLabels?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {allowedTypeLabels?.map((label) => (
                      <span
                        key={label}
                        className="rounded bg-surface-hover px-2 py-0.5 text-[11px] text-secondary"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {displayTypes.length > 0 ? (
                displayTypes.map((typeOption) => (
                  <button
                    key={typeOption.value}
                    type="button"
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover ${
                      typeOption.value === value ? 'bg-accent-muted text-accent' : 'text-default'
                    }`}
                    onClick={() => {
                      if (disabled) return;
                      onChange?.(typeOption.value);
                      setOpen(false);
                    }}
                  >
                    <typeOption.icon size={14} />
                    {t(`typeSelector.${typeOption.i18nKey}` as TranslationKey)}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-xs text-muted">
                  {t('typeSelector.noResults')}
                </div>
              )}
            </div>

            {hiddenTypeCount > 0 && !showAllTypes && (
              <div className="border-t border-subtle px-3 py-2">
                <div className="mb-2 text-[11px] text-muted">
                  {t(`typeSelector.level.${fieldComplexityLevel}` as TranslationKey)}
                  {' · '}
                  {t('typeSelector.hiddenCount' as TranslationKey).replace('{count}', String(hiddenTypeCount))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-subtle px-2.5 py-1 text-xs text-secondary transition-colors hover:border-default hover:text-default"
                    onClick={() => setShowAllTypes(true)}
                  >
                    {t('typeSelector.showAllTypes' as TranslationKey)}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-subtle px-2.5 py-1 text-xs text-secondary transition-colors hover:border-default hover:text-default"
                    onClick={() => {
                      setOpen(false);
                      setShowSettings(true);
                    }}
                  >
                    {t('typeSelector.openSettings' as TranslationKey)}
                  </button>
                </div>
              </div>
            )}

            {showAllTypes && hiddenTypeCount > 0 && (
              <div className="border-t border-subtle px-3 py-2">
                <button
                  type="button"
                  className="rounded-md border border-subtle px-2.5 py-1 text-xs text-secondary transition-colors hover:border-default hover:text-default"
                  onClick={() => setShowAllTypes(false)}
                >
                  {t('typeSelector.showRecommended' as TranslationKey)}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
