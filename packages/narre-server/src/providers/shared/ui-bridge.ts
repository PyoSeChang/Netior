import { randomUUID } from 'crypto';
import type { NarreCard } from '@netior/shared/types';
import { PendingUiResponses } from '../../tools/pending-ui-responses.js';

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

  async requestDraft(
    emitCard: EmitCard,
    payload: {
      title?: string;
      content: string;
      format?: 'markdown';
      placeholder?: string;
      confirmLabel?: string;
      feedbackLabel?: string;
      feedbackPlaceholder?: string;
    },
    toolCallId?: string,
  ): Promise<string> {
    return this.enqueueCard(
      emitCard,
      toolCallId,
      (resolvedToolCallId) => ({
        type: 'draft',
        toolCallId: resolvedToolCallId,
        ...(payload.title ? { title: payload.title } : {}),
        content: payload.content,
        format: payload.format ?? 'markdown',
        ...(payload.placeholder ? { placeholder: payload.placeholder } : {}),
        ...(payload.confirmLabel ? { confirmLabel: payload.confirmLabel } : {}),
        ...(payload.feedbackLabel ? { feedbackLabel: payload.feedbackLabel } : {}),
        ...(payload.feedbackPlaceholder ? { feedbackPlaceholder: payload.feedbackPlaceholder } : {}),
      }),
    );
  }

  async requestInterview(
    emitCard: EmitCard,
    payload: {
      question: string;
      options: InterviewOption[];
      multiSelect?: boolean;
      allowText?: boolean;
      textPlaceholder?: string;
      submitLabel?: string;
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
        multiSelect: payload.multiSelect ?? true,
        allowText: payload.allowText ?? true,
        ...(payload.textPlaceholder ? { textPlaceholder: payload.textPlaceholder } : {}),
        ...(payload.submitLabel ? { submitLabel: payload.submitLabel } : {}),
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
