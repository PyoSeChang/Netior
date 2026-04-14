import React from 'react';
import type { NarreCard, NarreDraftResponse, NarreInterviewResponse, ProposalRow } from '@netior/shared/types';
import { DraftCard } from './DraftCard';
import { ProposalCard } from './ProposalCard';
import { PermissionCard } from './PermissionCard';
import { InterviewCard } from './InterviewCard';
import { SummaryCard } from './SummaryCard';

interface NarreCardRendererProps {
  card: NarreCard;
  onRespond: (toolCallId: string, response: unknown) => Promise<void> | void;
}

export function NarreCardRenderer({
  card,
  onRespond,
}: NarreCardRendererProps): JSX.Element {
  switch (card.type) {
    case 'draft': {
      const handleDraftResponse = (response: NarreDraftResponse) => {
        return onRespond(card.toolCallId, response);
      };
      return (
        <DraftCard
          card={card}
          onRespond={handleDraftResponse}
        />
      );
    }
    case 'proposal': {
      const handleProposalConfirm = (rows: ProposalRow[]) => {
        return onRespond(card.toolCallId, { action: 'confirm', rows });
      };
      const handleProposalRetry = () => {
        return onRespond(card.toolCallId, { action: 'retry' });
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
        return onRespond(card.toolCallId, { action: actionKey });
      };
      return (
        <PermissionCard card={card} onAction={handlePermissionAction} />
      );
    }
    case 'interview': {
      const handleInterviewSelect = (response: NarreInterviewResponse) => {
        return onRespond(card.toolCallId, response);
      };
      return <InterviewCard card={card} onSelect={handleInterviewSelect} />;
    }
    case 'summary':
      return <SummaryCard card={card} />;
    default:
      return <></>;
  }
}
