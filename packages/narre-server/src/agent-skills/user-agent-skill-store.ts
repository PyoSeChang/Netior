import { readdir, stat } from 'fs/promises';
import path from 'path';
import { AGENT_SKILL_STORAGE } from '@netior/shared/constants';
import type {
  NarreUserAgentDefinition,
  UserAgentSkillPackage,
} from '@netior/shared/types';

const SAFE_AGENT_DIRECTORY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface UserAgentSkillRootOptions {
  agent: NarreUserAgentDefinition;
  projectRootDir?: string | null;
  sharedUserDataRootDir?: string | null;
}

export function resolveUserAgentSkillRoot(options: UserAgentSkillRootOptions): string {
  if (options.agent.userAgentType === 'project') {
    if (!options.projectRootDir) {
      throw new Error(`Project directory is required for project user agent ${options.agent.id}`);
    }
    return resolveProjectUserAgentSkillRoot(options.projectRootDir, options.agent.id);
  }

  if (!options.sharedUserDataRootDir) {
    throw new Error(`Shared user data root directory is required for global user agent ${options.agent.id}`);
  }
  return resolveGlobalUserAgentSkillRoot(options.sharedUserDataRootDir, options.agent.id);
}

export function resolveProjectUserAgentSkillRoot(projectRootDir: string, agentId: string): string {
  return path.join(
    resolveProjectAgentsRoot(projectRootDir),
    normalizeAgentDirectoryId(agentId),
    AGENT_SKILL_STORAGE.SKILLS_DIR,
  );
}

export function resolveGlobalUserAgentSkillRoot(sharedUserDataRootDir: string, agentId: string): string {
  return path.join(
    resolveGlobalAgentsRoot(sharedUserDataRootDir),
    normalizeAgentDirectoryId(agentId),
    AGENT_SKILL_STORAGE.SKILLS_DIR,
  );
}

export function resolveProjectAgentsRoot(projectRootDir: string): string {
  return path.join(
    projectRootDir,
    AGENT_SKILL_STORAGE.PROJECT_CONFIG_DIR,
    AGENT_SKILL_STORAGE.AGENTS_DIR,
  );
}

export function resolveGlobalAgentsRoot(sharedUserDataRootDir: string): string {
  return path.join(
    sharedUserDataRootDir,
    AGENT_SKILL_STORAGE.AGENTS_DIR,
  );
}

export async function listUserAgentDirectoryIds(agentsRootDir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(agentsRootDir, { withFileTypes: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  return entries
    .filter((entry) => entry.isDirectory() && isSafePathSegment(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function listUserAgentSkillPackages(skillRootDir: string): Promise<UserAgentSkillPackage[]> {
  let entries;
  try {
    entries = await readdir(skillRootDir, { withFileTypes: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  const packages: UserAgentSkillPackage[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafePathSegment(entry.name)) {
      continue;
    }

    const rootDir = path.join(skillRootDir, entry.name);
    const skillFilePath = path.join(rootDir, AGENT_SKILL_STORAGE.SKILL_FILE_NAME);
    if (!(await isFile(skillFilePath))) {
      continue;
    }

    packages.push({
      id: entry.name,
      rootDir,
      skillFilePath,
      format: AGENT_SKILL_STORAGE.FORMAT,
    });
  }

  return packages.sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeAgentDirectoryId(agentId: string): string {
  const normalized = agentId.trim();
  if (!isSafePathSegment(normalized)) {
    throw new Error(`Invalid agent id for filesystem storage: ${agentId}`);
  }
  return normalized;
}

function isSafePathSegment(value: string): boolean {
  return SAFE_AGENT_DIRECTORY_ID_PATTERN.test(value) && value !== '.' && value !== '..';
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'ENOENT';
}
