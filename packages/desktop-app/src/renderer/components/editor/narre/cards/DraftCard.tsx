import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NarreDraftCard, NarreDraftResponse } from '@netior/shared/types';
import { useI18n } from '../../../../hooks/useI18n';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { TextArea } from '../../../ui/TextArea';

interface DraftCardProps {
  card: NarreDraftCard;
  onRespond: (response: NarreDraftResponse) => Promise<void> | void;
}

function normalizeDraftContent(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
}

export function DraftCard({
  card,
  onRespond,
}: DraftCardProps): JSX.Element {
  const { t } = useI18n();
  const editorRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(card.content);
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  useEffect(() => {
    setContent(card.content);
  }, [card.content]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) {
      return;
    }

    if (normalizeDraftContent(el.innerText || '') === normalizeDraftContent(content)) {
      return;
    }

    el.innerText = content;
  }, [content]);

  const handleEditorInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) {
      return;
    }

    setContent(normalizeDraftContent(el.innerText || ''));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (status === 'submitting' || status === 'submitted') {
      return;
    }

    setStatus('submitting');
    try {
      await onRespond({
        action: 'confirm',
        content: content.trim(),
      });
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  }, [content, onRespond, status]);

  const handleFeedback = useCallback(async () => {
    if (status === 'submitting' || status === 'submitted') {
      return;
    }

    setStatus('submitting');
    try {
      await onRespond({
        action: 'feedback',
        content: content.trim(),
        feedback: feedback.trim(),
      });
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  }, [content, feedback, onRespond, status]);

  const feedbackDisabled = status === 'submitting'
    || status === 'submitted'
    || (content.trim() === card.content.trim() && feedback.trim().length === 0);

  return (
    <div className="mt-2 rounded-lg border border-subtle bg-surface-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {card.title ? (
            <h4 className="truncate text-xs font-semibold text-default">
              {card.title}
            </h4>
          ) : null}
          <Badge>{card.format ?? 'markdown'}</Badge>
        </div>
        {status === 'submitting' && <Badge variant="warning">{t('narre.card.submitting')}</Badge>}
        {status === 'submitted' && <Badge variant="success">{t('narre.card.submitted')}</Badge>}
        {status === 'error' && <Badge variant="error">{t('narre.card.submitFailed')}</Badge>}
      </div>

      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={status !== 'submitted'}
          role="textbox"
          className="min-h-[140px] whitespace-pre-wrap rounded-lg border border-input bg-input px-3 py-2 text-sm text-default outline-none transition-all hover:border-strong focus:border-accent"
          onInput={handleEditorInput}
          suppressContentEditableWarning
        />
        {content.trim().length === 0 && (
          <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted">
            {card.placeholder ?? t('narre.card.draftPlaceholder')}
          </div>
        )}
      </div>

      <div className="mt-2">
        <TextArea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder={card.feedbackPlaceholder ?? t('narre.card.draftFeedbackPlaceholder')}
          disabled={status === 'submitted'}
          rows={3}
        />
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={feedbackDisabled}
          onClick={() => { void handleFeedback(); }}
        >
          {card.feedbackLabel ?? t('narre.card.draftFeedback')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={status === 'submitting' || status === 'submitted' || content.trim().length === 0}
          onClick={() => { void handleConfirm(); }}
        >
          {card.confirmLabel ?? t('narre.card.draftConfirm')}
        </Button>
      </div>
    </div>
  );
}
