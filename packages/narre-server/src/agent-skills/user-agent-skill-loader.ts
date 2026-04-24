import { readFile } from 'fs/promises';
import path from 'path';
import { AGENT_SKILL_STORAGE } from '@netior/shared/constants';
import type { SkillDefinition, UserAgentSkillPackage } from '@netior/shared/types';
import type { NarreSkillDefinition } from '../skills/types.js';
import {
  listUserAgentDirectoryIds,
  listUserAgentSkillPackages,
  resolveGlobalAgentsRoot,
  resolveGlobalUserAgentSkillRoot,
  resolveProjectAgentsRoot,
  resolveProjectUserAgentSkillRoot,
} from './user-agent-skill-store.js';

const DEFAULT_USER_AGENT_ID = 'default';
const SAFE_SLASH_TRIGGER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type UserAgentSkillScope = 'global' | 'project';

export interface LoadUserAgentSkillsOptions {
  projectRootDir?: string | null;
  sharedUserDataRootDir?: string | null;
  projectAgentId?: string | null;
  globalAgentId?: string | null;
}

interface LoadedPackageContext {
  scope: UserAgentSkillScope;
  agentId: string;
  pkg: UserAgentSkillPackage;
}

interface ParsedSkillMarkdown {
  name: string;
  description: string;
  body: string;
}

export interface LoadedUserAgentPromptDefinition {
  scope: UserAgentSkillScope;
  agentId: string;
  name: string;
  description: string;
  systemPrompt: string;
}

export async function loadUserAgentSkills(
  options: LoadUserAgentSkillsOptions,
): Promise<NarreSkillDefinition[]> {
  const skills: NarreSkillDefinition[] = [];

  if (options.projectRootDir) {
    const agentIds = await resolveAgentIds(
      resolveProjectAgentsRoot(options.projectRootDir),
      options.projectAgentId,
    );
    for (const agentId of agentIds) {
      const rootDir = resolveProjectUserAgentSkillRoot(options.projectRootDir, agentId);
      skills.push(...await loadSkillPackages(rootDir, 'project', agentId));
    }
  }

  if (options.sharedUserDataRootDir) {
    const agentIds = await resolveAgentIds(
      resolveGlobalAgentsRoot(options.sharedUserDataRootDir),
      options.globalAgentId,
    );
    for (const agentId of agentIds) {
      const rootDir = resolveGlobalUserAgentSkillRoot(options.sharedUserDataRootDir, agentId);
      skills.push(...await loadSkillPackages(rootDir, 'global', agentId));
    }
  }

  return skills;
}

export async function loadUserAgentPromptDefinitions(
  options: LoadUserAgentSkillsOptions,
): Promise<LoadedUserAgentPromptDefinition[]> {
  const prompts: LoadedUserAgentPromptDefinition[] = [];

  if (options.sharedUserDataRootDir) {
    const agentsRootDir = resolveGlobalAgentsRoot(options.sharedUserDataRootDir);
    const agentIds = await resolveAgentIds(agentsRootDir, options.globalAgentId);
    prompts.push(...await loadPromptDefinitionsForScope(agentsRootDir, 'global', agentIds));
  }

  if (options.projectRootDir) {
    const agentsRootDir = resolveProjectAgentsRoot(options.projectRootDir);
    const agentIds = await resolveAgentIds(agentsRootDir, options.projectAgentId);
    prompts.push(...await loadPromptDefinitionsForScope(agentsRootDir, 'project', agentIds));
  }

  return prompts;
}

async function resolveAgentIds(agentsRootDir: string, explicitAgentId?: string | null): Promise<string[]> {
  if (explicitAgentId?.trim()) {
    return [explicitAgentId.trim()];
  }

  const agentIds = await listUserAgentDirectoryIds(agentsRootDir);
  return agentIds.length > 0 ? agentIds : [DEFAULT_USER_AGENT_ID];
}

export function parseSkillMarkdown(content: string): ParsedSkillMarkdown {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    throw new Error('SKILL.md must start with YAML frontmatter');
  }

  const frontmatterEnd = normalized.indexOf('\n---\n', 4);
  if (frontmatterEnd < 0) {
    throw new Error('SKILL.md frontmatter must end with ---');
  }

  const frontmatter = normalized.slice(4, frontmatterEnd);
  const body = normalized.slice(frontmatterEnd + '\n---\n'.length).trim();
  const fields = parseFrontmatterFields(frontmatter);
  const name = fields.name?.trim();
  const description = fields.description?.trim();

  if (!name) {
    throw new Error('SKILL.md frontmatter requires name');
  }
  if (!description) {
    throw new Error('SKILL.md frontmatter requires description');
  }
  if (!body) {
    throw new Error('SKILL.md body is empty');
  }

  return { name, description, body };
}

async function loadSkillPackages(
  skillRootDir: string,
  scope: UserAgentSkillScope,
  agentId: string,
): Promise<NarreSkillDefinition[]> {
  const packages = await listUserAgentSkillPackages(skillRootDir);
  const skills: NarreSkillDefinition[] = [];

  for (const pkg of packages) {
    try {
      skills.push(await loadSkillPackage({ scope, agentId, pkg }));
    } catch (error) {
      console.warn(
        `[narre:skills] failed to load ${scope} skill package ${pkg.id}: ${(error as Error).message}`,
      );
    }
  }

  return skills;
}

async function loadPromptDefinitionsForScope(
  agentsRootDir: string,
  scope: UserAgentSkillScope,
  agentIds: readonly string[],
): Promise<LoadedUserAgentPromptDefinition[]> {
  const prompts: LoadedUserAgentPromptDefinition[] = [];

  for (const agentId of agentIds) {
    const agentFilePath = path.join(agentsRootDir, agentId, AGENT_SKILL_STORAGE.AGENT_FILE_NAME);

    try {
      const content = await readFile(agentFilePath, 'utf8');
      const parsed = JSON.parse(content) as {
        name?: unknown;
        description?: unknown;
        systemPrompt?: unknown;
      };
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
      const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
      const systemPrompt = typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt.trim() : '';

      if (!name || !systemPrompt) {
        continue;
      }

      prompts.push({
        scope,
        agentId,
        name,
        description,
        systemPrompt,
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        continue;
      }
      console.warn(
        `[narre:skills] failed to load ${scope} agent prompt ${agentId}: ${(error as Error).message}`,
      );
    }
  }

  return prompts;
}

async function loadSkillPackage(context: LoadedPackageContext): Promise<NarreSkillDefinition> {
  const content = await readFile(context.pkg.skillFilePath, 'utf8');
  const parsed = parseSkillMarkdown(content);
  const triggerName = normalizeSlashTriggerName(parsed.name, context.pkg.id);
  const skill: NarreSkillDefinition = {
    id: context.pkg.id,
    name: parsed.name,
    description: parsed.description,
    source: 'file',
    trigger: {
      type: 'slash',
      name: triggerName,
    },
    instructions: parsed.body,
    buildPrompt: () => buildFileSkillPrompt(context, parsed, triggerName),
  };

  return skill;
}

function buildFileSkillPrompt(
  context: LoadedPackageContext,
  parsed: ParsedSkillMarkdown,
  triggerName: string,
): string {
  return [
    `## Skill: /${triggerName}`,
    '',
    `source=file`,
    `agent_scope=${context.scope}`,
    `agent_id=${context.agentId}`,
    `skill_package=${context.pkg.id}`,
    `skill_root=${context.pkg.rootDir}`,
    '',
    '### Description',
    parsed.description,
    '',
    '### Instructions',
    parsed.body,
  ].join('\n');
}

function normalizeSlashTriggerName(name: string, fallback: string): string {
  const normalizedName = name.trim().toLowerCase();
  if (SAFE_SLASH_TRIGGER_PATTERN.test(normalizedName)) {
    return normalizedName;
  }

  return fallback.toLowerCase();
}

function parseFrontmatterFields(frontmatter: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = frontmatter.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const field = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(line);
    if (!field) {
      continue;
    }

    const key = field[1];
    const rawValue = field[2] ?? '';
    if (rawValue === '>' || rawValue === '|') {
      const blockLines: string[] = [];
      index += 1;
      while (index < lines.length) {
        const blockLine = lines[index];
        if (/^[A-Za-z][A-Za-z0-9_-]*:/.test(blockLine)) {
          index -= 1;
          break;
        }
        blockLines.push(blockLine.replace(/^\s{2}/, ''));
        index += 1;
      }
      fields[key] = rawValue === '>'
        ? blockLines.map((value) => value.trim()).filter(Boolean).join(' ')
        : blockLines.join('\n').trim();
      continue;
    }

    fields[key] = stripYamlQuotes(rawValue.trim());
  }

  return fields;
}

function stripYamlQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function dedupeSkillsBySlashTrigger(skills: readonly NarreSkillDefinition[]): NarreSkillDefinition[] {
  const seen = new Set<string>();
  const result: NarreSkillDefinition[] = [];

  for (const skill of skills) {
    const key = getSkillDedupeKey(skill);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(skill);
  }

  return result;
}

function getSkillDedupeKey(skill: SkillDefinition): string {
  if (skill.trigger?.type === 'slash') {
    return `slash:${skill.trigger.name.toLowerCase()}`;
  }
  return `id:${skill.id}`;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'ENOENT';
}
