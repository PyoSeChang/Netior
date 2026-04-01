import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { NarrePermissionCard } from '@netior/shared/types';
import { Button } from '../../../ui/Button';

interface PermissionCardProps {
  card: NarrePermissionCard;
  onAction: (actionKey: string) => void;
}

export function PermissionCard({
  card,
  onAction,
}: PermissionCardProps): JSX.Element {
  return (
    <div className="mt-2 rounded-lg border border-subtle bg-surface-card p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={16}
          className="shrink-0 mt-0.5 text-status-warning"
        />
        <p className="text-xs text-text-default">{card.message}</p>
      </div>

      <div className="flex justify-end gap-2 mt-3">
        {card.actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant === 'danger' ? 'danger' : action.variant === 'secondary' ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => onAction(action.key)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
