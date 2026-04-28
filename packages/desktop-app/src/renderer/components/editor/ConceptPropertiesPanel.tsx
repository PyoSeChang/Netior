import React, { useEffect, useMemo } from 'react';
import type { TranslationKey } from '@netior/shared/i18n';
import type { SchemaField, FieldType, MeaningSlotKey } from '@netior/shared/types';
import {
  getMeaningSlotDefinition,
  getMeaningSlotDescriptionKey,
  getMeaningSlotLabelKey,
} from '@netior/shared/constants';
import { useSchemaStore } from '../../stores/schema-store';
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
  parseSchemaFieldOptions,
  toConceptOptionValue,
} from '../../lib/schema-field-options';
import { getFieldMeaningSlot } from '../../lib/field-meaning-bindings';

interface ConceptPropertiesPanelProps {
  schemaId: string;
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
  schema_ref: 'typeSelector.schema_ref',
  file: 'typeSelector.file',
  url: 'typeSelector.url',
  color: 'typeSelector.color',
  rating: 'typeSelector.rating',
  tags: 'typeSelector.tags',
};

const RECURRENCE_SLOT_ORDER = [
  'recurrence_frequency',
  'recurrence_interval',
  'recurrence_weekdays',
  'recurrence_monthday',
  'recurrence_until',
  'recurrence_count',
] as const satisfies readonly MeaningSlotKey[];

const RECURRENCE_SLOT_SET = new Set<MeaningSlotKey>([
  ...RECURRENCE_SLOT_ORDER,
  'recurrence_rule',
]);

function isRecurrenceField(field: SchemaField): boolean {
  const slot = getFieldMeaningSlot(field);
  return Boolean(slot && RECURRENCE_SLOT_SET.has(slot));
}

function getSlotValidationMessage(
  field: SchemaField,
  value: string | null,
  t: (...args: any[]) => string,
): string | null {
  const slot = getFieldMeaningSlot(field);
  if (!slot || !value) return null;

  switch (slot) {
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

export function ConceptPropertiesPanel({ schemaId, properties, onChange }: ConceptPropertiesPanelProps): JSX.Element {
  const fields = useSchemaStore((s) => s.fields[schemaId] ?? []);
  const loadFields = useSchemaStore((s) => s.loadFields);

  useEffect(() => {
    loadFields(schemaId);
  }, [schemaId, loadFields]);

  if (fields.length === 0) return <></>;

  return (
    <ConceptPropertyInputs
      fields={fields}
      properties={properties}
      onChange={onChange}
    />
  );
}

interface ConceptPropertyInputsProps {
  fields: SchemaField[];
  properties: Record<string, string | null>;
  onChange: (fieldId: string, value: string | null) => void;
}

export function ConceptPropertyInputs({
  fields,
  properties,
  onChange,
}: ConceptPropertyInputsProps): JSX.Element | null {
  const recurrenceFields = useMemo(
    () => fields.filter((field) => isRecurrenceField(field) && getFieldMeaningSlot(field) !== 'recurrence_rule'),
    [fields],
  );
  const visibleFields = useMemo(
    () => fields.filter((field) => !isRecurrenceField(field)),
    [fields],
  );

  if (visibleFields.length === 0 && recurrenceFields.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-subtle px-3 py-3">
      {recurrenceFields.length > 0 && (
        <RecurrenceMeaningInput
          fields={recurrenceFields}
          properties={properties}
          onChange={onChange}
        />
      )}
      {visibleFields.map((field) => (
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

function RecurrenceMeaningInput({
  fields,
  properties,
  onChange,
}: ConceptPropertyInputsProps): JSX.Element {
  const { t } = useI18n();
  const fieldBySlot = useMemo(() => {
    const map = new Map<MeaningSlotKey, SchemaField>();
    for (const field of fields) {
      const slot = getFieldMeaningSlot(field);
      if (slot) map.set(slot, field);
    }
    return map;
  }, [fields]);

  const frequencyField = fieldBySlot.get('recurrence_frequency');
  const intervalField = fieldBySlot.get('recurrence_interval');
  const weekdaysField = fieldBySlot.get('recurrence_weekdays');
  const monthdayField = fieldBySlot.get('recurrence_monthday');
  const untilField = fieldBySlot.get('recurrence_until');
  const countField = fieldBySlot.get('recurrence_count');

  const frequencyOptions = [
    { value: 'daily', label: t('concept.recurrence.frequency.daily' as never) },
    { value: 'weekly', label: t('concept.recurrence.frequency.weekly' as never) },
    { value: 'monthly', label: t('concept.recurrence.frequency.monthly' as never) },
  ];
  const weekdayOptions = [
    { value: 'SU', label: t('concept.recurrence.weekday.sunday' as never) },
    { value: 'MO', label: t('concept.recurrence.weekday.monday' as never) },
    { value: 'TU', label: t('concept.recurrence.weekday.tuesday' as never) },
    { value: 'WE', label: t('concept.recurrence.weekday.wednesday' as never) },
    { value: 'TH', label: t('concept.recurrence.weekday.thursday' as never) },
    { value: 'FR', label: t('concept.recurrence.weekday.friday' as never) },
    { value: 'SA', label: t('concept.recurrence.weekday.saturday' as never) },
  ];

  const renderLabel = (field: SchemaField | undefined, slot: MeaningSlotKey) => (
    <label className="text-xs font-medium text-muted">
      {t(getMeaningSlotLabelKey(slot) as never)}
      {field?.required && <span className="text-status-error ml-0.5">*</span>}
    </label>
  );

  return (
    <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3">
      <div className="mb-3">
        <div className="text-xs font-semibold text-default">{t('concept.recurrence.title' as never)}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-secondary">
          {t('concept.recurrence.description' as never)}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {frequencyField && (
          <div className="flex flex-col gap-1">
            {renderLabel(frequencyField, 'recurrence_frequency')}
            <Select
              options={frequencyOptions}
              value={properties[frequencyField.id] ?? ''}
              onChange={(e) => onChange(frequencyField.id, e.target.value || null)}
              selectSize="sm"
            />
          </div>
        )}

        {intervalField && (
          <div className="flex flex-col gap-1">
            {renderLabel(intervalField, 'recurrence_interval')}
            <NumberInput
              value={properties[intervalField.id] ? Number(properties[intervalField.id]) : 1}
              onChange={(value) => onChange(intervalField.id, String(Math.max(1, Math.floor(value))))}
            />
          </div>
        )}

        {weekdaysField && (
          <div className="flex flex-col gap-1 md:col-span-2">
            {renderLabel(weekdaysField, 'recurrence_weekdays')}
            <div className="rounded-lg border border-subtle bg-surface-card px-3 py-2">
              <MultiSelect
                options={weekdayOptions}
                value={parseArrayValue(properties[weekdaysField.id] ?? null)}
                onChange={(value) => onChange(weekdaysField.id, value.length > 0 ? JSON.stringify(value) : null)}
              />
            </div>
          </div>
        )}

        {monthdayField && (
          <div className="flex flex-col gap-1">
            {renderLabel(monthdayField, 'recurrence_monthday')}
            <NumberInput
              value={properties[monthdayField.id] ? Number(properties[monthdayField.id]) : 1}
              onChange={(value) => onChange(monthdayField.id, String(Math.max(1, Math.min(31, Math.floor(value)))))}
            />
          </div>
        )}

        {untilField && (
          <div className="flex flex-col gap-1">
            {renderLabel(untilField, 'recurrence_until')}
            <DatePicker value={properties[untilField.id] ?? ''} onChange={(value) => onChange(untilField.id, value || null)} />
          </div>
        )}

        {countField && (
          <div className="flex flex-col gap-1">
            {renderLabel(countField, 'recurrence_count')}
            <NumberInput
              value={properties[countField.id] ? Number(properties[countField.id]) : 1}
              onChange={(value) => onChange(countField.id, String(Math.max(1, Math.floor(value))))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldInputProps {
  field: SchemaField;
  value: string | null;
  onChange: (value: string | null) => void;
}

export function FieldInput({ field, value, onChange }: FieldInputProps): JSX.Element {
  const { t } = useI18n();
  const choices = useFieldChoiceOptions(field);
  const meaningSlot = getFieldMeaningSlot(field);
  const slotDefinition = meaningSlot ? getMeaningSlotDefinition(meaningSlot) : undefined;
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
      slotLabel={meaningSlot ? t(getMeaningSlotLabelKey(meaningSlot) as never) : undefined}
      slotDescription={meaningSlot ? t(getMeaningSlotDescriptionKey(meaningSlot) as never) : undefined}
      constraintLevel={slotDefinition?.constraintLevel}
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
    case 'schema_ref':
      return (
        <EmbeddedSchemaPropertiesInput
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
  constraintLevel?: 'strict' | 'constrained' | 'loose';
  allowedTypeLabels: string[];
  validationMessage: string | null;
}

function FieldMeta({
  slotLabel,
  slotDescription,
  constraintLevel,
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
          {constraintLevel && (
            <Badge variant={constraintLevel === 'strict' ? 'accent' : 'default'}>
              {t(`concept.slotConstraint.${constraintLevel}` as never)}
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

interface EmbeddedSchemaPropertiesInputProps {
  field: SchemaField;
  value: string | null;
  onChange: (value: string | null) => void;
  missingTargetMessage: string;
  emptyMessage: string;
}

function EmbeddedSchemaPropertiesInput({
  field,
  value,
  onChange,
  missingTargetMessage,
  emptyMessage,
}: EmbeddedSchemaPropertiesInputProps): JSX.Element {
  const { t } = useI18n();
  const nestedFields = useSchemaStore((state) => (
    field.ref_schema_id ? state.fields[field.ref_schema_id] ?? [] : []
  ));
  const loadFields = useSchemaStore((state) => state.loadFields);
  const nestedValues = useMemo(() => parseNestedPropertyValue(value), [value]);

  useEffect(() => {
    if (!field.ref_schema_id) return;
    loadFields(field.ref_schema_id);
  }, [field.ref_schema_id, loadFields]);

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
  const meaningSlot = getFieldMeaningSlot(field);
  const slotDefinition = meaningSlot ? getMeaningSlotDefinition(meaningSlot) : undefined;

  if (!field.ref_schema_id) {
    return (
      <div className="flex flex-col gap-0.5">
        {label}
        <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-2 text-xs text-muted">
          {missingTargetMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <FieldMeta
        slotLabel={meaningSlot ? t(getMeaningSlotLabelKey(meaningSlot) as never) : undefined}
        slotDescription={meaningSlot ? t(getMeaningSlotDescriptionKey(meaningSlot) as never) : undefined}
        constraintLevel={slotDefinition?.constraintLevel}
        allowedTypeLabels={(slotDefinition?.allowedFieldTypes ?? []).map((fieldType) => t(FIELD_TYPE_LABEL_KEYS[fieldType]))}
        validationMessage={getSlotValidationMessage(field, value, t)}
      />
      <div className="rounded-xl border border-subtle bg-surface-editor p-3">
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

function useFieldChoiceOptions(field: SchemaField): { value: string; label: string }[] {
  const currentProjectId = useProjectStore((state) => state.currentProject?.id ?? null);
  const concepts = useConceptStore((state) => state.concepts);
  const loadConcepts = useConceptStore((state) => state.loadByProject);
  const optionsConfig = useMemo(() => parseSchemaFieldOptions(field.options), [field.options]);
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
      .filter((concept) => concept.schema_id && sourceIds.includes(concept.schema_id))
      .map((concept) => ({
        value: toConceptOptionValue(concept.id),
        label: concept.title,
      }));

    return [...staticOptions, ...conceptOptions];
  }, [concepts, optionsConfig.choices, sourceIds]);
}
