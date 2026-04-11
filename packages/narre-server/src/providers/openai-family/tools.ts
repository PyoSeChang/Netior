import { tool } from '@openai/agents';
import type { NarreProviderRunContext } from '../../runtime/provider-adapter.js';
import type { NarreUiBridge } from '../shared/ui-bridge.js';
import { askToolSchema, confirmToolSchema, proposalToolSchema } from '../shared/ui-schemas.js';

export function createOpenAIFamilyConversationTools(
  context: NarreProviderRunContext,
  uiBridge: NarreUiBridge,
) {
  return [
    tool({
      name: 'propose',
      description: 'Present a proposal table to the user for review and inline editing. Use this when suggesting archetypes, relation types, or concepts.',
      parameters: proposalToolSchema,
      strict: true,
      execute: async (args, _runContext, details) => uiBridge.requestProposal(
        context.onCard,
        {
          title: args.title,
          columns: args.columns,
          rows: args.rows,
        },
        details?.toolCall?.callId,
      ),
    }),
    tool({
      name: 'ask',
      description: 'Ask the user a structured question with selectable options. Use for gathering preferences or domain information.',
      parameters: askToolSchema,
      strict: true,
      execute: async (args, _runContext, details) => uiBridge.requestInterview(
        context.onCard,
        {
          question: args.question,
          options: args.options,
          multiSelect: args.multiSelect ?? undefined,
        },
        details?.toolCall?.callId,
      ),
    }),
    tool({
      name: 'confirm',
      description: 'Request user confirmation before a destructive or significant action.',
      parameters: confirmToolSchema,
      strict: true,
      execute: async (args, _runContext, details) => uiBridge.requestPermission(
        context.onCard,
        {
          message: args.message,
          actions: args.actions,
        },
        details?.toolCall?.callId,
      ),
    }),
  ];
}
