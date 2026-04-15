import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, Circle } from 'lucide-react';
import { getNarreToolMetadata } from '@netior/shared/constants';
import type { NarrePermissionCard, NarreToolCall } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { Spinner } from '../../ui/Spinner';
import { PermissionCard } from './cards/PermissionCard';
import {
  getLocalizedToolCategoryLabel,
  getLocalizedToolLabel,
  getLocalizedToolWriteLabel,
  getToolResultSummary,
} from './narre-tool-presenter-localized';

export type NarreToolLogItem =
  | {
    kind: 'tool';
    id: string;
    call: NarreToolCall;
    permission?: {
      card: NarrePermissionCard;
      summary: string;
      submittedResponse?: unknown;
    };
  }
  | { kind: 'permission'; id: string; card: NarrePermissionCard; summary: string };

interface NarreToolLogProps {
  calls?: NarreToolCall[];
  items?: NarreToolLogItem[];
  defaultExpanded?: boolean;
  bordered?: boolean;
  onPermissionRespond?: (toolCallId: string, response: unknown) => Promise<void> | void;
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

function formatToolLabel(call: NarreToolCall, locale: string): string {
  return getLocalizedToolLabel(
    call.tool,
    locale,
    call.metadata?.displayName ?? getNarreToolMetadata(call.tool).displayName,
  );
}

function getToolMetadata(call: NarreToolCall) {
  return call.metadata ?? getNarreToolMetadata(call.tool);
}

function getSubmittedAction(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const candidate = response as { action?: unknown };
  return typeof candidate.action === 'string' ? candidate.action : null;
}

function getAllowActionKey(card: NarrePermissionCard): string | null {
  const allowAction = card.actions.find((action) => {
    const key = action.key.toLowerCase();
    return key === 'accept_project'
      || key === 'allow_project'
      || key === 'always_allow_project'
      || key === 'approve'
      || key === 'allow'
      || key === 'confirm'
      || key === 'accept';
  });

  return allowAction?.key ?? null;
}

function getEffectivePermissionResponse(
  permission: NonNullable<Extract<NarreToolLogItem, { kind: 'tool' }>['permission']>,
  call?: NarreToolCall,
): { action: string } | null {
  const submittedAction = getSubmittedAction(permission.submittedResponse);
  if (submittedAction) {
    return { action: submittedAction };
  }

  if (typeof permission.card.resolvedActionKey === 'string' && permission.card.resolvedActionKey.length > 0) {
    return { action: permission.card.resolvedActionKey };
  }

  if (!call || call.status === 'pending') {
    return null;
  }

  const allowActionKey = getAllowActionKey(permission.card);
  return allowActionKey ? { action: allowActionKey } : null;
}

function getPermissionDecisionVariant(actionKey: string): 'success' | 'error' | 'default' {
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

function getPermissionDecisionLabel(actionKey: string, t: ReturnType<typeof useI18n>['t']): string {
  switch (actionKey.toLowerCase()) {
    case 'accept_project':
    case 'allow_project':
    case 'always_allow_project':
      return t('narre.card.permissionAllowedProject');
    case 'approve':
    case 'allow':
    case 'confirm':
    case 'accept':
      return t('narre.card.permissionAllowed');
    case 'decline':
    case 'deny':
    case 'cancel':
      return t('narre.card.permissionDeclined');
    default:
      return actionKey;
  }
}

export function NarreToolLog({
  calls = [],
  items,
  defaultExpanded = false,
  bordered = true,
  onPermissionRespond,
}: NarreToolLogProps): JSX.Element {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const resolvedItems = items ?? calls.map((call, index) => ({ kind: 'tool' as const, id: `tool-${index}`, call }));
  const toolItems = resolvedItems.filter((item): item is Extract<NarreToolLogItem, { kind: 'tool' }> => item.kind === 'tool');

  const completed = toolItems.filter((item) => item.call.status === 'success' || item.call.status === 'error').length;
  const total = toolItems.length;

  return (
    <div className={[
      bordered ? 'mt-1.5 rounded-md border border-subtle bg-surface-base' : '',
      'text-xs',
    ].join(' ')}>
      <button
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-muted hover:text-secondary transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded
          ? <ChevronDown size={12} className="shrink-0" />
          : <ChevronRight size={12} className="shrink-0" />}
        <span>
          {total > 0 ? `${t('narre.toolExecution')} (${completed}/${total})` : t('narre.toolExecution')}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-subtle px-2 py-1 flex flex-col">
          {resolvedItems.map((item, index) => {
            if (item.kind === 'permission') {
              const submittedResponse = getEffectivePermissionResponse(
                { card: item.card, summary: item.summary },
              );

              return (
                <div
                  key={item.id}
                  className={[
                    'px-1 py-1.5',
                    index > 0 ? 'border-t border-subtle' : '',
                  ].join(' ')}
                >
                  {!submittedResponse && (
                    <div className="text-muted">
                      {item.summary}
                    </div>
                  )}
                  {onPermissionRespond ? (
                    <PermissionCard
                      card={item.card}
                      submittedResponse={submittedResponse ?? undefined}
                      compact
                      onAction={(actionKey) => onPermissionRespond(item.card.toolCallId, { action: actionKey })}
                    />
                  ) : null}
                </div>
              );
            }

            const metadata = getToolMetadata(item.call);
            const summary = getToolResultSummary(item.call, locale);
            const permissionResponse = item.permission
              ? getEffectivePermissionResponse(item.permission, item.call)
              : null;
            const showPermissionPrompt = Boolean(item.permission) && permissionResponse === null;
            const permissionDecisionLabel = permissionResponse
              ? getPermissionDecisionLabel(permissionResponse.action, t)
              : null;
            const permissionDecisionVariant = permissionResponse
              ? getPermissionDecisionVariant(permissionResponse.action)
              : 'default';

            return (
              <div
                key={item.id}
                className={[
                  'px-1 py-1.5',
                  index > 0 ? 'border-t border-subtle' : '',
                ].join(' ')}
              >
                <div className="flex items-start gap-2">
                  <ToolStatusIcon status={item.call.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={item.call.status === 'pending' ? 'text-muted' : 'text-secondary'}>
                        {formatToolLabel(item.call, locale)}
                      </span>
                      <Badge>{getLocalizedToolCategoryLabel(metadata.category, locale)}</Badge>
                      {permissionDecisionLabel && (
                        <span
                          className={
                            permissionDecisionVariant === 'success'
                              ? 'text-[var(--status-success)]'
                              : permissionDecisionVariant === 'error'
                                ? 'text-[var(--status-error)]'
                                : 'text-muted'
                          }
                        >
                          {permissionDecisionLabel}
                        </span>
                      )}
                      {showPermissionPrompt && (
                        <span className="text-muted">
                          {t('narre.card.permissionRequired')}
                        </span>
                      )}
                      {metadata.isMutation && <Badge variant="warning">{getLocalizedToolWriteLabel(locale)}</Badge>}
                    </div>
                    {item.permission && showPermissionPrompt && onPermissionRespond ? (
                      <div className="mt-1">
                        <PermissionCard
                          card={item.permission.card}
                          submittedResponse={permissionResponse ?? undefined}
                          compact
                          onAction={(actionKey) => onPermissionRespond(item.permission.card.toolCallId, { action: actionKey })}
                        />
                      </div>
                    ) : null}
                    {item.call.status === 'success' && summary ? (
                      <div className={`${item.permission ? 'mt-1' : 'mt-0.5'} truncate text-muted`}>
                        {summary}
                      </div>
                    ) : null}
                    {item.call.status === 'error' && summary ? (
                      <div className={`${item.permission ? 'mt-1' : 'mt-0.5'} truncate text-[var(--status-error)]`}>
                        {summary}
                      </div>
                    ) : null}
                    {item.call.status !== 'success' && item.call.status !== 'error' && metadata.description ? (
                      <div className="mt-0.5 text-muted">
                        {metadata.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
