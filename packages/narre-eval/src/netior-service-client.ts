import type {
  Archetype,
  ArchetypeCreate,
  Concept,
  ConceptCreate,
  FileEntity,
  FileEntityCreate,
  Module,
  ModuleCreate,
  Project,
  ProjectCreate,
  RelationType,
  RelationTypeCreate,
  NetiorServiceResponse,
} from '@netior/shared/types';

function toQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  let payload: NetiorServiceResponse<T>;
  try {
    payload = await response.json() as NetiorServiceResponse<T>;
  } catch {
    throw new Error(`Netior service returned a non-JSON response for ${path}`);
  }

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? `Netior service request failed for ${path}` : payload.error);
  }

  return payload.data;
}

export async function createProject(baseUrl: string, data: ProjectCreate): Promise<Project> {
  return requestJson<Project>(baseUrl, '/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProjectById(baseUrl: string, projectId: string): Promise<Project | null> {
  return requestJson<Project | null>(baseUrl, `/projects/${encodeURIComponent(projectId)}`);
}

export async function createArchetype(baseUrl: string, data: ArchetypeCreate): Promise<Archetype> {
  return requestJson<Archetype>(baseUrl, '/archetypes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listArchetypes(baseUrl: string, projectId: string): Promise<Archetype[]> {
  return requestJson<Archetype[]>(baseUrl, `/archetypes${toQueryString({ projectId })}`);
}

export async function createRelationType(baseUrl: string, data: RelationTypeCreate): Promise<RelationType> {
  return requestJson<RelationType>(baseUrl, '/relation-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listRelationTypes(baseUrl: string, projectId: string): Promise<RelationType[]> {
  return requestJson<RelationType[]>(baseUrl, `/relation-types${toQueryString({ projectId })}`);
}

export async function createConcept(baseUrl: string, data: ConceptCreate): Promise<Concept> {
  return requestJson<Concept>(baseUrl, '/concepts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createModule(baseUrl: string, data: ModuleCreate): Promise<Module> {
  return requestJson<Module>(baseUrl, '/modules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createFileEntity(baseUrl: string, data: FileEntityCreate): Promise<FileEntity> {
  return requestJson<FileEntity>(baseUrl, '/files', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function evalQuery<T extends Record<string, unknown>>(
  baseUrl: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return requestJson<T[]>(baseUrl, '/eval/query', {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  });
}
