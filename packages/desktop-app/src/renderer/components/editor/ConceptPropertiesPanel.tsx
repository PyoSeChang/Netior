import React, { useEffect, useMemo } from 'react';
import type { TranslationKey } from '@netior/shared/i18n';
import type { ArchetypeField, FieldType } from '@netior/shared/types';
import {
  getSystemSlotDefinition,
  getSystemSlotDescriptionKey,
  getSystemSlotLabelKey,
} from '@netior/shared/constants';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useConceptStore } from '../../stores/concept-store';
import { useProjectStore } from '../../stores/project-store';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { NumberInput } from '../ui/NumberInput';
import { Toggle } from '../ui/Toggle';
import { Select } from '../ui/Select';
import { RadioGroup } from '../ui/RadioGroup';
import { MultiSelect } from '../ui/MultiSelect';
import { TagInput } from '../ui/TagInput';
import { Rating } from '../ui/Rating';
import { ColorPicker } from '../ui/ColorPicker';
import { DatePicker } from '../ui/DatePicker';
import { LinkInput } from '../ui/LinkInput';
import { RelationPicker } from '../ui/RelationPicker';
import { FilePicker } from '../ui/FilePicker';
import { useI18n } from '../../hooks/useI18n';
import {
  parseArchetypeFieldOptions,
  toConceptOptionValue,
} from '../../lib/archetype-field-options';

interface ConceptPropertiesPanelProps {
  archetypeId: string;
  properties: Record<string, string | null>;
  onChange: (fieldId: string, value: string | null) => void;
}

function parseArrayValue(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseNestedPropertyValue(value: string | null): Record<string, string | null> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, item]) => typeof item === 'string' || item === null),
    ) as Record<string, string | null>;
  } catch {
    return {};
  }
}

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

function getSlotValidationMessage(
  field: ArchetypeField,
  value: string | null,
  t: (...args: any[]) => string,
): string | null {
  if (!field.system_slot || !value) return null;

  switch (field.system_slot) {
    case 'progress_ratio': {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 1) {
        return t('concept.slotValidation.progressRatioRange' as never);
      }
      return null;
    }
    case 'lat': {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue < -90 || numericValue > 90) {
        return t('concept.slotValidation.latitudeRange' as never);
      }
      return null;
    }
    case 'lng': {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue < -180 || numericValue > 180) {
        return t('concept.slotValidation.longitudeRange' as never);
      }
      return null;
    }
    default:
      return null;
  }
}

export function ConceptPropertiesPanel({ archetypeId, properties, onChange }: ConceptPropertiesPanelProps): JSX.Element {
  const fields = useArchetypeStore((s) => s.fields[archetypeId] ?? []);
  const loadFields = useArchetypeStore((s) => s.loadFields);

  useEffect(() => {
    loadFields(archetypeId);
  }, [archetypeId, loadFields]);

  if (fields.length === 0) return <></>;

  return (
    <div className="flex flex-col gap-2 border-b border-subtle px-3 py-3">
      {fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={properties[field.id] ?? null}
          onChange={(val) => onChange(field.id, val)}
        />
      ))}
    </div>
  );
}

interface FieldInputProps {
  field: ArchetypeField;
  value: string | null;
  onChange: (value: string | null) => void;
}

export function FieldInput({ field, value, onChange }: FieldInputProps): JSX.Element {
  const { t } = useI18n();
  const choices = useFieldChoiceOptions(field);
  const slotDefinition = field.system_slot ? getSystemSlotDefinition(field.system_slot) : undefined;
  const validationMessage = getSlotValidationMessage(field, value, t);
  const allowedTypeLabels = useMemo(() => (
    slotDefinition?.allowedFieldTypes.map((fieldType) => t(FIELD_TYPE_LABEL_KEYS[fieldType])) ?? []
  ), [slotDefinition, t]);

  const label = (
    <label className="text-xs font-medium text-muted">
      {field.name}
      {field.required && <span className="text-status-error ml-0.5">*</span>}
    </label>
  );

  const fieldMeta = (
    <FieldMeta
      slotLabel={field.system_slot ? t(getSystemSlotLabelKey(field.system_slot) as never) : undefined}
      slotDescription={field.system_slot ? t(getSystemSlotDescriptionKey(field.system_slot) as never) : undefined}
      contractLevel={slotDefinition?.contractLevel}
      allowedTypeLabels={allowedTypeLabels}
      validationMessage={validationMessage}
    />
  );

  switch (field.field_type) {
    case 'text':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <Input
            inputSize="sm"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
          {fieldMeta}
        </div>
      );
    case 'textarea':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <TextArea
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            rows={3}
          />
          {fieldMeta}
        </div>
      );
    case 'number':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <NumberInput
            value={value ? Number(value) : 0}
            onChange={(val) => onChange(String(val))}
          />
          {fieldMeta}
        </div>
      );
    case 'boolean':
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 py-0.5">
            <Toggle
              checked={value === 'true'}
              onChange={(checked) => onChange(String(checked))}
              label={field.name}
            />
          </div>
          {fieldMeta}
        </div>
      );
    case 'date':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <DatePicker value={value ?? ''} onChange={(v) => onChange(v || null)} />
          {fieldMeta}
        </div>
      );
    case 'datetime':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <DatePicker value={value ?? ''} onChange={(v) => onChange(v || null)} includeTime />
          {fieldMeta}
        </div>
      );
    case 'select':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <Select
            options={choices}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            selectSize="sm"
            placeholder="Select..."
          />
          {fieldMeta}
        </div>
      );
    case 'multi-select': {
      const arr = parseArrayValue(value);
      return (
        <div className="flex flex-col gap-1">
          {label}
          <MultiSelect
            options={choices}
            value={arr}
            onChange={(v) => onChange(v.length > 0 ? JSON.stringify(v) : null)}
          />
          {fieldMeta}
        </div>
      );
    }
    case 'radio':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <RadioGroup
            options={choices}
            value={value ?? undefined}
            onChange={(v) => onChange(v || null)}
          />
          {fieldMeta}
        </div>
      );
    case 'relation':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <RelationPicker
            value={value ?? undefined}
            onChange={(v) => onChange(v)}
          />
          {fieldMeta}
        </div>
      );
    case 'archetype_ref':
      return (
        <EmbeddedArchetypePropertiesInput
          field={field}
          value={value}
          onChange={onChange}
          missingTargetMessage={t('concept.referenceFieldNeedsType' as never)}
          emptyMessage={t('concept.embeddedFieldEmpty' as never)}
        />
      );
    case 'file':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <FilePicker
            value={value ?? undefined}
            onChange={(v) => onChange(v || null)}
          />
          {fieldMeta}
        </div>
      );
    case 'url':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <LinkInput
            value={value ?? undefined}
            onChange={(v) => onChange(v || null)}
          />
          {fieldMeta}
        </div>
      );
    case 'color':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <ColorPicker
            value={value ?? undefined}
            onChange={(v) => onChange(v)}
          />
          {fieldMeta}
        </div>
      );
    case 'rating':
      return (
        <div className="flex flex-col gap-1">
          {label}
          <Rating
            value={value ? Number(value) : 0}
            onChange={(v) => onChange(String(v))}
          />
          {fieldMeta}
        </div>
      );
    case 'tags': {
      const tags = parseArrayValue(value);
      return (
        <div className="flex flex-col gap-1">
          {label}
          <TagInput
            value={tags}
            onChange={(v) => onChange(v.length > 0 ? JSON.stringify(v) : null)}
          />
          {fieldMeta}
        </div>
      );
    }
    default:
      return (
        <div className="flex flex-col gap-1">
          {label}
          <Input inputSize="sm" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
          {fieldMeta}
        </div>
      );
  }
}

interface FieldMetaProps {
  slotLabel?: string;
  slotDescription?: string;
  contractLevel?: 'strict' | 'constrained' | 'loose';
  allowedTypeLabels: string[];
  validationMessage: string | null;
}

function FieldMeta({
  slotLabel,
  slotDescription,
  contractLevel,
  allowedTypeLabels,
  validationMessage,
}: FieldMetaProps): JSX.Element | null {
  const { t } = useI18n();

  if (!slotLabel && !validationMessage) return null;

  return (
    <div className="flex flex-col gap-1">
      {slotLabel && (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="accent">{`${t('concept.semanticSlot' as never)}: ${slotLabel}`}</Badge>
          {contractLevel && (
            <Badge variant={contractLevel === 'strict' ? 'accent' : 'default'}>
              {t(`concept.slotContract.${contractLevel}` as never)}
            </Badge>
          )}
        </div>
      )}
      {slotLabel && allowedTypeLabels.length > 0 && (
        <div className="text-[11px] text-muted">
          {`${t('concept.allowedFieldTypes' as never)}: ${allowedTypeLabels.join(', ')}`}
        </div>
      )}
      {slotDescription && (
        <div className="text-[11px] leading-relaxed text-secondary">
          {slotDescription}
        </div>
      )}
      {validationMessage && (
        <div className="text-[11px] text-status-warning">{validationMessage}</div>
      )}
    </div>
  );
}

interface EmbeddedArchetypePropertiesInputProps {
  field: ArchetypeField;
  value: string | null;
  onChange: (value: string | null) => void;
  missingTargetMessage: string;
  emptyMessage: string;
}

function EmbeddedArchetypePropertiesInput({
  field,
  value,
  onChange,
  missingTargetMessage,
  emptyMessage,
}: EmbeddedArchetypePropertiesInputProps): JSX.Element {
  const { t } = useI18n();
  const nestedFields = useArchetypeStore((state) => (
    field.ref_archetype_id ? state.fields[field.ref_archetype_id] ?? [] : []
  ));
  const loadFields = useArchetypeStore((state) => state.loadFields);
  const nestedValues = useMemo(() => parseNestedPropertyValue(value), [value]);

  useEffect(() => {
    if (!field.ref_archetype_id) return;
    loadFields(field.ref_archetype_id);
  }, [field.ref_archetype_id, loadFields]);

  const label = (
    <label className="text-xs font-medium text-muted">
      {field.name}
      {field.required && <span className="text-status-error ml-0.5">*</span>}
    </label>
  );

  const updateNestedValue = (fieldId: string, nextValue: string | null) => {
    const next = { ...nestedValues };
    if (nextValue == null) {
      delete next[fieldId];
    } else {
      next[fieldId] = nextValue;
    }

    onChange(Object.keys(next).length > 0 ? JSON.stringify(next) : null);
  };

  if (!field.ref_archetype_id) {
    return (
      <div className="flex flex-col gap-0.5">
        {label}
        <div className="rounded-lg border border-subtle bg-surface-base px-3 py-2 text-xs text-muted">
          {missingTargetMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <FieldMeta
        slotLabel={field.system_slot ? t(getSystemSlotLabelKey(field.system_slot) as never) : undefined}
        slotDescription={field.system_slot ? t(getSystemSlotDescriptionKey(field.system_slot) as never) : undefined}
        contractLevel={field.system_slot ? getSystemSlotDefinition(field.system_slot)?.contractLevel : undefined}
        allowedTypeLabels={field.system_slot
          ? (getSystemSlotDefinition(field.system_slot)?.allowedFieldTypes ?? []).map((fieldType) => t(FIELD_TYPE_LABEL_KEYS[fieldType]))
          : []}
        validationMessage={getSlotValidationMessage(field, value, t)}
      />
      <div className="rounded-xl border border-subtle bg-surface-base p-3">
        {nestedFields.length === 0 ? (
          <div className="text-xs text-muted">{emptyMessage}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {nestedFields.map((nestedField) => (
              <FieldInput
                key={`${field.id}:${nestedField.id}`}
                field={nestedField}
                value={nestedValues[nestedField.id] ?? null}
                onChange={(nextValue) => updateNestedValue(nestedField.id, nextValue)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function useFieldChoiceOptions(field: ArchetypeField): { value: string; label: string }[] {
  const currentProjectId = useProjectStore((state) => state.currentProject?.id ?? null);
  const concepts = useConceptStore((state) => state.concepts);
  const loadConcepts = useConceptStore((state) => state.loadByProject);
  const optionsConfig = useMemo(() => parseArchetypeFieldOptions(field.options), [field.options]);
  const sourceIds = optionsConfig.conceptOptionSourceIds;

  useEffect(() => {
    if (sourceIds.length === 0 || !currentProjectId || concepts.length > 0) return;
    loadConcepts(currentProjectId);
  }, [concepts.length, currentProjectId, loadConcepts, sourceIds.length]);

  return useMemo(() => {
    const staticOptions = optionsConfig.choices.map((choice) => ({
      value: choice,
      label: choice,
    }));
    const conceptOptions = concepts
      .filter((concept) => concept.archetype_id && sourceIds.includes(concept.archetype_id))
      .map((concept) => ({
        value: toConceptOptionValue(concept.id),
        label: concept.title,
      }));

    return [...staticOptions, ...conceptOptions];
  }, [concepts, optionsConfig.choices, sourceIds]);
}
