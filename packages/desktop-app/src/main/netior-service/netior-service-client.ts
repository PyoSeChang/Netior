import type {
  Archetype,
  ArchetypeCreate,
  ArchetypeField,
  ArchetypeFieldCreate,
  ArchetypeFieldUpdate,
  ArchetypeUpdate,
  ConceptEditorPrefs,
  ConceptEditorPrefsUpdate,
  Concept,
  ConceptCreate,
  ConceptProperty,
  ConceptPropertyUpsert,
  ConceptUpdate,
  Context,
  ContextCreate,
  ContextMember,
  ContextUpdate,
  Edge,
  EdgeCreate,
  EdgeUpdate,
  FileEntity,
  FileEntityCreate,
  FileEntityUpdate,
  Module,
  ModuleCreate,
  ModuleDirectory,
  ModuleDirectoryCreate,
  ModuleUpdate,
  Network,
  NetworkObjectType,
  NetworkBreadcrumbItem,
  NetworkCreate,
  NetworkNode,
  NetworkNodeCreate,
  NetworkNodeUpdate,
  NetworkTreeNode,
  NetworkUpdate,
  NetworkFullData,
  NodePosition,
  EdgeVisual,
  ObjectRecord,
  Project,
  ProjectCreate,
  ProjectUpdate,
  RelationType,
  RelationTypeCreate,
  RelationTypeUpdate,
  TypeGroup,
  TypeGroupCreate,
  TypeGroupKind,
  TypeGroupUpdate,
  Layout,
  NetiorServiceResponse,
} from '@netior/shared/types';
import { getNetiorServiceBaseUrl } from '../process/netior-service-manager';

export async function getRemoteConfig(key: string): Promise<unknown> {
  return requestJson<unknown>(`/config/${encodeURIComponent(key)}`);
}

export async function setRemoteConfig(key: string, value: unknown): Promise<boolean> {
  return requestJson<boolean>(`/config/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function listRemoteProjects(): Promise<Project[]> {
  return requestJson<Project[]>('/projects');
}

export async function createRemoteProject(data: ProjectCreate): Promise<Project> {
  return requestJson<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRemoteProject(id: string, data: ProjectUpdate): Promise<Project | null> {
  return requestJson<Project | null>(`/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getRemoteProject(id: string): Promise<Project | null> {
  return requestJson<Project | null>(`/projects/${encodeURIComponent(id)}`);
}

export async function updateRemoteProjectRootDir(id: string, rootDir: string): Promise<Project | null> {
  return requestJson<Project | null>(`/projects/${encodeURIComponent(id)}/root-dir`, {
    method: 'PATCH',
    body: JSON.stringify({ rootDir }),
  });
}

export async function deleteRemoteProject(id: string): Promise<boolean> {
  return requestJson<boolean>(`/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRemoteConceptsByProject(projectId: string): Promise<Concept[]> {
  return requestJson<Concept[]>(`/concepts${toQueryString({ projectId })}`);
}

export async function createRemoteConcept(data: ConceptCreate): Promise<Concept> {
  return requestJson<Concept>('/concepts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRemoteConcept(id: string, data: ConceptUpdate): Promise<Concept | null> {
  return requestJson<Concept | null>(`/concepts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteConcept(id: string): Promise<boolean> {
  return requestJson<boolean>(`/concepts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function searchRemoteConcepts(projectId: string, query: string): Promise<Concept[]> {
  return requestJson<Concept[]>(`/concepts/search${toQueryString({ projectId, query })}`);
}

export async function syncRemoteConceptToAgent(conceptId: string): Promise<Concept | null> {
  return requestJson<Concept | null>(`/concepts/${encodeURIComponent(conceptId)}/sync-to-agent`, {
    method: 'POST',
  });
}

export async function syncRemoteConceptFromAgent(conceptId: string, agentContent: string): Promise<Concept | null> {
  return requestJson<Concept | null>(`/concepts/${encodeURIComponent(conceptId)}/sync-from-agent`, {
    method: 'POST',
    body: JSON.stringify({ agentContent }),
  });
}

export async function listRemoteContexts(networkId: string): Promise<Context[]> {
  return requestJson<Context[]>(`/contexts${toQueryString({ networkId })}`);
}

export async function createRemoteContext(data: ContextCreate): Promise<Context> {
  return requestJson<Context>('/contexts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRemoteContext(id: string): Promise<Context | null> {
  return requestJson<Context | null>(`/contexts/${encodeURIComponent(id)}`);
}

export async function updateRemoteContext(id: string, data: ContextUpdate): Promise<Context | null> {
  return requestJson<Context | null>(`/contexts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteContext(id: string): Promise<boolean> {
  return requestJson<boolean>(`/contexts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getRemoteContextMembers(contextId: string): Promise<ContextMember[]> {
  return requestJson<ContextMember[]>(`/contexts/${encodeURIComponent(contextId)}/members`);
}

export async function addRemoteContextMember(
  contextId: string,
  memberType: 'object' | 'edge',
  memberId: string,
): Promise<ContextMember> {
  return requestJson<ContextMember>(`/contexts/${encodeURIComponent(contextId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ memberType, memberId }),
  });
}

export async function removeRemoteContextMember(id: string): Promise<boolean> {
  return requestJson<boolean>(`/context-members/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRemoteFilesByProject(projectId: string): Promise<FileEntity[]> {
  return requestJson<FileEntity[]>(`/files${toQueryString({ projectId })}`);
}

export async function createRemoteFile(data: FileEntityCreate): Promise<FileEntity> {
  return requestJson<FileEntity>('/files', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRemoteFile(id: string): Promise<FileEntity | null> {
  return requestJson<FileEntity | null>(`/files/${encodeURIComponent(id)}`);
}

export async function getRemoteFileByPath(projectId: string, path: string): Promise<FileEntity | null> {
  return requestJson<FileEntity | null>(`/files/by-path${toQueryString({ projectId, path })}`);
}

export async function updateRemoteFile(id: string, data: FileEntityUpdate): Promise<FileEntity | null> {
  return requestJson<FileEntity | null>(`/files/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteFile(id: string): Promise<boolean> {
  return requestJson<boolean>(`/files/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRemoteModules(projectId: string): Promise<Module[]> {
  return requestJson<Module[]>(`/modules${toQueryString({ projectId })}`);
}

export async function createRemoteModule(data: ModuleCreate): Promise<Module> {
  return requestJson<Module>('/modules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRemoteModule(id: string, data: ModuleUpdate): Promise<Module | null> {
  return requestJson<Module | null>(`/modules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteModule(id: string): Promise<boolean> {
  return requestJson<boolean>(`/modules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRemoteModuleDirectories(moduleId: string): Promise<ModuleDirectory[]> {
  return requestJson<ModuleDirectory[]>(`/module-directories${toQueryString({ moduleId })}`);
}

export async function addRemoteModuleDirectory(data: ModuleDirectoryCreate): Promise<ModuleDirectory> {
  return requestJson<ModuleDirectory>('/module-directories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRemoteModuleDirectoryPath(id: string, dirPath: string): Promise<ModuleDirectory | null> {
  return requestJson<ModuleDirectory | null>(`/module-directories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ dirPath }),
  });
}

export async function removeRemoteModuleDirectory(id: string): Promise<boolean> {
  return requestJson<boolean>(`/module-directories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRemoteArchetypes(projectId: string): Promise<Archetype[]> {
  return requestJson<Archetype[]>(`/archetypes${toQueryString({ projectId })}`);
}

export async function createRemoteArchetype(data: ArchetypeCreate): Promise<Archetype> {
  return requestJson<Archetype>('/archetypes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRemoteArchetype(id: string): Promise<Archetype | null> {
  return requestJson<Archetype | null>(`/archetypes/${encodeURIComponent(id)}`);
}

export async function updateRemoteArchetype(id: string, data: ArchetypeUpdate): Promise<Archetype | null> {
  return requestJson<Archetype | null>(`/archetypes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteArchetype(id: string): Promise<boolean> {
  return requestJson<boolean>(`/archetypes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRemoteArchetypeFields(archetypeId: string): Promise<ArchetypeField[]> {
  return requestJson<ArchetypeField[]>(`/archetype-fields${toQueryString({ archetypeId })}`);
}

export async function createRemoteArchetypeField(data: ArchetypeFieldCreate): Promise<ArchetypeField> {
  return requestJson<ArchetypeField>('/archetype-fields', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRemoteArchetypeField(id: string, data: ArchetypeFieldUpdate): Promise<ArchetypeField | null> {
  return requestJson<ArchetypeField | null>(`/archetype-fields/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteArchetypeField(id: string): Promise<boolean> {
  return requestJson<boolean>(`/archetype-fields/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function reorderRemoteArchetypeFields(archetypeId: string, orderedIds: string[]): Promise<boolean> {
  return requestJson<boolean>('/archetype-fields/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ archetypeId, orderedIds }),
  });
}

export async function listRemoteRelationTypes(projectId: string): Promise<RelationType[]> {
  return requestJson<RelationType[]>(`/relation-types${toQueryString({ projectId })}`);
}

export async function createRemoteRelationType(data: RelationTypeCreate): Promise<RelationType> {
  return requestJson<RelationType>('/relation-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRemoteRelationType(id: string): Promise<RelationType | null> {
  return requestJson<RelationType | null>(`/relation-types/${encodeURIComponent(id)}`);
}

export async function updateRemoteRelationType(id: string, data: RelationTypeUpdate): Promise<RelationType | null> {
  return requestJson<RelationType | null>(`/relation-types/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteRelationType(id: string): Promise<boolean> {
  return requestJson<boolean>(`/relation-types/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listRemoteTypeGroups(projectId: string, kind: TypeGroupKind): Promise<TypeGroup[]> {
  return requestJson<TypeGroup[]>(`/type-groups${toQueryString({ projectId, kind })}`);
}

export async function createRemoteTypeGroup(data: TypeGroupCreate): Promise<TypeGroup> {
  return requestJson<TypeGroup>('/type-groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRemoteTypeGroup(id: string, data: TypeGroupUpdate): Promise<TypeGroup | null> {
  return requestJson<TypeGroup | null>(`/type-groups/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteTypeGroup(id: string): Promise<boolean> {
  return requestJson<boolean>(`/type-groups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getRemoteConceptProperties(conceptId: string): Promise<ConceptProperty[]> {
  return requestJson<ConceptProperty[]>(`/concept-properties${toQueryString({ conceptId })}`);
}

export async function upsertRemoteConceptProperty(data: ConceptPropertyUpsert): Promise<ConceptProperty> {
  return requestJson<ConceptProperty>('/concept-properties', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteConceptProperty(id: string): Promise<boolean> {
  return requestJson<boolean>(`/concept-properties/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getRemoteEditorPrefs(conceptId: string): Promise<ConceptEditorPrefs | null> {
  return requestJson<ConceptEditorPrefs | null>(`/editor-prefs/${encodeURIComponent(conceptId)}`);
}

export async function upsertRemoteEditorPrefs(
  conceptId: string,
  data: ConceptEditorPrefsUpdate,
): Promise<ConceptEditorPrefs> {
  return requestJson<ConceptEditorPrefs>(`/editor-prefs/${encodeURIComponent(conceptId)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getRemoteObject(id: string): Promise<ObjectRecord | null> {
  return requestJson<ObjectRecord | null>(`/objects/${encodeURIComponent(id)}`);
}

export async function getRemoteObjectByRef(objectType: NetworkObjectType, refId: string): Promise<ObjectRecord | null> {
  return requestJson<ObjectRecord | null>(`/objects/by-ref${toQueryString({ objectType, refId })}`);
}

export async function listRemoteNetworks(projectId: string, rootOnly?: boolean): Promise<Network[]> {
  return requestJson<Network[]>(`/networks${toQueryString({
    projectId,
    rootOnly: rootOnly == null ? undefined : String(rootOnly),
  })}`);
}

export async function createRemoteNetwork(data: NetworkCreate): Promise<Network> {
  return requestJson<Network>('/networks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRemoteNetwork(id: string, data: NetworkUpdate): Promise<Network | null> {
  return requestJson<Network | null>(`/networks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteNetwork(id: string): Promise<boolean> {
  return requestJson<boolean>(`/networks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getRemoteNetworkFull(networkId: string): Promise<NetworkFullData | null> {
  return requestJson<NetworkFullData | null>(`/networks/${encodeURIComponent(networkId)}/full`);
}

export async function getRemoteAppRootNetwork(): Promise<Network | null> {
  return requestJson<Network | null>('/networks/app-root');
}

export async function getRemoteProjectRootNetwork(projectId: string): Promise<Network | null> {
  return requestJson<Network | null>(`/networks/project-root${toQueryString({ projectId })}`);
}

export async function getRemoteNetworkAncestors(networkId: string): Promise<NetworkBreadcrumbItem[]> {
  return requestJson<NetworkBreadcrumbItem[]>(`/networks/${encodeURIComponent(networkId)}/ancestors`);
}

export async function getRemoteNetworkTree(projectId: string): Promise<NetworkTreeNode[]> {
  return requestJson<NetworkTreeNode[]>(`/networks/tree${toQueryString({ projectId })}`);
}

export async function addRemoteNetworkNode(data: NetworkNodeCreate): Promise<NetworkNode> {
  return requestJson<NetworkNode>('/network-nodes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRemoteNetworkNode(id: string, data: NetworkNodeUpdate): Promise<NetworkNode> {
  return requestJson<NetworkNode>(`/network-nodes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function removeRemoteNetworkNode(id: string): Promise<boolean> {
  return requestJson<boolean>(`/network-nodes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function createRemoteEdge(data: EdgeCreate): Promise<Edge> {
  return requestJson<Edge>('/edges', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRemoteEdge(id: string): Promise<Edge | null> {
  return requestJson<Edge | null>(`/edges/${encodeURIComponent(id)}`);
}

export async function updateRemoteEdge(id: string, data: EdgeUpdate): Promise<Edge | null> {
  return requestJson<Edge | null>(`/edges/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRemoteEdge(id: string): Promise<boolean> {
  return requestJson<boolean>(`/edges/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getRemoteLayoutByNetwork(networkId: string): Promise<Layout | null> {
  return requestJson<Layout | null>(`/layouts/by-network${toQueryString({ networkId })}`);
}

export async function updateRemoteLayout(id: string, data: {
  layout_type?: string;
  layout_config_json?: string | null;
  viewport_json?: string | null;
}): Promise<Layout | null> {
  return requestJson<Layout | null>(`/layouts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getRemoteLayoutNodePositions(layoutId: string): Promise<NodePosition[]> {
  return requestJson<NodePosition[]>(`/layouts/${encodeURIComponent(layoutId)}/nodes`);
}

export async function setRemoteLayoutNodePosition(
  layoutId: string,
  nodeId: string,
  positionJson: string,
): Promise<boolean> {
  return requestJson<boolean>(`/layouts/${encodeURIComponent(layoutId)}/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PUT',
    body: JSON.stringify({ positionJson }),
  });
}

export async function removeRemoteLayoutNodePosition(layoutId: string, nodeId: string): Promise<boolean> {
  return requestJson<boolean>(`/layouts/${encodeURIComponent(layoutId)}/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
  });
}

export async function getRemoteLayoutEdgeVisuals(layoutId: string): Promise<EdgeVisual[]> {
  return requestJson<EdgeVisual[]>(`/layouts/${encodeURIComponent(layoutId)}/edges`);
}

export async function setRemoteLayoutEdgeVisual(
  layoutId: string,
  edgeId: string,
  visualJson: string,
): Promise<boolean> {
  return requestJson<boolean>(`/layouts/${encodeURIComponent(layoutId)}/edges/${encodeURIComponent(edgeId)}`, {
    method: 'PUT',
    body: JSON.stringify({ visualJson }),
  });
}

export async function removeRemoteLayoutEdgeVisual(layoutId: string, edgeId: string): Promise<boolean> {
  return requestJson<boolean>(`/layouts/${encodeURIComponent(layoutId)}/edges/${encodeURIComponent(edgeId)}`, {
    method: 'DELETE',
  });
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getNetiorServiceBaseUrl();
  if (!baseUrl) {
    throw new Error('Netior service is not running');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  let payload: NetiorServiceResponse<T>;
  try {
    payload = await response.json() as NetiorServiceResponse<T>;
  } catch (error) {
    throw new Error(`Invalid JSON from Netior service: ${(error as Error).message}`);
  }

  if (!response.ok) {
    if (!payload.ok) {
      throw new Error(payload.error);
    }
    throw new Error(`Netior service request failed: ${response.status}`);
  }

  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
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
