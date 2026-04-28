import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Boxes, Link2, X } from 'lucide-react';
import type { TranslationKey } from '@netior/shared/i18n';
import { useI18n } from '../../hooks/useI18n';
import { useSchemaStore } from '../../stores/schema-store';
import { useConceptStore } from '../../stores/concept-store';
import { useProjectStore } from '../../stores/project-store';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';

interface SchemaRefPickerProps {
  mode: 'schema' | 'concept';
  value?: string | null;
  onChange?: (value: string | null) => void;
  refSchemaId?: string | null;
  excludeSchemaId?: string | null;
  disabled?: boolean;
}

export function SchemaRefPicker({
  mode,
  value,
  onChange,
  refSchemaId,
  excludeSchemaId,
  disabled,
}: SchemaRefPickerProps): JSX.Element {
  const { t } = useI18n();
  const tk = (key: string) => t(key as TranslationKey);
  const currentProjectId = useProjectStore((state) => state.currentProject?.id ?? null);
  const loadConcepts = useConceptStore((state) => state.loadByProject);
  const concepts = useConceptStore((state) => state.concepts);
  const schemas = useSchemaStore((state) => state.schemas);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPos = useAnchoredDropdown(open, triggerRef, {
    estimatedHeight: 280,
    minWidth: 240,
  }, dropdownRef);

  useEffect(() => {
    if (mode !== 'concept' || !currentProjectId || concepts.length > 0) return;
    loadConcepts(currentProjectId);
  }, [mode, currentProjectId, concepts.length, loadConcepts]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = useMemo(() => {
    if (mode === 'schema') {
      return schemas
        .filter((schema) => schema.id !== excludeSchemaId)
        .map((schema) => ({
          id: schema.id,
          label: schema.name,
          color: schema.color,
          detail: t('schema.title'),
        }));
    }

    return concepts
      .filter((concept) => concept.schema_id === refSchemaId)
      .map((concept) => {
        const schema = schemas.find((item) => item.id === concept.schema_id);
        return {
          id: concept.id,
          label: concept.title,
          color: concept.color,
          detail: schema?.name ?? t('concept.properties'),
        };
      });
  }, [mode, schemas, concepts, excludeSchemaId, refSchemaId, t]);

  const selected = items.find((item) => item.id === value);

  const filtered = useMemo(() => {
    if (!search) return items;
    const query = search.toLowerCase();
    return items.filter((item) => (
      item.label.toLowerCase().includes(query)
      || item.detail.toLowerCase().includes(query)
    ));
  }, [items, search]);

  const placeholder = mode === 'schema'
    ? tk('schema.selectReferenceSchema')
    : tk('schema.selectReferenceConcept');

  const emptyMessage = mode === 'schema'
    ? tk('schema.noReferenceSchemas')
    : tk('schema.noReferenceConcepts');

  const Icon = mode === 'schema' ? Boxes : Link2;

  const handleOpen = () => {
    if (disabled) return;
    setOpen((current) => !current);
    setSearch('');
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={`flex items-center gap-2 px-3 py-1.5 bg-surface-input border border-input rounded-lg text-sm transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-strong'} ${open ? 'border-accent' : ''}`}
        onClick={handleOpen}
      >
        <Icon size={14} className="shrink-0 text-muted" />
        <span className={`flex-1 truncate ${selected ? 'text-default' : 'text-muted'}`}>
          {selected?.label ?? placeholder}
        </span>
        {value && !disabled && (
          <button
            type="button"
            className="text-muted hover:text-default"
            onClick={(event) => {
              event.stopPropagation();
              onChange?.(null);
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-surface-panel border border-default rounded-lg overflow-hidden"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight,
            visibility: dropdownPos.ready ? 'visible' : 'hidden',
            zIndex: 10001,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="p-2 border-b border-subtle">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('common.search')}
              className="w-full px-2 py-1 text-sm bg-surface-input border border-input rounded text-default outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-state-hover ${item.id === value ? 'bg-accent-muted text-accent' : 'text-default'}`}
                onClick={() => {
                  onChange?.(item.id);
                  setOpen(false);
                }}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-subtle bg-surface-editor">
                  {item.color ? (
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  ) : (
                    <Icon size={12} className="text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{item.label}</div>
                  <div className="truncate text-xs text-muted">{item.detail}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-xs text-muted text-center">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
