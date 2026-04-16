import { buildOnboardingPrompt } from '../prompts/onboarding-v2.js';
import type { NarrePromptSkillDefinition } from './types.js';

export const onboardingPromptSkill: NarrePromptSkillDefinition = {
  key: 'onboarding',
  commandName: 'onboarding',
  additionalToolProfiles: ['onboarding-skill'],
  buildPrompt: ({ params, behavior }) => buildOnboardingPrompt(params, behavior),
};
