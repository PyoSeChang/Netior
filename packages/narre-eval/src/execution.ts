import type { BuiltInSkillId } from '@netior/shared/types';
import type {
  EvalExecutionMode,
  EvalProviderId,
  EvalScenarioKind,
  EvalTesterId,
  RunSpec,
  ScenarioExecutionConfig,
  ScenarioExecutionManifest,
} from './types.js';

export const DEFAULT_AGENT_ID = 'narre-basic';
export const DEFAULT_PROVIDER: EvalProviderId = 'codex';
export const DEFAULT_FIXED_TESTER: EvalTesterId = 'basic-turn-runner';
export const DEFAULT_INTERPRETIVE_TESTER: EvalTesterId = 'codex-tester';
export const DEFAULT_EXECUTION_MODE: EvalExecutionMode = 'single_agent';

export function normalizeEvalProviderId(value: unknown): EvalProviderId {
  switch (value) {
    case 'claude':
    case 'openai':
    case 'codex':
      return value;
    default:
      return DEFAULT_PROVIDER;
  }
}

export function normalizeScenarioKind(
  value: unknown,
  targetSkill?: BuiltInSkillId,
): EvalScenarioKind {
  if (value === 'fixed' || value === 'interpretive') {
    return value;
  }

  return targetSkill === 'bootstrap' ? 'interpretive' : 'fixed';
}

export function normalizeEvalTesterId(value: unknown, scenarioKind: EvalScenarioKind): EvalTesterId {
  switch (value) {
    case 'codex-tester':
    case 'conversation-tester':
    case 'card-responder':
    case 'approval-sensitive':
    case 'basic-turn-runner':
      return value;
    default:
      return scenarioKind === 'interpretive'
        ? DEFAULT_INTERPRETIVE_TESTER
        : DEFAULT_FIXED_TESTER;
  }
}

export function normalizeExecutionMode(value: unknown): EvalExecutionMode {
  return value === 'multi_agent' ? 'multi_agent' : 'single_agent';
}

export function normalizeTargetSkillId(value: unknown): BuiltInSkillId | undefined {
  switch (value) {
    case 'bootstrap':
    case 'index':
      return value;
    default:
      return undefined;
  }
}

export function normalizeScenarioExecution(
  execution: ScenarioExecutionManifest | undefined,
): ScenarioExecutionConfig {
  const targetSkill = normalizeTargetSkillId(execution?.target_skill);
  const scenarioKind = normalizeScenarioKind(execution?.scenario_kind, targetSkill);

  return {
    supported_agents: execution?.supported_agents ?? [],
    required_capabilities: execution?.required_capabilities ?? [],
    target_skill: targetSkill,
    scenario_kind: scenarioKind,
    agent_id: typeof execution?.agent_id === 'string' && execution.agent_id.trim().length > 0
      ? execution.agent_id.trim()
      : DEFAULT_AGENT_ID,
    provider: normalizeEvalProviderId(execution?.provider),
    tester: normalizeEvalTesterId(execution?.tester, scenarioKind),
    execution_mode: normalizeExecutionMode(execution?.execution_mode),
    analysis_targets: Array.isArray(execution?.analysis_targets)
      ? execution.analysis_targets.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
    provider_settings: execution?.provider_settings && typeof execution.provider_settings === 'object'
      ? execution.provider_settings
      : undefined,
    tester_settings: execution?.tester_settings && typeof execution.tester_settings === 'object'
      ? execution.tester_settings
      : undefined,
  };
}

export function applyRunSpecExecutionOverrides(
  execution: ScenarioExecutionConfig,
  runSpec: RunSpec | null,
): ScenarioExecutionConfig {
  if (!runSpec) {
    return execution;
  }

  return {
    ...execution,
    ...(runSpec.target_skill ? { target_skill: normalizeTargetSkillId(runSpec.target_skill) } : {}),
    ...(runSpec.target_skill || runSpec.scenario_kind
      ? {
          scenario_kind: normalizeScenarioKind(
            runSpec.scenario_kind ?? execution.scenario_kind,
            normalizeTargetSkillId(runSpec.target_skill ?? execution.target_skill),
          ),
        }
      : {}),
    ...(typeof runSpec.agent_id === 'string' && runSpec.agent_id.trim().length > 0
      ? { agent_id: runSpec.agent_id.trim() }
      : {}),
    ...(runSpec.provider ? { provider: normalizeEvalProviderId(runSpec.provider) } : {}),
    ...(runSpec.tester
      ? {
          tester: normalizeEvalTesterId(
            runSpec.tester,
            normalizeScenarioKind(
              runSpec.scenario_kind ?? execution.scenario_kind,
              normalizeTargetSkillId(runSpec.target_skill ?? execution.target_skill),
            ),
          ),
        }
      : {}),
    ...(runSpec.execution_mode ? { execution_mode: normalizeExecutionMode(runSpec.execution_mode) } : {}),
    ...(Array.isArray(runSpec.analysis_targets)
      ? {
          analysis_targets: runSpec.analysis_targets.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0,
          ),
        }
      : {}),
    ...(runSpec.provider_settings && typeof runSpec.provider_settings === 'object'
      ? { provider_settings: runSpec.provider_settings }
      : {}),
    ...(runSpec.tester_settings && typeof runSpec.tester_settings === 'object'
      ? { tester_settings: runSpec.tester_settings }
      : {}),
  };
}
