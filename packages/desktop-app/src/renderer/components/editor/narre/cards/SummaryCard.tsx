import React from 'react';
import { Check, X } from 'lucide-react';
import type { NarreSummaryCard } from '@netior/shared/types';

interface SummaryCardProps {
  card: NarreSummaryCard;
}

export function SummaryCard({ card }: SummaryCardProps): JSX.Element {
  return (
    <div className="mt-2 rounded-lg border border-subtle bg-surface-card p-3">
      {card.title && (
        <h4 className="text-xs font-semibold text-text-default mb-2">
          {card.title}
        </h4>
      )}

      <div className="flex flex-col gap-1.5">
        {card.items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            {item.status === 'success' ? (
              <Check
                size={14}
                className="shrink-0 mt-0.5 text-status-success"
              />
            ) : (
              <X
                size={14}
                className="shrink-0 mt-0.5 text-status-error"
              />
            )}
            <div className="min-w-0">
              <span className="text-xs text-text-default">{item.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
