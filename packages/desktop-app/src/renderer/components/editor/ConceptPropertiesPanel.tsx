import React, { useEffect } from 'react';
import type { ArchetypeField } from '@netior/shared/types';
import { useArchetypeStore } from '../../stores/archetype-store';
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

interface ConceptPropertiesPanelProps {
  archetypeId: string;
  properties: Record<string, string | null>;
  onChange: (fieldId: string, value: string | null) => void;
}

function parseOptions(options: string | null): { choices?: string[] } {
  if (!options) return {};
  try {
    return JSON.parse(options);
  } catch {
    return {};
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
  const opts = parseOptions(field.options);
  const choices = (opts.choices ?? []).map((c) => ({ value: c, label: c }));

  const label = (
    <label className="text-xs font-medium text-muted">
      {field.name}
      {field.required && <span className="text-status-error ml-0.5">*</span>}
    </label>
  );

  switch (field.field_type) {
    case 'text':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <Input
            inputSize="sm"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </div>
      );
    case 'textarea':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <TextArea
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            rows={3}
          />
        </div>
      );
    case 'number':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <NumberInput
            value={value ? Number(value) : 0}
            onChange={(val) => onChange(String(val))}
          />
        </div>
      );
    case 'boolean':
      return (
        <div className="flex items-center gap-2 py-0.5">
          <Toggle
            checked={value === 'true'}
            onChange={(checked) => onChange(String(checked))}
            label={field.name}
          />
        </div>
      );
    case 'date':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <DatePicker value={value ?? ''} onChange={(v) => onChange(v || null)} />
        </div>
      );
    case 'datetime':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <DatePicker value={value ?? ''} onChange={(v) => onChange(v || null)} includeTime />
        </div>
      );
    case 'select':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <Select
            options={choices}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            selectSize="sm"
            placeholder="Select..."
          />
        </div>
      );
    case 'multi-select': {
      const arr: string[] = value ? JSON.parse(value) : [];
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <MultiSelect
            options={choices}
            value={arr}
            onChange={(v) => onChange(v.length > 0 ? JSON.stringify(v) : null)}
          />
        </div>
      );
    }
    case 'radio':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <RadioGroup
            options={choices}
            value={value ?? undefined}
            onChange={(v) => onChange(v || null)}
          />
        </div>
      );
    case 'relation':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <RelationPicker
            value={value ?? undefined}
            onChange={(v) => onChange(v)}
          />
        </div>
      );
    case 'file':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <FilePicker
            value={value ?? undefined}
            onChange={(v) => onChange(v || null)}
          />
        </div>
      );
    case 'url':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <LinkInput
            value={value ?? undefined}
            onChange={(v) => onChange(v || null)}
          />
        </div>
      );
    case 'color':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <ColorPicker
            value={value ?? undefined}
            onChange={(v) => onChange(v)}
          />
        </div>
      );
    case 'rating':
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <Rating
            value={value ? Number(value) : 0}
            onChange={(v) => onChange(String(v))}
          />
        </div>
      );
    case 'tags': {
      const tags: string[] = value ? JSON.parse(value) : [];
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <TagInput
            value={tags}
            onChange={(v) => onChange(v.length > 0 ? JSON.stringify(v) : null)}
          />
        </div>
      );
    }
    default:
      return (
        <div className="flex flex-col gap-0.5">
          {label}
          <Input inputSize="sm" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
        </div>
      );
  }
}
