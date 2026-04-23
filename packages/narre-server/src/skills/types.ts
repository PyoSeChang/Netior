import type {
  NarreBehaviorSettings,
  NarreTranscriptTurn,
  NetiorMcpToolProfile,
  SkillDefinition,
  SkillInvocation,
} from '@netior/shared/types';
import type { SystemPromptParams } from '../system-prompt.js';

export interface NarreSkillContext {
  params: SystemPromptParams;
  behavior: NarreBehaviorSettings;
  projectId: string;
  historyTurns?: NarreTranscriptTurn[];
}

export interface NarreSkillDefinition extends SkillDefinition {
  source: 'builtin' | 'file';
  additionalToolProfiles?: readonly NetiorMcpToolProfile[];
  resolveToolProfiles?: (context: NarreSkillContext) => readonly NetiorMcpToolProfile[];
  buildPrompt: (context: NarreSkillContext) => string;
  normalizeArgs?: (message: string, invocation: SkillInvocation) => Record<string, string>;
}
