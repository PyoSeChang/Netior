import React, { useCallback } from 'react';
import type { NarreCard, ProposalRow } from '@netior/shared/types';
import { ProposalCard } from './ProposalCard';
import { PermissionCard } from './PermissionCard';
import { InterviewCard } from './InterviewCard';
import { SummaryCard } from './SummaryCard';

interface NarreCardRendererProps {
  card: NarreCard;
  onRespond: (toolCallId: string, response: unknown) => void;
}

export function NarreCardRenderer({
  card,
  onRespond,
}: NarreCardRendererProps): JSX.Element {
  const handleProposalConfirm = useCallback(
    (rows: ProposalRow[]) => {
      onRespond(card.toolCallId, { action: 'confirm', rows });
    },
    [card.toolCallId, onRespond],
  );

  const handleProposalRetry = useCallback(() => {
    onRespond(card.toolCallId, { action: 'retry' });
  }, [card.toolCallId, onRespond]);

  const handlePermissionAction = useCallback(
    (actionKey: string) => {
      onRespond(card.toolCallId, { action: actionKey });
    },
    [card.toolCallId, onRespond],
  );

  const handleInterviewSelect = useCallback(
    (selected: string[]) => {
      onRespond(card.toolCallId, { selected });
    },
    [card.toolCallId, onRespond],
  );

  switch (card.type) {
    case 'proposal':
      return (
        <ProposalCard
          card={card}
          onConfirm={handleProposalConfirm}
          onRetry={handleProposalRetry}
        />
      );
    case 'permission':
      return (
        <PermissionCard card={card} onAction={handlePermissionAction} />
      );
    case 'interview':
      return <InterviewCard card={card} onSelect={handleInterviewSelect} />;
    case 'summary':
      return <SummaryCard card={card} />;
    default:
      return <></>;
  }
}
