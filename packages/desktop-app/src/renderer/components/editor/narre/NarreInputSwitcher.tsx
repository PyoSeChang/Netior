import React from 'react';
import type {
  NarreDraftCard,
  NarreInterviewCard,
  NarreMention,
  NarrePermissionCard,
} from '@netior/shared/types';
import type { NarrePendingCommandState } from '../../../lib/narre-ui-state';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { NarreMentionInput, type NarreComposerSubmit } from './NarreMentionInput';
import { DraftCard } from './cards/DraftCard';
import { InterviewCard } from './cards/InterviewCard';
import { PermissionCard } from './cards/PermissionCard';

export type NarreInteractivePrompt =
  | { kind: 'permission'; card: NarrePermissionCard }
  | { kind: 'draft'; card: NarreDraftCard }
  | { kind: 'interview'; card: NarreInterviewCard };

interface NarreInputSwitcherProps {
  projectId: string;
  disabled?: boolean;
  sendDisabled?: boolean;
  placeholder?: string;
  draftHtml?: string;
  pendingCommand?: NarrePendingCommandState | null;
  onDraftChange?: (draftHtml: string) => void;
  onPendingCommandChange?: (pendingCommand: NarrePendingCommandState | null) => void;
  onSend: (payload: NarreComposerSubmit) => Promise<boolean | void> | boolean | void;
  activePrompt: NarreInteractivePrompt | null;
  onPromptRespond: (toolCallId: string, response: unknown) => Promise<void> | void;
}

function NarrePromptShell({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="w-full rounded-lg border border-subtle bg-surface-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-semibold text-default">{title}</h3>
        <Badge>{badge}</Badge>
      </div>
      {children}
    </div>
  );
}

export function NarreInputSwitcher({
  projectId,
  disabled = false,
  sendDisabled = false,
  placeholder,
  draftHtml = '',
  pendingCommand = null,
  onDraftChange,
  onPendingCommandChange,
  onSend,
  activePrompt,
  onPromptRespond,
}: NarreInputSwitcherProps): JSX.Element {
  const { t } = useI18n();

  if (activePrompt?.kind === 'permission') {
    return (
      <NarrePromptShell title={t('narre.input.permissionTitle')} badge={t('narre.input.permissionBadge')}>
        <div className="text-sm text-secondary">
          {activePrompt.card.message}
        </div>
        <PermissionCard
          key={activePrompt.card.toolCallId}
          card={activePrompt.card}
          onAction={(actionKey) => onPromptRespond(activePrompt.card.toolCallId, { action: actionKey })}
        />
      </NarrePromptShell>
    );
  }

  if (activePrompt?.kind === 'draft') {
    return (
      <NarrePromptShell title={t('narre.input.draftTitle')} badge={t('narre.input.draftBadge')}>
        <DraftCard
          key={activePrompt.card.toolCallId}
          card={activePrompt.card}
          embedded
          onRespond={(response) => onPromptRespond(activePrompt.card.toolCallId, response)}
        />
      </NarrePromptShell>
    );
  }

  if (activePrompt?.kind === 'interview') {
    return (
      <NarrePromptShell title={t('narre.input.askTitle')} badge={t('narre.input.askBadge')}>
        <InterviewCard
          key={activePrompt.card.toolCallId}
          card={activePrompt.card}
          embedded
          onSelect={(response) => onPromptRespond(activePrompt.card.toolCallId, response)}
        />
      </NarrePromptShell>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <NarreMentionInput
        projectId={projectId}
        onSend={onSend}
        disabled={disabled}
        sendDisabled={sendDisabled}
        placeholder={placeholder}
        draftHtml={draftHtml}
        pendingCommand={pendingCommand}
        onDraftChange={onDraftChange}
        onPendingCommandChange={onPendingCommandChange}
      />
    </div>
  );
}
