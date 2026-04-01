import React, { useState, useCallback } from 'react';
import type { NarreInterviewCard } from '@netior/shared/types';
import { useI18n } from '../../../../hooks/useI18n';
import { Button } from '../../../ui/Button';
import { Checkbox } from '../../../ui/Checkbox';

interface InterviewCardProps {
  card: NarreInterviewCard;
  onSelect: (selected: string[]) => void;
}

export function InterviewCard({
  card,
  onSelect,
}: InterviewCardProps): JSX.Element {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);

  const handleToggle = useCallback(
    (value: string) => {
      setSelected((prev) => {
        if (card.multi) {
          return prev.includes(value)
            ? prev.filter((v) => v !== value)
            : [...prev, value];
        }
        // Single select: replace
        return prev.includes(value) ? [] : [value];
      });
    },
    [card.multi],
  );

  return (
    <div className="mt-2 rounded-lg border border-subtle bg-surface-card p-3">
      <p className="text-xs font-medium text-text-default mb-2">
        {card.question}
      </p>

      <div className="flex flex-col gap-1.5">
        {card.options.map((opt) => {
          const isSelected = selected.includes(opt.value);
          if (card.multi) {
            return (
              <Checkbox
                key={opt.value}
                checked={isSelected}
                onChange={() => handleToggle(opt.value)}
                label={opt.label}
              />
            );
          }
          // Single select: radio-like with styled buttons
          return (
            <button
              key={opt.value}
              type="button"
              className={[
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors',
                isSelected
                  ? 'bg-accent-muted text-accent border border-accent'
                  : 'bg-surface-hover text-text-default border border-transparent hover:border-subtle',
              ].join(' ')}
              onClick={() => handleToggle(opt.value)}
            >
              <div
                className={[
                  'w-3 h-3 rounded-full border-2 shrink-0 transition-colors',
                  isSelected
                    ? 'border-accent bg-accent'
                    : 'border-border-default bg-transparent',
                ].join(' ')}
              />
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end mt-3">
        <Button
          variant="primary"
          size="sm"
          disabled={selected.length === 0}
          onClick={() => onSelect(selected)}
        >
          {t('narre.card.interviewSubmit')}
        </Button>
      </div>
    </div>
  );
}
