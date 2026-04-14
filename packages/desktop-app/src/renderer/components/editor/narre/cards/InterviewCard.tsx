import React, { useState, useCallback } from 'react';
import type { NarreInterviewCard, NarreInterviewResponse } from '@netior/shared/types';
import { useI18n } from '../../../../hooks/useI18n';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Checkbox } from '../../../ui/Checkbox';
import { TextArea } from '../../../ui/TextArea';

interface InterviewCardProps {
  card: NarreInterviewCard;
  onSelect: (response: NarreInterviewResponse) => Promise<void> | void;
}

export function InterviewCard({
  card,
  onSelect,
}: InterviewCardProps): JSX.Element {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  const handleToggle = useCallback(
    (value: string) => {
      if (status === 'submitted' || status === 'submitting') {
        return;
      }
      if (status === 'error') {
        setStatus('idle');
      }
      setSelected((prev) => {
        if (card.multiSelect) {
          return prev.includes(value)
            ? prev.filter((v) => v !== value)
            : [...prev, value];
        }
        // Single select: replace
        return prev.includes(value) ? [] : [value];
      });
    },
    [card.multiSelect, status],
  );

  const canSubmit = selected.length > 0 || text.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || status === 'submitted' || status === 'submitting') {
      return;
    }

    setStatus('submitting');
    try {
      await onSelect({
        selected,
        ...(text.trim() ? { text: text.trim() } : {}),
      });
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  }, [canSubmit, onSelect, selected, status, text]);

  return (
    <div className="mt-2 rounded-lg border border-subtle bg-surface-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-default">
          {card.question}
        </p>
        {status === 'submitting' && <Badge variant="warning">{t('narre.card.submitting')}</Badge>}
        {status === 'submitted' && <Badge variant="success">{t('narre.card.submitted')}</Badge>}
        {status === 'error' && <Badge variant="error">{t('narre.card.submitFailed')}</Badge>}
      </div>

      <div className="flex flex-col gap-2.5">
        {card.options.map((opt) => {
          const optionValue = opt.label;
          const isSelected = selected.includes(optionValue);
          return (
            <div
              key={optionValue}
              className={[
                'flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors',
                isSelected
                  ? 'border-accent bg-accent-muted/40'
                  : 'border-subtle bg-surface-base hover:bg-surface-hover',
                status === 'submitted' ? 'opacity-80' : '',
              ].join(' ')}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => handleToggle(optionValue)}
                disabled={status === 'submitted' || status === 'submitting'}
                label=""
              />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                disabled={status === 'submitted' || status === 'submitting'}
                onClick={() => handleToggle(optionValue)}
              >
                <div className="text-xs font-medium text-default">{opt.label}</div>
                {opt.description && (
                  <div className="mt-0.5 text-xs text-muted">{opt.description}</div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {(card.allowText ?? true) && (
        <div className="mt-3">
          <TextArea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (status === 'error') {
                setStatus('idle');
              }
            }}
            placeholder={card.textPlaceholder ?? t('narre.card.interviewPlaceholder')}
            disabled={status === 'submitted' || status === 'submitting'}
            className="min-h-[72px] text-xs"
          />
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button
          variant="primary"
          size="sm"
          disabled={!canSubmit || status === 'submitted' || status === 'submitting'}
          onClick={() => { void handleSubmit(); }}
        >
          {status === 'submitting'
            ? t('narre.card.submitting')
            : status === 'submitted'
              ? t('narre.card.submitted')
              : (card.submitLabel ?? t('narre.card.interviewSubmit'))}
        </Button>
      </div>
    </div>
  );
}
