import React, { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getNarreToolMetadata } from '@netior/shared/constants';
import type { NarrePermissionCard } from '@netior/shared/types';
import { useI18n } from '../../../../hooks/useI18n';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';

interface PermissionCardProps {
  card: NarrePermissionCard;
  onAction: (actionKey: string) => Promise<void> | void;
}

const TOOL_RE = /tool "([^"]+)"/i;

function formatPermissionMessage(
  card: NarrePermissionCard,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const match = card.message.match(TOOL_RE);
  if (!match) {
    return card.message;
  }

  const toolLabel = getNarreToolMetadata(match[1]).displayName;
  return t('narre.card.permissionRequest' as never, { tool: toolLabel } as never);
}

function formatPermissionActionLabel(
  action: NarrePermissionCard['actions'][number],
  t: ReturnType<typeof useI18n>['t'],
): string {
  switch (action.key.toLowerCase()) {
    case 'approve':
    case 'allow':
    case 'confirm':
      return t('narre.card.permissionConfirm');
    case 'decline':
    case 'deny':
    case 'cancel':
      return t('narre.card.permissionCancel');
    default:
      return action.label;
  }
}

export function PermissionCard({
  card,
  onAction,
}: PermissionCardProps): JSX.Element {
  const { t } = useI18n();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  const handleAction = useCallback(async (actionKey: string) => {
    if (status === 'submitting' || status === 'submitted') {
      return;
    }

    setStatus('submitting');
    try {
      await onAction(actionKey);
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  }, [onAction, status]);

  return (
    <div className="mt-2 rounded-lg border border-subtle bg-surface-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertTriangle
            size={16}
            className="shrink-0 mt-0.5 text-status-warning"
          />
          <p className="text-xs text-default">{formatPermissionMessage(card, t)}</p>
        </div>
        {status === 'submitting' && <Badge variant="warning">{t('narre.card.submitting')}</Badge>}
        {status === 'submitted' && <Badge variant="success">{t('narre.card.submitted')}</Badge>}
        {status === 'error' && <Badge variant="error">{t('narre.card.submitFailed')}</Badge>}
      </div>

      <div className="flex justify-end gap-2 mt-3">
        {card.actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            disabled={status === 'submitting' || status === 'submitted'}
            onClick={() => { void handleAction(action.key); }}
          >
            {formatPermissionActionLabel(action, t)}
          </Button>
        ))}
      </div>
    </div>
  );
}
