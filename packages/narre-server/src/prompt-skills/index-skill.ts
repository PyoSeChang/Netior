import { buildIndexTocPrompt } from '../prompts/index-toc.js';
import type { ParsedCommand } from '../command-router.js';
import type { NarrePromptSkillDefinition } from './types.js';

function extractIndexCommandArgs(message: string, parsedCommand: ParsedCommand): Record<string, string> {
  const args = { ...parsedCommand.args };
  const match = message.match(/\[toc_params\]([\s\S]*?)\[\/toc_params\]/);
  if (!match) {
    return args;
  }

  try {
    const parsed = JSON.parse(match[1]) as Partial<{
      startPage: number;
      endPage: number;
      overviewPages: number[];
    }>;

    if (typeof parsed.startPage === 'number') {
      args.startPage = String(parsed.startPage);
    }
    if (typeof parsed.endPage === 'number') {
      args.endPage = String(parsed.endPage);
    }
    if (Array.isArray(parsed.overviewPages) && parsed.overviewPages.length > 0) {
      args.overviewPages = parsed.overviewPages.join(', ');
    }
    return args;
  } catch {
    return args;
  }
}

export const indexPromptSkill: NarrePromptSkillDefinition = {
  key: 'index',
  commandName: 'index',
  additionalToolProfiles: ['index-skill'],
  buildPrompt: ({ params, behavior }) => buildIndexTocPrompt(params, behavior),
  normalizeArgs: extractIndexCommandArgs,
};
