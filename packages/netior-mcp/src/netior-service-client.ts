import type {
  Archetype,
  ArchetypeCreate,
  ArchetypeUpdate,
  Concept,
  ConceptCreate,
  ConceptUpdate,
  FileEntity,
  FileEntityUpdate,
  Module,
  Network,
  Project,
  RelationType,
  RelationTypeCreate,
  RelationTypeUpdate,
  NetiorServiceResponse,
} from '@netior/shared/types';

function getNetiorServiceBaseUrl(): string {
  return process.env.NETIOR_SERVICE_URL ?? `http://127.0.0.1:${process.env.NETIOR_SERVICE_PORT ?? '3201'}`;
}

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getNetiorServiceBaseUrl()}${path}`, {
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

export function getNetiorServiceUrl(): string {
  return getNetiorServiceBaseUrl();
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  return requestJson<Project | null>(`/projects/${encodeURIComponent(projectId)}`);
}

export async function listNetworks(projectId: string): Promise<Network[]> {
  return requestJson<Network[]>(`/networks${toQueryString({ projectId })}`);
}

export async function listArchetypes(projectId: string): Promise<Archetype[]> {
  return requestJson<Archetype[]>(`/archetypes${toQueryString({ projectId })}`);
}

export async function createArchetype(data: ArchetypeCreate): Promise<Archetype> {
  return requestJson<Archetype>('/archetypes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateArchetype(id: string, data: ArchetypeUpdate): Promise<Archetype | null> {
  return requestJson<Archetype | null>(`/archetypes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteArchetype(id: string): Promise<boolean> {
  return requestJson<boolean>(`/archetypes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getConceptsByProject(projectId: string): Promise<Concept[]> {
  return requestJson<Concept[]>(`/concepts${toQueryString({ projectId })}`);
}

export async function searchConcepts(projectId: string, query: string): Promise<Concept[]> {
  return requestJson<Concept[]>(`/concepts/search${toQueryString({ projectId, query })}`);
}

export async function createConcept(data: ConceptCreate): Promise<Concept> {
  return requestJson<Concept>('/concepts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateConcept(id: string, data: ConceptUpdate): Promise<Concept | null> {
  return requestJson<Concept | null>(`/concepts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteConcept(id: string): Promise<boolean> {
  return requestJson<boolean>(`/concepts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRelationTypes(projectId: string): Promise<RelationType[]> {
  return requestJson<RelationType[]>(`/relation-types${toQueryString({ projectId })}`);
}

export async function createRelationType(data: RelationTypeCreate): Promise<RelationType> {
  return requestJson<RelationType>('/relation-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRelationType(id: string, data: RelationTypeUpdate): Promise<RelationType | null> {
  return requestJson<RelationType | null>(`/relation-types/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRelationType(id: string): Promise<boolean> {
  return requestJson<boolean>(`/relation-types/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listModules(projectId: string): Promise<Module[]> {
  return requestJson<Module[]>(`/modules${toQueryString({ projectId })}`);
}

export async function getFileEntity(fileId: string): Promise<FileEntity | null> {
  return requestJson<FileEntity | null>(`/files/${encodeURIComponent(fileId)}`);
}

async function updateFileEntity(id: string, data: FileEntityUpdate): Promise<FileEntity | null> {
  return requestJson<FileEntity | null>(`/files/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateFileMetadataField(
  fileId: string,
  field: string,
  value: unknown,
): Promise<FileEntity | null> {
  const entity = await getFileEntity(fileId);
  if (!entity) {
    return null;
  }

  const metadata = entity.metadata ? JSON.parse(entity.metadata) as Record<string, unknown> : {};
  metadata[field] = value;
  return updateFileEntity(fileId, { metadata: JSON.stringify(metadata) });
}
