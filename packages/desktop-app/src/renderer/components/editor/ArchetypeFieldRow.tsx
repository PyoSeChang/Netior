import React, { useState, useEffect } from 'react';
import type { ArchetypeField, ArchetypeFieldUpdate } from '@netior/shared/types';
import { Trash2 } from 'lucide-react';
import { Input } from '../ui/Input';
import { TypeSelector } from '../ui/TypeSelector';
import { Toggle } from '../ui/Toggle';
import { Tooltip } from '../ui/Tooltip';
import { useI18n } from '../../hooks/useI18n';

interface ArchetypeFieldRowProps {
  field: ArchetypeField;
  onUpdate: (id: string, data: ArchetypeFieldUpdate) => void;
  onDelete: (id: string) => void;
}

const CHOICE_TYPES = new Set(['select', 'multi-select', 'radio']);

function parseChoices(options: string | null): string {
  if (!options) return '';
  try {
    return JSON.parse(options).choices?.join(', ') ?? '';
  } catch {
    return '';
  }
}

export function ArchetypeFieldRow({ field, onUpdate, onDelete }: ArchetypeFieldRowProps): JSX.Element {
  const { t } = useI18n();
  const showOptions = CHOICE_TYPES.has(field.field_type);

  // Local state for options input so commas can be typed freely
  const [optionsText, setOptionsText] = useState(() => parseChoices(field.options));

  // Sync from external changes
  useEffect(() => {
    setOptionsText(parseChoices(field.options));
  }, [field.options]);

  const commitOptions = () => {
    const choices = optionsText.split(',').map((s) => s.trim()).filter(Boolean);
    onUpdate(field.id, { options: JSON.stringify({ choices }) });
  };

  return (
    <div className="flex flex-col gap-1.5 py-1.5 group">
      {/* Main row: name + type + required + delete */}
      <div className="flex items-center gap-2">
        <Input
          inputSize="sm"
          className="flex-1 min-w-[100px]"
          value={field.name}
          placeholder={t('archetype.fieldName')}
          onChange={(e) => onUpdate(field.id, { name: e.target.value })}
          onBlur={(e) => onUpdate(field.id, { name: e.target.value })}
        />
        <TypeSelector
          value={field.field_type}
          onChange={(type) => onUpdate(field.id, { field_type: type })}
        />
        <Toggle
          checked={field.required}
          onChange={(checked) => onUpdate(field.id, { required: checked })}
          label={t('archetype.required')}
        />
        <Tooltip content={t('archetype.deleteField')} position="top">
          <button
            type="button"
            className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-status-error"
            onClick={() => onDelete(field.id)}
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
      </div>

      {/* Options row (only for choice types) */}
      {showOptions && (
        <div className="pl-0">
          <Input
            inputSize="sm"
            value={optionsText}
            placeholder={t('archetype.options')}
            onChange={(e) => setOptionsText(e.target.value)}
            onBlur={commitOptions}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitOptions();
            }}
          />
        </div>
      )}
    </div>
  );
}
