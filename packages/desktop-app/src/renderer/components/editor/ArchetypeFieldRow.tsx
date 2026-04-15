import React, { useState, useEffect } from 'react';
import type { ArchetypeField, ArchetypeFieldUpdate, FieldType, SystemSlotKey } from '@netior/shared/types';
import {
  getSemanticTraitDefinition,
  getSystemSlotDefinition,
  getSystemSlotDescriptionKey,
  getSystemSlotLabelKey,
} from '@netior/shared/constants';
import type { TranslationKey } from '@netior/shared/i18n';
import { Trash2 } from 'lucide-react';
import { Input } from '../ui/Input';
import { TypeSelector } from '../ui/TypeSelector';
import { Toggle } from '../ui/Toggle';
import { Tooltip } from '../ui/Tooltip';
import { ArchetypeRefPicker } from '../ui/ArchetypeRefPicker';
import { Select } from '../ui/Select';
import { useI18n } from '../../hooks/useI18n';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import {
  parseArchetypeFieldOptions,
  stringifyArchetypeFieldOptions,
} from '../../lib/archetype-field-options';

interface ArchetypeFieldRowProps {
  tabId: string;
  field: ArchetypeField;
  onUpdate: (id: string, data: ArchetypeFieldUpdate) => void;
  onDelete: (id: string) => void;
}

const CHOICE_TYPES = new Set(['select', 'multi-select', 'radio']);

const FIELD_TYPE_LABEL_KEYS: Record<FieldType, TranslationKey> = {
  text: 'typeSelector.text',
  textarea: 'typeSelector.textarea',
  number: 'typeSelector.number',
  boolean: 'typeSelector.boolean',
  date: 'typeSelector.dateType',
  datetime: 'typeSelector.datetime',
  select: 'typeSelector.select',
  'multi-select': 'typeSelector.multi-select',
  radio: 'typeSelector.radio',
  relation: 'typeSelector.relation',
  archetype_ref: 'typeSelector.archetype_ref',
  file: 'typeSelector.file',
  url: 'typeSelector.url',
  color: 'typeSelector.color',
  rating: 'typeSelector.rating',
  tags: 'typeSelector.tags',
};

function parseChoices(options: string | null): string {
  return parseArchetypeFieldOptions(options).choices.join(', ');
}

export function ArchetypeFieldRow({ tabId, field, onUpdate, onDelete }: ArchetypeFieldRowProps): JSX.Element {
  const { t } = useI18n();
  const archetypes = useArchetypeStore((state) => state.archetypes);
  const archetypeFields = useArchetypeStore((state) => state.fields[field.archetype_id] ?? []);
  const showOptions = CHOICE_TYPES.has(field.field_type);
  const showArchetypeRef = field.field_type === 'archetype_ref';
  const fieldOptions = parseArchetypeFieldOptions(field.options);
  const conceptOptionSourceId = fieldOptions.conceptOptionSourceIds[0] ?? null;
  const archetype = archetypes.find((item) => item.id === field.archetype_id);
  const slotDefinition = field.system_slot ? getSystemSlotDefinition(field.system_slot) : undefined;
  const allowedTypes = slotDefinition?.allowedFieldTypes as FieldType[] | undefined;
  const allowedTypeLabels = (allowedTypes ?? []).map((fieldType) => t(FIELD_TYPE_LABEL_KEYS[fieldType]));
  const slotLabel = field.system_slot ? t(getSystemSlotLabelKey(field.system_slot) as never) : undefined;
  const slotDescription = field.system_slot ? t(getSystemSlotDescriptionKey(field.system_slot) as never) : undefined;
  const isSlotLocked = field.slot_binding_locked;
  const traitSlots = Array.from(new Set<SystemSlotKey>(
    (archetype?.semantic_traits ?? []).flatMap((trait) => {
      const definition = getSemanticTraitDefinition(trait);
      if (!definition) return [];
      return [...definition.coreSlots, ...definition.optionalSlots];
    }),
  ));
  const assignedSlots = new Set<SystemSlotKey>(
    archetypeFields
      .filter((item) => item.id !== field.id && item.system_slot)
      .map((item) => item.system_slot as SystemSlotKey),
  );
  const slotOptions: Array<{ value: string; label: string }> = [
    { value: '', label: t('common.none') ?? 'None' },
    ...traitSlots
      .filter((slot) => !assignedSlots.has(slot) || field.system_slot === slot)
      .map((slot) => ({
        value: slot,
        label: t(getSystemSlotLabelKey(slot) as never),
      })),
  ];

  // Local state buffers to avoid breaking IME composition
  const [nameText, setNameText] = useState(field.name);
  const [optionsText, setOptionsText] = useState(() => parseChoices(field.options));
  const markDirty = () => {
    useEditorStore.getState().setDirty(tabId, true);
  };

  // Sync from external changes
  useEffect(() => { setNameText(field.name); }, [field.name]);
  useEffect(() => { setOptionsText(parseChoices(field.options)); }, [field.options]);

  const commitOptions = () => {
    const choices = optionsText.split(',').map((s) => s.trim()).filter(Boolean);
    markDirty();
    onUpdate(field.id, {
      options: stringifyArchetypeFieldOptions({
        ...fieldOptions,
        choices,
      }),
    });
  };

  const updateConceptOptionSource = (archetypeId: string | null) => {
    const patch: ArchetypeFieldUpdate = {
      options: stringifyArchetypeFieldOptions({
        ...fieldOptions,
        conceptOptionSourceIds: archetypeId ? [archetypeId] : [],
      }),
    };

    if (archetypeId && !nameText.trim()) {
      const sourceArchetype = archetypes.find((archetype) => archetype.id === archetypeId);
      if (sourceArchetype) {
        patch.name = sourceArchetype.name;
        setNameText(sourceArchetype.name);
      }
    }

    markDirty();
    onUpdate(field.id, patch);
  };

  return (
    <div className="flex flex-col gap-1.5 py-1.5 group">
      <div className="flex items-center gap-2">
        <Input
          inputSize="sm"
          className="flex-1 min-w-[100px]"
          value={nameText}
          placeholder={t('archetype.fieldName')}
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
        <TypeSelector
          value={field.field_type}
          onChange={(type) => {
            markDirty();
            onUpdate(field.id, {
              field_type: type,
              ref_archetype_id: type === 'archetype_ref' ? field.ref_archetype_id : null,
            });
          }}
          allowedTypes={allowedTypes}
          disabled={isSlotLocked}
          constraintLabel={slotLabel}
          constraintDescription={slotDescription}
          allowedTypeLabels={allowedTypeLabels}
        />
        <Toggle
          checked={field.required}
          onChange={(checked) => {
            markDirty();
            onUpdate(field.id, { required: checked });
          }}
          label={t('archetype.required')}
        />
        <Tooltip content={t('archetype.deleteField')} position="top">
          <button
            type="button"
            className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-status-error"
            onClick={() => {
              markDirty();
              onDelete(field.id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
      </div>

      {(slotOptions.length > 1 || field.system_slot) && (
        <div className="flex flex-col gap-1 pl-0">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] font-medium text-secondary">
              {t('semantic.ui.systemSlot' as never)}
            </span>
            <Select
              options={slotOptions}
              value={field.system_slot ?? ''}
              disabled={isSlotLocked}
              onChange={(e) => {
                const nextSlot = (e.target.value || null) as SystemSlotKey | null;
                const nextSlotDefinition = nextSlot ? getSystemSlotDefinition(nextSlot) : undefined;
                const nextFieldType = nextSlotDefinition && !nextSlotDefinition.allowedFieldTypes.includes(field.field_type)
                  ? nextSlotDefinition.allowedFieldTypes[0]
                  : field.field_type;
                markDirty();
                onUpdate(field.id, {
                  system_slot: nextSlot,
                  field_type: nextFieldType,
                  ref_archetype_id: nextFieldType === 'archetype_ref' ? field.ref_archetype_id : null,
                });
              }}
              selectSize="sm"
            />
          </div>
          {field.system_slot && (
            <div className="rounded-lg border border-subtle bg-surface-base px-3 py-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded bg-surface-hover px-2 py-0.5 text-[11px] text-secondary">
                  {slotLabel}
                </span>
                {slotDefinition?.contractLevel && (
                  <span className="rounded bg-surface-hover px-2 py-0.5 text-[11px] text-secondary">
                    {t(`semantic.contractLevel.${slotDefinition.contractLevel}` as never)}
                  </span>
                )}
                {field.generated_by_trait && (
                  <span className="rounded bg-surface-hover px-2 py-0.5 text-[11px] text-secondary">
                    {t('semantic.ui.autoGenerated' as never)}
                  </span>
                )}
                {field.slot_binding_locked && (
                  <span className="rounded bg-surface-hover px-2 py-0.5 text-[11px] text-secondary">
                    {t('semantic.ui.lockedBinding' as never)}
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-secondary">
                {slotDescription}
              </div>
              {allowedTypeLabels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {allowedTypeLabels.map((label) => (
                    <span
                      key={`${field.id}:${label}`}
                      className="rounded bg-surface-card px-2 py-0.5 text-[11px] text-secondary"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 text-[11px] text-muted">
                {t('semantic.ui.slotBindingHint' as never)}
              </div>
            </div>
          )}
        </div>
      )}

      {showOptions && (
        <div className="flex flex-col gap-1.5 pl-0">
          <Input
            inputSize="sm"
            value={optionsText}
            placeholder={t('archetype.options')}
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
              {t('archetype.conceptOptions' as never)}
            </div>
            <ArchetypeRefPicker
              mode="archetype"
              value={conceptOptionSourceId}
              excludeArchetypeId={field.archetype_id}
              onChange={updateConceptOptionSource}
            />
          </div>
        </div>
      )}

      {showArchetypeRef && (
        <div className="pl-0">
          <ArchetypeRefPicker
            mode="archetype"
            value={field.ref_archetype_id}
            excludeArchetypeId={field.archetype_id}
            onChange={(value) => {
              markDirty();
              onUpdate(field.id, { ref_archetype_id: value });
            }}
          />
        </div>
      )}
    </div>
  );
}
