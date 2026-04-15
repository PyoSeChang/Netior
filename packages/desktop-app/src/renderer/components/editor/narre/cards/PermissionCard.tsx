import React, { useCallback, useMemo, useState } from 'react';
import type { NarrePermissionCard } from '@netior/shared/types';
import { useI18n } from '../../../../hooks/useI18n';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';

interface PermissionCardProps {
  card: NarrePermissionCard;
  onAction: (actionKey: string) => Promise<void> | void;
  submittedResponse?: unknown;
  compact?: boolean;
}

function formatPermissionActionLabel(
  action: NarrePermissionCard['actions'][number],
  t: ReturnType<typeof useI18n>['t'],
): string {
  switch (action.key.toLowerCase()) {
    case 'accept_project':
    case 'allow_project':
    case 'always_allow_project':
      return t('narre.card.permissionAllowProject' as never);
    case 'approve':
    case 'allow':
    case 'confirm':
    case 'accept':
      return t('narre.card.permissionAllow' as never);
    case 'decline':
    case 'deny':
    case 'cancel':
      return t('narre.card.permissionDecline' as never);
    default:
      return action.label;
  }
}

function formatPermissionDecisionLabel(
  actionKey: string,
  t: ReturnType<typeof useI18n>['t'],
): string {
  switch (actionKey.toLowerCase()) {
    case 'accept_project':
    case 'allow_project':
    case 'always_allow_project':
      return t('narre.card.permissionAllowedProject' as never);
    case 'approve':
    case 'allow':
    case 'confirm':
    case 'accept':
      return t('narre.card.permissionAllowed' as never);
    case 'decline':
    case 'deny':
    case 'cancel':
      return t('narre.card.permissionDeclined' as never);
    default:
      return actionKey;
  }
}

function getPermissionDecisionVariant(actionKey: string | null): 'success' | 'error' | 'default' {
  if (!actionKey) {
    return 'default';
  }

  switch (actionKey.toLowerCase()) {
    case 'accept_project':
    case 'allow_project':
    case 'always_allow_project':
    case 'approve':
    case 'allow':
    case 'confirm':
    case 'accept':
      return 'success';
    case 'decline':
    case 'deny':
    case 'cancel':
      return 'error';
    default:
      return 'default';
  }
}

export function PermissionCard({
  card,
  onAction,
  submittedResponse,
  compact = false,
}: PermissionCardProps): JSX.Element {
  const { t } = useI18n();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [submittedActionKey, setSubmittedActionKey] = useState<string | null>(null);

  const resolvedActionKey = useMemo(() => {
    if (submittedActionKey) {
      return submittedActionKey;
    }

    if (typeof card.resolvedActionKey === 'string' && card.resolvedActionKey.length > 0) {
      return card.resolvedActionKey;
    }

    if (!submittedResponse || typeof submittedResponse !== 'object') {
      return null;
    }

    const candidate = submittedResponse as { action?: unknown };
    return typeof candidate.action === 'string' ? candidate.action : null;
  }, [card.resolvedActionKey, submittedActionKey, submittedResponse]);

  const isSubmitted = status === 'submitted' || resolvedActionKey !== null;

  const handleAction = useCallback(async (actionKey: string) => {
    if (status === 'submitting' || isSubmitted) {
      return;
    }

    setStatus('submitting');
    try {
      await onAction(actionKey);
      setSubmittedActionKey(actionKey);
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  }, [isSubmitted, onAction, status]);

  const submittedActionLabel = resolvedActionKey
    ? formatPermissionDecisionLabel(resolvedActionKey, t)
    : null;
  const submittedActionVariant = getPermissionDecisionVariant(resolvedActionKey);

  return (
    <div className={compact ? 'pt-0.5' : 'px-3 py-3'}>
      {isSubmitted ? (
        <div className="flex items-center gap-2">
          {submittedActionLabel && (
            <Badge variant={submittedActionVariant}>
              {submittedActionLabel}
            </Badge>
          )}
        </div>
      ) : (
        <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'justify-start' : 'justify-end'}`}>
          {status === 'error' && <Badge variant="error">{t('narre.card.submitFailed')}</Badge>}
          {card.actions.map((action) => (
            <Button
              key={action.key}
              variant={action.variant === 'danger' ? 'danger' : 'primary'}
              size="sm"
              disabled={status === 'submitting'}
              onClick={() => { void handleAction(action.key); }}
            >
              {formatPermissionActionLabel(action, t)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
