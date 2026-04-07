import React, { useCallback, useEffect, useRef } from 'react';
import { Input } from '../ui/Input';
import { useI18n } from '../../hooks/useI18n';

export interface SearchBarProps {
  query: string;
  filterSemanticType: string | null;
  semanticTypes: { key: string; label: string }[];
  onQueryChange: (query: string) => void;
  onFilterChange: (type: string | null) => void;
  onClose: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  filterSemanticType,
  semanticTypes,
  onQueryChange,
  onFilterChange,
  onClose,
}) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onQueryChange('');
        onFilterChange(null);
        onClose();
      }
    },
    [onQueryChange, onFilterChange, onClose],
  );

  return (
    <div className="flex gap-2 p-2 bg-surface-panel border border-subtle rounded-lg shadow-md" onKeyDown={handleKeyDown}>
      <Input
        ref={inputRef}
        className="flex-1"
        type="text"
        placeholder={t('network.searchPlaceholder')}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <select
        className="py-1 px-2 bg-surface-base border border-default rounded-md text-default text-sm outline-none cursor-pointer focus:border-accent"
        value={filterSemanticType ?? ''}
        onChange={(e) => onFilterChange(e.target.value || null)}
      >
        <option value="">{t('network.allTypes')}</option>
        {semanticTypes.map((st) => (
          <option key={st.key} value={st.key}>
            {st.label}
          </option>
        ))}
      </select>
    </div>
  );
};
