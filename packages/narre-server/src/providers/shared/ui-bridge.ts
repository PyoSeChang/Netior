import { randomUUID } from 'crypto';
import type { NarreCard } from '@netior/shared/types';
import { PendingUiResponses } from '../../tools/pending-ui-responses.js';

interface ProposalCell {
  key: string;
  label: string;
  cellType: 'text' | 'icon' | 'color' | 'enum' | 'boolean' | 'readonly';
  options?: string[];
}

interface ProposalRow {
  id: string;
  values: Record<string, unknown>;
}

interface InterviewOption {
  label: string;
  description?: string;
}

interface PermissionAction {
  key: string;
  label: string;
  variant?: 'danger' | 'default';
}

type EmitCard = (card: NarreCard) => void;

export class NarreUiBridge {
  private readonly pendingUiResponses = new PendingUiResponses();

  resolveResponse(toolCallId: string, response: unknown): boolean {
    return this.pendingUiResponses.resolve(toolCallId, response);
  }

  async requestProposal(
    emitCard: EmitCard,
    payload: {
      title: string;
      columns: ProposalCell[];
      rows: ProposalRow[];
    },
    toolCallId?: string,
  ): Promise<string> {
    return this.enqueueCard(
      emitCard,
      toolCallId,
      (resolvedToolCallId) => ({
        type: 'proposal',
        toolCallId: resolvedToolCallId,
        title: payload.title,
        columns: payload.columns,
        rows: payload.rows,
      }),
    );
  }

  async requestInterview(
    emitCard: EmitCard,
    payload: {
      question: string;
      options: InterviewOption[];
      multiSelect?: boolean;
    },
    toolCallId?: string,
  ): Promise<string> {
    return this.enqueueCard(
      emitCard,
      toolCallId,
      (resolvedToolCallId) => ({
        type: 'interview',
        toolCallId: resolvedToolCallId,
        question: payload.question,
        options: payload.options,
        multiSelect: payload.multiSelect ?? undefined,
      }),
    );
  }

  async requestPermission(
    emitCard: EmitCard,
    payload: {
      message: string;
      actions: PermissionAction[];
    },
    toolCallId?: string,
  ): Promise<string> {
    return this.enqueueCard(
      emitCard,
      toolCallId,
      (resolvedToolCallId) => ({
        type: 'permission',
        toolCallId: resolvedToolCallId,
        message: payload.message,
        actions: payload.actions,
      }),
    );
  }

  private async enqueueCard(
    emitCard: EmitCard,
    toolCallId: string | undefined,
    buildCard: (toolCallId: string) => NarreCard,
  ): Promise<string> {
    const resolvedToolCallId = toolCallId && toolCallId.length > 0 ? toolCallId : randomUUID();
    emitCard(buildCard(resolvedToolCallId));
    return this.pendingUiResponses.waitForResponse(resolvedToolCallId);
  }
}
