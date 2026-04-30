import type {
  Schema,
  SchemaField,
  SchemaFieldCreate,
  SchemaFieldUpdate,
  SchemaMeaning,
  SchemaMeaningCreate,
  SchemaMeaningSlotBinding,
  SchemaMeaningSlotBindingUpdate,
  SchemaMeaningUpdate,
  SchemaCreate,
  SchemaUpdate,
  Concept,
  ConceptCreate,
  ConceptProperty,
  ConceptPropertyUpsert,
  ConceptUpdate,
  Edge,
  EdgeCreate,
  EdgeUpdate,
  FileEntity,
  FileEntityUpdate,
  Module,
  Network,
  NetworkBreadcrumbItem,
  NetworkCreate,
  NetworkFullData,
  NetworkNode,
  NetworkNodeCreate,
  NetworkNodeUpdate,
  NetworkTreeNode,
  NetworkUpdate,
  NetworkObjectType,
  ObjectRecord,
  Project,
  Model,
  ModelCreate,
  ModelUpdate,
  NetiorServiceResponse,
  TypeGroup,
  TypeGroupCreate,
  TypeGroupKind,
  TypeGroupUpdate,
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

export async function listNetworks(projectId: string, rootOnly?: boolean): Promise<Network[]> {
  return requestJson<Network[]>(`/networks${toQueryString({
    projectId,
    rootOnly: rootOnly == null ? undefined : String(rootOnly),
  })}`);
}

export async function createNetwork(data: NetworkCreate): Promise<Network> {
  return requestJson<Network>('/networks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNetwork(id: string, data: NetworkUpdate): Promise<Network | null> {
  return requestJson<Network | null>(`/networks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteNetwork(id: string): Promise<boolean> {
  return requestJson<boolean>(`/networks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listSchemas(projectId: string): Promise<Schema[]> {
  return requestJson<Schema[]>(`/schemas${toQueryString({ projectId })}`);
}

export async function listSchemaFields(schemaId: string): Promise<SchemaField[]> {
  return requestJson<SchemaField[]>(`/schema-fields${toQueryString({ schemaId })}`);
}

export async function listSchemaMeanings(schemaId: string): Promise<SchemaMeaning[]> {
  return requestJson<SchemaMeaning[]>(`/schema-meanings${toQueryString({ schemaId })}`);
}

export async function ensureSchemaMeaning(data: SchemaMeaningCreate): Promise<SchemaMeaning | null> {
  return requestJson<SchemaMeaning | null>('/schema-meanings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSchemaMeaning(
  id: string,
  data: SchemaMeaningUpdate,
): Promise<SchemaMeaning | null> {
  return requestJson<SchemaMeaning | null>(`/schema-meanings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSchemaMeaning(id: string): Promise<boolean> {
  return requestJson<boolean>(`/schema-meanings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function updateSchemaMeaningSlotBinding(
  id: string,
  data: SchemaMeaningSlotBindingUpdate,
): Promise<SchemaMeaningSlotBinding | null> {
  return requestJson<SchemaMeaningSlotBinding | null>(`/schema-meaning-slots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function createSchemaField(data: SchemaFieldCreate): Promise<SchemaField> {
  return requestJson<SchemaField>('/schema-fields', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSchemaField(id: string, data: SchemaFieldUpdate): Promise<SchemaField | null> {
  return requestJson<SchemaField | null>(`/schema-fields/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSchemaField(id: string): Promise<boolean> {
  return requestJson<boolean>(`/schema-fields/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function reorderSchemaFields(schemaId: string, orderedIds: string[]): Promise<boolean> {
  return requestJson<boolean>('/schema-fields/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ schemaId, orderedIds }),
  });
}

export async function createSchema(data: SchemaCreate): Promise<Schema> {
  return requestJson<Schema>('/schemas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSchema(id: string, data: SchemaUpdate): Promise<Schema | null> {
  return requestJson<Schema | null>(`/schemas/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSchema(id: string): Promise<boolean> {
  return requestJson<boolean>(`/schemas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listModels(projectId: string): Promise<Model[]> {
  return requestJson<Model[]>(`/models${toQueryString({ projectId })}`);
}

export async function createModel(data: ModelCreate): Promise<Model> {
  return requestJson<Model>('/models', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getModel(id: string): Promise<Model | null> {
  return requestJson<Model | null>(`/models/${encodeURIComponent(id)}`);
}

export async function updateModel(id: string, data: ModelUpdate): Promise<Model | null> {
  return requestJson<Model | null>(`/models/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteModel(id: string): Promise<boolean> {
  return requestJson<boolean>(`/models/${encodeURIComponent(id)}`, {
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

export async function listTypeGroups(projectId: string, kind: TypeGroupKind): Promise<TypeGroup[]> {
  return requestJson<TypeGroup[]>(`/type-groups${toQueryString({ projectId, kind })}`);
}

export async function createTypeGroup(data: TypeGroupCreate): Promise<TypeGroup> {
  return requestJson<TypeGroup>('/type-groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTypeGroup(id: string, data: TypeGroupUpdate): Promise<TypeGroup | null> {
  return requestJson<TypeGroup | null>(`/type-groups/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTypeGroup(id: string): Promise<boolean> {
  return requestJson<boolean>(`/type-groups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listModules(projectId: string): Promise<Module[]> {
  return requestJson<Module[]>(`/modules${toQueryString({ projectId })}`);
}

export async function getObject(id: string): Promise<ObjectRecord | null> {
  return requestJson<ObjectRecord | null>(`/objects/${encodeURIComponent(id)}`);
}

export async function getObjectByRef(objectType: NetworkObjectType, refId: string): Promise<ObjectRecord | null> {
  return requestJson<ObjectRecord | null>(`/objects/by-ref${toQueryString({ objectType, refId })}`);
}

export async function getUniverseNetwork(): Promise<Network | null> {
  return requestJson<Network | null>('/networks/universe');
}

export async function getProjectOntologyNetwork(projectId: string): Promise<Network | null> {
  return requestJson<Network | null>(`/networks/ontology${toQueryString({ projectId })}`);
}

export async function getNetworkTree(projectId: string): Promise<NetworkTreeNode[]> {
  return requestJson<NetworkTreeNode[]>(`/networks/tree${toQueryString({ projectId })}`);
}

export async function getNetworkFull(networkId: string): Promise<NetworkFullData | null> {
  return requestJson<NetworkFullData | null>(`/networks/${encodeURIComponent(networkId)}/full`);
}

export async function getNetworkAncestors(networkId: string): Promise<NetworkBreadcrumbItem[]> {
  return requestJson<NetworkBreadcrumbItem[]>(`/networks/${encodeURIComponent(networkId)}/ancestors`);
}

export async function createNetworkNode(data: NetworkNodeCreate): Promise<NetworkNode> {
  return requestJson<NetworkNode>('/network-nodes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getNetworkNode(id: string): Promise<NetworkNode | null> {
  return requestJson<NetworkNode | null>(`/network-nodes/${encodeURIComponent(id)}`);
}

export async function updateNetworkNode(id: string, data: NetworkNodeUpdate): Promise<NetworkNode> {
  return requestJson<NetworkNode>(`/network-nodes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteNetworkNode(id: string): Promise<boolean> {
  return requestJson<boolean>(`/network-nodes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function createEdge(data: EdgeCreate): Promise<Edge> {
  return requestJson<Edge>('/edges', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getEdge(id: string): Promise<Edge | null> {
  return requestJson<Edge | null>(`/edges/${encodeURIComponent(id)}`);
}

export async function updateEdge(id: string, data: EdgeUpdate): Promise<Edge | null> {
  return requestJson<Edge | null>(`/edges/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteEdge(id: string): Promise<boolean> {
  return requestJson<boolean>(`/edges/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getFileEntity(fileId: string): Promise<FileEntity | null> {
  return requestJson<FileEntity | null>(`/files/${encodeURIComponent(fileId)}`);
}

export async function getConceptProperties(conceptId: string): Promise<ConceptProperty[]> {
  return requestJson<ConceptProperty[]>(`/concept-properties${toQueryString({ conceptId })}`);
}

export async function upsertConceptProperty(data: ConceptPropertyUpsert): Promise<ConceptProperty> {
  return requestJson<ConceptProperty>('/concept-properties', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteConceptProperty(id: string): Promise<boolean> {
  return requestJson<boolean>(`/concept-properties/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
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
