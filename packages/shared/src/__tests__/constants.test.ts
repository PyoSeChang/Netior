import { describe, it, expect } from 'vitest';
import {
  AGENT_SKILL_STORAGE,
  BUILT_IN_SKILLS,
  DEFAULTS,
  findSkillBySlashTrigger,
  getNarreToolMetadata,
  getNetiorMcpToolSpec,
  IPC_CHANNELS,
  listNetiorMcpToolSpecs,
  SLASH_TRIGGER_SKILLS,
} from '../constants';

describe('IPC_CHANNELS', () => {
  it('should have project channels', () => {
    expect(IPC_CHANNELS.PROJECT_CREATE).toBe('project:create');
    expect(IPC_CHANNELS.PROJECT_LIST).toBe('project:list');
    expect(IPC_CHANNELS.PROJECT_DELETE).toBe('project:delete');
  });

  it('should have concept channels', () => {
    expect(IPC_CHANNELS.CONCEPT_CREATE).toBe('concept:create');
    expect(IPC_CHANNELS.CONCEPT_GET_BY_PROJECT).toBe('concept:getByProject');
  });

  it('should have network channels', () => {
    expect(IPC_CHANNELS.NETWORK_CREATE).toBe('network:create');
    expect(IPC_CHANNELS.NETWORK_GET_FULL).toBe('network:getFull');
  });

  it('should have fs channels', () => {
    expect(IPC_CHANNELS.FS_READ_DIR).toBe('fs:readDir');
    expect(IPC_CHANNELS.FS_WRITE_FILE).toBe('fs:writeFile');
  });

  it('should have all channels as strings', () => {
    for (const value of Object.values(IPC_CHANNELS)) {
      expect(typeof value).toBe('string');
      expect(value).toMatch(/^[a-zA-Z]+:[a-zA-Z]+$/);
    }
  });
});

describe('DEFAULTS', () => {
  it('should have window defaults', () => {
    expect(DEFAULTS.WINDOW_WIDTH).toBe(1200);
    expect(DEFAULTS.WINDOW_HEIGHT).toBe(800);
  });
});

describe('AGENT_SKILL_STORAGE', () => {
  it('should expose the user agent skill package layout', () => {
    expect(AGENT_SKILL_STORAGE.PROJECT_CONFIG_DIR).toBe('.netior');
    expect(AGENT_SKILL_STORAGE.AGENTS_DIR).toBe('agents');
    expect(AGENT_SKILL_STORAGE.AGENT_FILE_NAME).toBe('agent.json');
    expect(AGENT_SKILL_STORAGE.SKILLS_DIR).toBe('skills');
    expect(AGENT_SKILL_STORAGE.SKILL_FILE_NAME).toBe('SKILL.md');
  });
});

describe('BUILT_IN_SKILLS', () => {
  it('should expose built-in slash-triggered skills', () => {
    expect(SLASH_TRIGGER_SKILLS.map((skill) => skill.id)).toEqual(['bootstrap', 'index']);
    expect(findSkillBySlashTrigger('bootstrap')?.id).toBe('bootstrap');
    expect(findSkillBySlashTrigger('missing')).toBeNull();
  });
});

describe('NETIOR_MCP_TOOL_SPECS', () => {
  it('should expose shared MCP tool specs', () => {
    const spec = getNetiorMcpToolSpec('create_concept');

    expect(spec).not.toBeNull();
    expect(spec?.key).toBe('create_concept');
    expect(spec?.category).toBe('concepts');
    expect(spec?.kind).toBe('mutation');
  });

  it('should build Narre tool metadata from the shared tool registry', () => {
    const metadata = getNarreToolMetadata('get_project_summary');

    expect(metadata.displayName).toBe('Project Summary');
    expect(metadata.category).toBe('project');
    expect(metadata.kind).toBe('analysis');
    expect(metadata.isMutation).toBe(false);
  });

  it('should expose Universe and Ontology network tool specs', () => {
    expect(getNetiorMcpToolSpec('get_universe_network')?.scope).toBe('app');
    expect(getNetiorMcpToolSpec('get_project_ontology_network')?.scope).toBe('project');
  });

  it('should list registered MCP tool specs', () => {
    const specs = listNetiorMcpToolSpecs();
    expect(specs.length).toBeGreaterThan(50);
  });
});
