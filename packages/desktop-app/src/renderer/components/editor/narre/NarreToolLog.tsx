import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, Circle } from 'lucide-react';
import { getNarreToolMetadata } from '@netior/shared/constants';
import type { NarreToolCall } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { Spinner } from '../../ui/Spinner';

interface NarreToolLogProps {
  calls: NarreToolCall[];
  defaultExpanded?: boolean;
}

function ToolStatusIcon({ status }: { status: NarreToolCall['status'] }): JSX.Element {
  switch (status) {
    case 'pending':
      return <Circle size={12} className="text-muted shrink-0" />;
    case 'running':
      return <Spinner size="sm" className="shrink-0" />;
    case 'success':
      return <Check size={12} className="text-[var(--status-success)] shrink-0" />;
    case 'error':
      return <X size={12} className="text-[var(--status-error)] shrink-0" />;
  }
}

function formatToolLabel(call: NarreToolCall): string {
  return call.metadata?.displayName ?? getNarreToolMetadata(call.tool).displayName;
}

function getToolMetadata(call: NarreToolCall) {
  return call.metadata ?? getNarreToolMetadata(call.tool);
}

function formatCategoryLabel(category: ReturnType<typeof getToolMetadata>['category']): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function NarreToolLog({ calls, defaultExpanded = false }: NarreToolLogProps): JSX.Element {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const completed = calls.filter((c) => c.status === 'success' || c.status === 'error').length;
  const total = calls.length;

  return (
    <div className="mt-1.5 rounded-md border border-subtle bg-surface-base text-xs">
      <button
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-muted hover:text-secondary transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded
          ? <ChevronDown size={12} className="shrink-0" />
          : <ChevronRight size={12} className="shrink-0" />}
        <span>
          {t('narre.toolExecution')} ({completed}/{total})
        </span>
      </button>

      {expanded && (
        <div className="border-t border-subtle px-2 py-1 flex flex-col gap-0.5">
          {calls.map((call, idx) => (
            <div key={idx} className="rounded-md px-1 py-1">
              <div className="flex items-start gap-2">
                <ToolStatusIcon status={call.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={call.status === 'pending' ? 'text-muted' : 'text-secondary'}>
                      {formatToolLabel(call)}
                    </span>
                    <Badge>{formatCategoryLabel(getToolMetadata(call).category)}</Badge>
                    {getToolMetadata(call).isMutation && <Badge variant="warning">Write</Badge>}
                  </div>
                  {call.status === 'success' && call.result ? (
                    <div className="mt-0.5 truncate text-muted">
                      {call.result.length > 80 ? call.result.slice(0, 80) + '...' : call.result}
                    </div>
                  ) : null}
                  {call.status === 'error' && call.error ? (
                    <div className="mt-0.5 truncate text-[var(--status-error)]">
                      {call.error}
                    </div>
                  ) : null}
                  {call.status !== 'success' && call.status !== 'error' && getToolMetadata(call).description ? (
                    <div className="mt-0.5 text-muted">
                      {getToolMetadata(call).description}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
