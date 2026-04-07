import React from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { useNetworkStore } from '../../stores/network-store';
import { useI18n } from '../../hooks/useI18n';

export function NetworkBreadcrumb(): JSX.Element | null {
  const { breadcrumbs, networkHistory, navigateToBreadcrumb, navigateBack } =
    useNetworkStore();

  const { t } = useI18n();

  if (breadcrumbs.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 bg-surface-panel border-b border-subtle px-2 py-1">
      <button
        className="flex items-center justify-center rounded p-0.5 text-text-secondary hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={networkHistory.length === 0}
        onClick={() => navigateBack()}
        aria-label={t('network.navigateBack')}
      >
        <ArrowLeft size={14} />
      </button>

      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        const label = crumb.conceptTitle ?? crumb.networkName;

        return (
          <React.Fragment key={crumb.networkId}>
            {idx > 0 && (
              <ChevronRight size={12} className="text-text-muted shrink-0" />
            )}
            {isLast ? (
              <span className="text-xs text-accent font-medium truncate">
                {label}
              </span>
            ) : (
              <button
                className="text-xs text-text-secondary hover:text-text-default hover:underline truncate"
                onClick={() => navigateToBreadcrumb(crumb.networkId)}
              >
                {label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
