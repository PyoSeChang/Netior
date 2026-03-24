import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useConceptStore } from '../../stores/concept-store';

export function ConceptSearch(): JSX.Element {
  const { concepts } = useConceptStore();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? concepts.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    : concepts;

  return (
    <div className="flex flex-col gap-1 px-2">
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="w-full rounded border border-subtle bg-input py-1 pl-7 pr-2 text-xs text-default outline-none focus:border-accent"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concepts..."
        />
      </div>
      <div className="flex flex-col gap-0.5">
        {filtered.length === 0 ? (
          <span className="px-1 py-2 text-xs text-muted">No results</span>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className="rounded px-2 py-1 text-xs text-secondary hover:bg-surface-hover hover:text-default"
            >
              <span>{c.icon || '📌'}</span>{' '}
              <span>{c.title}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
