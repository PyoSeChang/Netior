import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, Circle } from 'lucide-react';
import type { NarreToolCall } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';
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

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ');
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
            <div key={idx} className="flex items-center gap-1.5 py-0.5">
              <ToolStatusIcon status={call.status} />
              <span className={call.status === 'pending' ? 'text-muted' : 'text-secondary'}>
                {formatToolName(call.tool)}
              </span>
              {call.status === 'success' && call.result && (
                <span className="truncate text-muted ml-1">
                  {call.result.length > 60 ? call.result.slice(0, 60) + '...' : call.result}
                </span>
              )}
              {call.status === 'error' && call.error && (
                <span className="truncate text-[var(--status-error)] ml-1">
                  {call.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
