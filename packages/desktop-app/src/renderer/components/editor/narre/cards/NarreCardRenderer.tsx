import React from 'react';
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
  switch (card.type) {
    case 'proposal': {
      const handleProposalConfirm = (rows: ProposalRow[]) => {
        onRespond(card.toolCallId, { action: 'confirm', rows });
      };
      const handleProposalRetry = () => {
        onRespond(card.toolCallId, { action: 'retry' });
      };
      return (
        <ProposalCard
          card={card}
          onConfirm={handleProposalConfirm}
          onRetry={handleProposalRetry}
        />
      );
    }
    case 'permission': {
      const handlePermissionAction = (actionKey: string) => {
        onRespond(card.toolCallId, { action: actionKey });
      };
      return (
        <PermissionCard card={card} onAction={handlePermissionAction} />
      );
    }
    case 'interview': {
      const handleInterviewSelect = (selected: string[]) => {
        onRespond(card.toolCallId, { selected });
      };
      return <InterviewCard card={card} onSelect={handleInterviewSelect} />;
    }
    case 'summary':
      return <SummaryCard card={card} />;
    default:
      return <></>;
  }
}
