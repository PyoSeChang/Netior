import { tool } from '@openai/agents';
import type { NarreProviderRunContext } from '../../runtime/provider-adapter.js';
import type { NarreUiBridge } from '../shared/ui-bridge.js';
import { askToolSchema, confirmToolSchema, draftToolSchema } from '../shared/ui-schemas.js';

export function createOpenAIFamilyConversationTools(
  context: NarreProviderRunContext,
  uiBridge: NarreUiBridge,
) {
  return [
    tool({
      name: 'propose',
      description: 'Present an editable draft block to the user. Use this when suggesting schemas, relation types, concepts, or any plan that benefits from inline revision.',
      parameters: draftToolSchema,
      strict: true,
      execute: async (args, _runContext, details) => uiBridge.requestDraft(
        context.onCard,
        args,
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
