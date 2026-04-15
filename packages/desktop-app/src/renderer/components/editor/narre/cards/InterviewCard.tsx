import React, { useState, useCallback, useEffect } from 'react';
import { Check } from 'lucide-react';
import type { NarreInterviewCard, NarreInterviewResponse } from '@netior/shared/types';
import { useI18n } from '../../../../hooks/useI18n';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { TextArea } from '../../../ui/TextArea';

interface InterviewCardProps {
  card: NarreInterviewCard;
  onSelect: (response: NarreInterviewResponse) => Promise<void> | void;
  embedded?: boolean;
}

export function InterviewCard({
  card,
  onSelect,
  embedded = false,
}: InterviewCardProps): JSX.Element {
  const { t } = useI18n();
  const submittedResponse = card.submittedResponse;
  const [selected, setSelected] = useState<string[]>(submittedResponse?.selected ?? []);
  const [text, setText] = useState(submittedResponse?.text ?? '');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>(
    submittedResponse ? 'submitted' : 'idle',
  );
  const isSubmitted = status === 'submitted' || Boolean(submittedResponse);
  const isLocked = isSubmitted || status === 'submitting';

  useEffect(() => {
    setSelected(submittedResponse?.selected ?? []);
    setText(submittedResponse?.text ?? '');
    setStatus(submittedResponse ? 'submitted' : 'idle');
  }, [submittedResponse]);

  const handleToggle = useCallback(
    (value: string) => {
      if (isLocked) {
        return;
      }
      if (status === 'error') {
        setStatus('idle');
      }
      setSelected((prev) => {
        return prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value];
      });
    },
    [isLocked, status],
  );

  const canSubmit = selected.length > 0 || text.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isLocked) {
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
  }, [canSubmit, isLocked, onSelect, selected, text]);

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-3 px-3 py-3'}>
      <div className="flex flex-col gap-2.5">
        {card.options.map((opt) => {
          const optionValue = opt.label;
          const isSelected = selected.includes(optionValue);
          return (
            <button
              key={optionValue}
              type="button"
              className={[
                'flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                isSelected
                  ? 'border-accent bg-accent-muted/40'
                  : 'border-subtle bg-surface-base hover:bg-surface-hover',
                isLocked ? 'opacity-80' : '',
              ].join(' ')}
              disabled={isLocked}
              aria-pressed={isSelected}
              onClick={() => handleToggle(optionValue)}
            >
              <span
                className={[
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  isSelected
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-subtle bg-surface-base text-muted',
                ].join(' ')}
              >
                {isSelected && <Check size={11} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-default">{opt.label}</span>
                {opt.description && (
                  <span className="mt-0.5 block text-xs text-muted">{opt.description}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {(card.allowText ?? true) && !isSubmitted && (
        <div>
          <TextArea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (status === 'error') {
                setStatus('idle');
              }
            }}
            placeholder={card.textPlaceholder ?? t('narre.card.interviewPlaceholder')}
            disabled={isLocked}
            className="min-h-[72px] text-xs"
          />
        </div>
      )}

      {isSubmitted && text.trim().length > 0 && (
        <div className="rounded-lg border border-subtle bg-surface-base px-3 py-2">
          <div className="whitespace-pre-wrap text-sm text-secondary">{text}</div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          {status === 'submitting' && <Badge variant="warning">{t('narre.card.submitting')}</Badge>}
          {isSubmitted && <Badge variant="success">{t('narre.card.submitted')}</Badge>}
          {status === 'error' && <Badge variant="error">{t('narre.card.submitFailed')}</Badge>}
        </div>
        {!isSubmitted && (
          <Button
            variant="primary"
            size="sm"
            disabled={!canSubmit || isLocked}
            onClick={() => { void handleSubmit(); }}
          >
            {status === 'submitting'
              ? t('narre.card.submitting')
              : (card.submitLabel ?? t('narre.card.interviewSubmit'))}
          </Button>
        )}
      </div>
    </div>
  );
}
