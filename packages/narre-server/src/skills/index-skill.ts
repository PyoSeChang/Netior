import { buildIndexTocPrompt } from '../prompts/index-toc.js';
import type { SkillInvocation } from '@netior/shared/types';
import type { NarreSkillDefinition } from './types.js';

function extractIndexSkillArgs(message: string, invocation: SkillInvocation): Record<string, string> {
  const args = { ...invocation.args };
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

export const indexSkill: NarreSkillDefinition = {
  id: 'index',
  name: 'index',
  description: 'narre.command.index',
  source: 'builtin',
  trigger: { type: 'slash', name: 'index' },
  hint: 'narre.command.indexHint',
  additionalToolProfiles: ['index-skill'],
  requiredMentionTypes: ['file'],
  args: [
    {
      name: 'startPage',
      description: 'pdfToc.startPage',
      required: true,
      type: 'number',
    },
    {
      name: 'endPage',
      description: 'pdfToc.endPage',
      required: true,
      type: 'number',
    },
    {
      name: 'overviewPages',
      description: 'pdfToc.overviewPages',
      required: false,
      type: 'number_list',
    },
  ],
  buildPrompt: ({ params, behavior }) => buildIndexTocPrompt(params, behavior),
  normalizeArgs: extractIndexSkillArgs,
};
