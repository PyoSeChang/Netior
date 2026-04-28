import React, { useEffect, useMemo, useState } from 'react';
import type {
  SchemaField,
  SchemaFieldUpdate,
} from '@netior/shared/types';
import {
  getMeaningSlotDefinition,
  getMeaningSlotLabelKey,
} from '@netior/shared/constants';
import { Link2, Trash2 } from 'lucide-react';
import { Input } from '../ui/Input';
import { TypeSelector } from '../ui/TypeSelector';
import { Toggle } from '../ui/Toggle';
import { Tooltip } from '../ui/Tooltip';
import { SchemaRefPicker } from '../ui/SchemaRefPicker';
import { useI18n } from '../../hooks/useI18n';
import { useSchemaStore } from '../../stores/schema-store';
import { useEditorStore } from '../../stores/editor-store';
import {
  parseSchemaFieldOptions,
  stringifySchemaFieldOptions,
} from '../../lib/schema-field-options';
import { getFieldMeaningSlot } from '../../lib/field-meaning-bindings';

interface SchemaFieldRowProps {
  tabId: string;
  field: SchemaField;
  onUpdate: (id: string, data: SchemaFieldUpdate) => void;
  onDelete: (id: string) => void;
}

const CHOICE_TYPES = new Set(['select', 'multi-select', 'radio']);

function parseChoices(options: string | null): string {
  return parseSchemaFieldOptions(options).choices.join(', ');
}

export function SchemaFieldRow({
  tabId,
  field,
  onUpdate,
  onDelete,
}: SchemaFieldRowProps): JSX.Element {
  const { t } = useI18n();
  const schemas = useSchemaStore((state) => state.schemas);
  const showOptions = CHOICE_TYPES.has(field.field_type);
  const showSchemaRef = field.field_type === 'schema_ref';
  const fieldOptions = parseSchemaFieldOptions(field.options);
  const conceptOptionSourceId = fieldOptions.conceptOptionSourceIds[0] ?? null;
  const meaningSlot = getFieldMeaningSlot(field);
  const slotDefinition = meaningSlot ? getMeaningSlotDefinition(meaningSlot) : undefined;
  const allowedTypes = useMemo(() => (
    slotDefinition ? [...slotDefinition.allowedFieldTypes] : undefined
  ), [slotDefinition]);
  const slotLabel = meaningSlot ? t(getMeaningSlotLabelKey(meaningSlot) as never) : null;

  const [nameText, setNameText] = useState(field.name);
  const [optionsText, setOptionsText] = useState(() => parseChoices(field.options));
  const markDirty = () => {
    useEditorStore.getState().setDirty(tabId, true);
  };

  useEffect(() => { setNameText(field.name); }, [field.name]);
  useEffect(() => { setOptionsText(parseChoices(field.options)); }, [field.options]);

  const commitOptions = () => {
    const choices = optionsText.split(',').map((s) => s.trim()).filter(Boolean);
    markDirty();
    onUpdate(field.id, {
      options: stringifySchemaFieldOptions({
        ...fieldOptions,
        choices,
      }),
    });
  };

  const updateConceptOptionSource = (schemaId: string | null) => {
    const patch: SchemaFieldUpdate = {
      options: stringifySchemaFieldOptions({
        ...fieldOptions,
        conceptOptionSourceIds: schemaId ? [schemaId] : [],
      }),
    };

    if (schemaId && !nameText.trim()) {
      const sourceSchema = schemas.find((schema) => schema.id === schemaId);
      if (sourceSchema) {
        patch.name = sourceSchema.name;
        setNameText(sourceSchema.name);
      }
    }

    markDirty();
    onUpdate(field.id, patch);
  };

  return (
    <div className="group flex flex-col gap-2 rounded-lg border border-subtle bg-surface-card px-3 py-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,190px)_auto_auto] sm:items-center">
        {meaningSlot && (
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-secondary sm:col-span-4">
            <Link2 size={12} className="shrink-0 text-accent" />
            <span className="truncate font-medium text-default">{slotLabel}</span>
            {(field.generated_by_model ?? field.generated_by_model) && (
              <span className="shrink-0 rounded bg-accent-muted px-1.5 py-0.5 text-[10px] text-accent">
                {t('semantic.ui.fromModel' as never)}
              </span>
            )}
            {field.slot_binding_locked && (
              <span className="shrink-0 rounded bg-state-hover px-1.5 py-0.5 text-[10px] text-secondary">
                {t('semantic.ui.boundField' as never)}
              </span>
            )}
            {slotDefinition?.constraintLevel && (
              <span className="shrink-0 rounded bg-state-hover px-1.5 py-0.5 text-[10px] text-secondary">
                {t(`semantic.constraintLevel.${slotDefinition.constraintLevel}` as never)}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0">
          <Input
            inputSize="sm"
            className="min-w-[100px]"
            value={nameText}
            placeholder={t('schema.fieldName')}
            onChange={(e) => {
              markDirty();
              setNameText(e.target.value);
            }}
            onBlur={() => {
              markDirty();
              onUpdate(field.id, { name: nameText });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                markDirty();
                onUpdate(field.id, { name: nameText });
              }
            }}
          />
        </div>
        <TypeSelector
          value={field.field_type}
          onChange={(type) => {
            markDirty();
            onUpdate(field.id, {
              field_type: type,
              ref_schema_id: type === 'schema_ref' ? field.ref_schema_id : null,
            });
          }}
          allowedTypes={allowedTypes}
        />
        <Toggle
          checked={field.required}
          onChange={(checked) => {
            markDirty();
            onUpdate(field.id, { required: checked });
          }}
          label={t('schema.required')}
        />
        <Tooltip content={t('schema.deleteField')} position="top">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-state-hover hover:text-status-error"
            onClick={() => {
              markDirty();
              onDelete(field.id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
      </div>

      {showOptions && (
        <div className="flex flex-col gap-1.5">
          <Input
            inputSize="sm"
            value={optionsText}
            placeholder={t('schema.options')}
            onChange={(e) => {
              markDirty();
              setOptionsText(e.target.value);
            }}
            onBlur={commitOptions}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitOptions();
            }}
          />
          <div>
            <div className="mb-1 text-[11px] font-medium text-secondary">
              {t('schema.conceptOptions' as never)}
            </div>
            <SchemaRefPicker
              mode="schema"
              value={conceptOptionSourceId}
              excludeSchemaId={field.schema_id}
              onChange={updateConceptOptionSource}
            />
          </div>
        </div>
      )}

      {showSchemaRef && (
        <SchemaRefPicker
          mode="schema"
          value={field.ref_schema_id}
          excludeSchemaId={field.schema_id}
          onChange={(value) => {
            markDirty();
            onUpdate(field.id, { ref_schema_id: value });
          }}
        />
      )}
    </div>
  );
}
