import { SLASH_TRIGGER_SKILLS } from '@netior/shared/constants';
import type { SkillDefinition, SkillInvocation } from '@netior/shared/types';

export interface ParsedSkillInvocation {
  skill: SkillDefinition;
  invocation: SkillInvocation;
}

export function parseSkillInvocation(
  message: string,
  skills: readonly SkillDefinition[] = SLASH_TRIGGER_SKILLS,
): ParsedSkillInvocation | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const triggerName = parts[0]?.toLowerCase();
  if (!triggerName) {
    return null;
  }

  const skill = findSkillBySlashTrigger(triggerName, skills);
  if (!skill || skill.trigger?.type !== 'slash') {
    return null;
  }

  const args: Record<string, string> = {};
  const argValues = parts.slice(1);
  const skillArgs = skill.args ?? [];
  for (let index = 0; index < skillArgs.length && index < argValues.length; index += 1) {
    args[skillArgs[index].name] = argValues[index];
  }

  return {
    skill,
    invocation: {
      skillId: skill.id,
      trigger: skill.trigger,
      args,
    },
  };
}

function findSkillBySlashTrigger(
  triggerName: string,
  skills: readonly SkillDefinition[],
): SkillDefinition | null {
  return skills.find((skill) =>
    skill.trigger?.type === 'slash'
    && skill.trigger.name.toLowerCase() === triggerName,
  ) ?? null;
}
