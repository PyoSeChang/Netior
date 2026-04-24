import { mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import { AGENT_SKILL_STORAGE } from '@netior/shared/constants';
import type {
  DeleteUserAgentInput,
  DeleteUserAgentSkillInput,
  NarreUserAgentType,
  UpsertUserAgentInput,
  UpsertUserAgentSkillInput,
  UserAgentRecord,
  UserAgentSkillSummary,
} from '@netior/shared/types';
import { getRemoteProject } from '../netior-service/netior-service-client';
import { getSharedUserDataRoot } from '../runtime/runtime-paths';

const AGENT_FILE_VERSION = 1;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

interface PersistedUserAgent {
  version: 1;
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userAgentType: NarreUserAgentType;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ParsedSkillMarkdown {
  name: string;
  description: string;
  body: string;
}

export async function listUserAgents(projectId?: string | null): Promise<UserAgentRecord[]> {
  const records: UserAgentRecord[] = [];

  records.push(...await listUserAgentsInRoot(resolveGlobalAgentsRoot(), 'global'));

  if (projectId) {
    const projectRoot = await resolveProjectRootDir(projectId);
    records.push(...await listUserAgentsInRoot(resolveProjectAgentsRoot(projectRoot), 'project', projectId));
  }

  return records.sort((a, b) => {
    if (a.userAgentType !== b.userAgentType) {
      return a.userAgentType === 'project' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function upsertUserAgent(input: UpsertUserAgentInput): Promise<UserAgentRecord> {
  const id = normalizeId(input.id || input.name);
  const name = input.name.trim();
  if (!name) {
    throw new Error('Agent name is required');
  }

  const rootDir = await resolveAgentRoot(input.userAgentType, id, input.projectId);
  const filePath = path.join(rootDir, AGENT_SKILL_STORAGE.AGENT_FILE_NAME);
  const existing = await readAgentFile(filePath);
  const now = new Date().toISOString();
  const record: PersistedUserAgent = {
    version: AGENT_FILE_VERSION,
    id,
    name,
    description: input.description?.trim() ?? '',
    systemPrompt: input.systemPrompt?.trim() ?? '',
    userAgentType: input.userAgentType,
    ...(input.userAgentType === 'project' && input.projectId ? { projectId: input.projectId } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await mkdir(rootDir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
  return toUserAgentRecord(record, rootDir, await listUserAgentSkills(rootDir));
}

export async function deleteUserAgent(input: DeleteUserAgentInput): Promise<boolean> {
  const id = normalizeId(input.agentId);
  const rootDir = await resolveAgentRoot(input.userAgentType, id, input.projectId);
  await rm(rootDir, { recursive: true, force: true });
  return true;
}

export async function upsertUserAgentSkill(input: UpsertUserAgentSkillInput): Promise<UserAgentSkillSummary> {
  const agentId = normalizeId(input.agentId);
  const skillId = normalizeId(input.skillId || input.name);
  const name = input.name.trim();
  const description = input.description.trim();
  const body = input.body.trim();

  if (!name) {
    throw new Error('Skill name is required');
  }
  if (!description) {
    throw new Error('Skill description is required');
  }
  if (!body) {
    throw new Error('Skill body is required');
  }

  const agentRoot = await resolveAgentRoot(input.userAgentType, agentId, input.projectId);
  const skillRoot = path.join(agentRoot, AGENT_SKILL_STORAGE.SKILLS_DIR, skillId);
  const skillFilePath = path.join(skillRoot, AGENT_SKILL_STORAGE.SKILL_FILE_NAME);

  await ensureAgentExists(agentRoot, agentId, input.userAgentType, input.projectId);
  await mkdir(skillRoot, { recursive: true });
  await writeFile(skillFilePath, serializeSkillMarkdown({ name, description, body }), 'utf-8');
  return toSkillSummary(skillId, skillRoot, skillFilePath, { name, description, body });
}

export async function deleteUserAgentSkill(input: DeleteUserAgentSkillInput): Promise<boolean> {
  const agentId = normalizeId(input.agentId);
  const skillId = normalizeId(input.skillId);
  const agentRoot = await resolveAgentRoot(input.userAgentType, agentId, input.projectId);
  const skillRoot = path.join(agentRoot, AGENT_SKILL_STORAGE.SKILLS_DIR, skillId);
  await rm(skillRoot, { recursive: true, force: true });
  return true;
}

async function listUserAgentsInRoot(
  agentsRoot: string,
  userAgentType: NarreUserAgentType,
  projectId?: string,
): Promise<UserAgentRecord[]> {
  let entries;
  try {
    entries = await readdir(agentsRoot, { withFileTypes: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  const records: UserAgentRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeId(entry.name)) {
      continue;
    }

    const rootDir = path.join(agentsRoot, entry.name);
    const filePath = path.join(rootDir, AGENT_SKILL_STORAGE.AGENT_FILE_NAME);
    const persisted = await readAgentFile(filePath);
    const fallback = createFallbackAgent(entry.name, userAgentType, projectId);
    const agent = persisted
      ? { ...persisted, userAgentType, ...(projectId ? { projectId } : {}) }
      : fallback;
    records.push(toUserAgentRecord(agent, rootDir, await listUserAgentSkills(rootDir)));
  }

  return records;
}

async function listUserAgentSkills(agentRoot: string): Promise<UserAgentSkillSummary[]> {
  const skillsRoot = path.join(agentRoot, AGENT_SKILL_STORAGE.SKILLS_DIR);
  let entries;
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  const skills: UserAgentSkillSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafeId(entry.name)) {
      continue;
    }

    const rootDir = path.join(skillsRoot, entry.name);
    const skillFilePath = path.join(rootDir, AGENT_SKILL_STORAGE.SKILL_FILE_NAME);
    try {
      const parsed = parseSkillMarkdown(await readFile(skillFilePath, 'utf-8'));
      skills.push(await toSkillSummary(entry.name, rootDir, skillFilePath, parsed));
    } catch {
      continue;
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function ensureAgentExists(
  agentRoot: string,
  agentId: string,
  userAgentType: NarreUserAgentType,
  projectId?: string,
): Promise<void> {
  const filePath = path.join(agentRoot, AGENT_SKILL_STORAGE.AGENT_FILE_NAME);
  if (await isFile(filePath)) {
    return;
  }

  const now = new Date().toISOString();
  const fallback = createFallbackAgent(agentId, userAgentType, projectId, now);
  await mkdir(agentRoot, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, 'utf-8');
}

function toUserAgentRecord(
  agent: PersistedUserAgent,
  rootDir: string,
  skills: UserAgentSkillSummary[],
): UserAgentRecord {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    userAgentType: agent.userAgentType,
    ...(agent.projectId ? { projectId: agent.projectId } : {}),
    rootDir,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    skills,
  };
}

async function toSkillSummary(
  id: string,
  rootDir: string,
  skillFilePath: string,
  parsed: ParsedSkillMarkdown,
): Promise<UserAgentSkillSummary> {
  return {
    id,
    name: parsed.name,
    description: parsed.description,
    body: parsed.body,
    rootDir,
    skillFilePath,
    updatedAt: await getFileUpdatedAt(skillFilePath),
  };
}

function createFallbackAgent(
  id: string,
  userAgentType: NarreUserAgentType,
  projectId?: string,
  timestamp = new Date().toISOString(),
): PersistedUserAgent {
  return {
    version: AGENT_FILE_VERSION,
    id,
    name: humanizeId(id),
    description: '',
    systemPrompt: '',
    userAgentType,
    ...(userAgentType === 'project' && projectId ? { projectId } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function readAgentFile(filePath: string): Promise<PersistedUserAgent | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf-8')) as Partial<PersistedUserAgent>;
    if (
      parsed.version !== AGENT_FILE_VERSION
      || !parsed.id
      || !parsed.name
      || (parsed.userAgentType !== 'global' && parsed.userAgentType !== 'project')
    ) {
      return null;
    }
    return {
      version: AGENT_FILE_VERSION,
      id: parsed.id,
      name: parsed.name,
      description: parsed.description ?? '',
      systemPrompt: parsed.systemPrompt ?? '',
      userAgentType: parsed.userAgentType,
      ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseSkillMarkdown(content: string): ParsedSkillMarkdown {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    throw new Error('SKILL.md must start with frontmatter');
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
  if (!name || !description || !body) {
    throw new Error('SKILL.md requires name, description, and body');
  }
  return { name, description, body };
}

function parseFrontmatterFields(frontmatter: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = frontmatter.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const field = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(lines[index]);
    if (!field) {
      continue;
    }

    const key = field[1];
    const raw = field[2] ?? '';
    if (raw === '>' || raw === '|') {
      const blockLines: string[] = [];
      index += 1;
      while (index < lines.length) {
        if (/^[A-Za-z][A-Za-z0-9_-]*:/.test(lines[index])) {
          index -= 1;
          break;
        }
        blockLines.push(lines[index].replace(/^\s{2}/, ''));
        index += 1;
      }
      fields[key] = raw === '>'
        ? blockLines.map((line) => line.trim()).filter(Boolean).join(' ')
        : blockLines.join('\n').trim();
      continue;
    }

    fields[key] = stripQuotes(raw.trim());
  }
  return fields;
}

function serializeSkillMarkdown(skill: ParsedSkillMarkdown): string {
  return [
    '---',
    `name: ${toSingleLine(skill.name)}`,
    'description: >',
    ...toBlockLines(skill.description),
    '---',
    '',
    skill.body,
    '',
  ].join('\n');
}

function toBlockLines(value: string): string[] {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  return lines.length > 0 ? lines.map((line) => `  ${line}`) : ['  '];
}

function toSingleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

async function resolveProjectRootDir(projectId?: string): Promise<string> {
  if (!projectId) {
    throw new Error('projectId is required for project agents');
  }

  const project = await getRemoteProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  return project.root_dir;
}

async function resolveAgentRoot(
  userAgentType: NarreUserAgentType,
  agentId: string,
  projectId?: string,
): Promise<string> {
  return userAgentType === 'project'
    ? path.join(resolveProjectAgentsRoot(await resolveProjectRootDir(projectId)), agentId)
    : path.join(resolveGlobalAgentsRoot(), agentId);
}

function resolveProjectAgentsRoot(projectRootDir: string): string {
  return path.join(
    projectRootDir,
    AGENT_SKILL_STORAGE.PROJECT_CONFIG_DIR,
    AGENT_SKILL_STORAGE.AGENTS_DIR,
  );
}

function resolveGlobalAgentsRoot(): string {
  return path.join(getSharedUserDataRoot(), AGENT_SKILL_STORAGE.AGENTS_DIR);
}

function normalizeId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!isSafeId(normalized)) {
    throw new Error(`Invalid id: ${value}`);
  }
  return normalized;
}

function isSafeId(value: string): boolean {
  return SAFE_ID_PATTERN.test(value) && value !== '.' && value !== '..';
}

function humanizeId(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ') || id;
}

async function getFileUpdatedAt(filePath: string): Promise<string | null> {
  try {
    return (await stat(filePath)).mtime.toISOString();
  } catch {
    return null;
  }
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'ENOENT';
}
