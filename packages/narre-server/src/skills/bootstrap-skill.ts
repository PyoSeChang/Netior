import {
  buildBootstrapPrompt,
  determineBootstrapToolProfiles,
} from '../prompts/bootstrap.js';
import type { NarreSkillDefinition } from './types.js';

export const bootstrapSkill: NarreSkillDefinition = {
  id: 'bootstrap',
  name: 'bootstrap',
  description: 'narre.command.bootstrap',
  source: 'builtin',
  trigger: { type: 'slash', name: 'bootstrap' },
  hint: 'narre.command.bootstrapHint',
  additionalToolProfiles: ['bootstrap-skill'],
  resolveToolProfiles: ({ historyTurns }) => determineBootstrapToolProfiles(historyTurns),
  buildPrompt: ({ params, behavior, historyTurns }) => buildBootstrapPrompt(params, behavior, historyTurns),
};
