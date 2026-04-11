import { z } from 'zod';

export const proposalCellTypeSchema = z.enum(['text', 'icon', 'color', 'enum', 'boolean', 'readonly']);

export const proposalToolSchema = z.object({
  title: z.string().describe('Title for the proposal'),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    cellType: proposalCellTypeSchema.describe('text | icon | color | enum | boolean | readonly'),
    options: z.array(z.string()).optional(),
  })),
  rows: z.array(z.object({
    id: z.string(),
    values: z.record(z.string(), z.unknown()),
  })),
});

export const askToolSchema = z.object({
  question: z.string().describe('The question to ask'),
  options: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
  })),
  multiSelect: z.boolean().optional().describe('Allow multiple selections'),
});

export const confirmToolSchema = z.object({
  message: z.string().describe('Description of the action requiring confirmation'),
  actions: z.array(z.object({
    key: z.string(),
    label: z.string(),
    variant: z.enum(['danger', 'default']).optional(),
  })),
});

export type ProposalToolArgs = z.infer<typeof proposalToolSchema>;
export type AskToolArgs = z.infer<typeof askToolSchema>;
export type ConfirmToolArgs = z.infer<typeof confirmToolSchema>;
