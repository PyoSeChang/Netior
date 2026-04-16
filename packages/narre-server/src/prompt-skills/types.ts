import type {
  NarreBehaviorSettings,
  NarrePromptSkillKey,
  NetiorMcpToolProfile,
} from '@netior/shared/types';
import type { ParsedCommand } from '../command-router.js';
import type { SystemPromptParams } from '../system-prompt.js';

export interface NarrePromptSkillContext {
  params: SystemPromptParams;
  behavior: NarreBehaviorSettings;
  projectId: string;
}

export interface NarrePromptSkillDefinition {
  key: NarrePromptSkillKey;
  commandName: string;
  additionalToolProfiles?: readonly NetiorMcpToolProfile[];
  buildPrompt: (context: NarrePromptSkillContext) => string;
  normalizeArgs?: (message: string, parsedCommand: ParsedCommand) => Record<string, string>;
}
