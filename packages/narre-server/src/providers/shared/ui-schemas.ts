import { z } from 'zod';

export const proposalCellTypeSchema = z.enum(['text', 'icon', 'color', 'enum', 'boolean', 'readonly']);

export const draftToolSchema = z.object({
  title: z.string().optional().describe('Optional title for the draft block'),
  content: z.string().describe('Editable markdown or plain-text draft shown to the user'),
  format: z.enum(['markdown']).optional().describe('Draft format. Defaults to markdown'),
  placeholder: z.string().optional().describe('Optional placeholder when the draft body starts empty'),
  confirmLabel: z.string().optional().describe('Optional label for the accept button'),
  feedbackLabel: z.string().optional().describe('Optional label for the feedback button'),
  feedbackPlaceholder: z.string().optional().describe('Optional placeholder for the feedback field'),
});

export const askToolSchema = z.object({
  question: z.string().describe('The question to ask'),
  options: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
  })),
  multiSelect: z.boolean().optional().describe('Allow multiple selections'),
  allowText: z.boolean().optional().describe('Allow free-form text input alongside selections'),
  textPlaceholder: z.string().optional().describe('Optional placeholder for the free-form input'),
  submitLabel: z.string().optional().describe('Optional submit button label'),
});

export const confirmToolSchema = z.object({
  message: z.string().describe('Description of the action requiring confirmation'),
  actions: z.array(z.object({
    key: z.string(),
    label: z.string(),
    variant: z.enum(['danger', 'default']).optional(),
  })),
});

export type DraftToolArgs = z.infer<typeof draftToolSchema>;
export type AskToolArgs = z.infer<typeof askToolSchema>;
export type ConfirmToolArgs = z.infer<typeof confirmToolSchema>;
