import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import {
  addContextMember,
  addModuleDirectory,
  addNetworkNode,
  closeDatabase,
  createArchetype,
  createConcept,
  createContext,
  createEdge,
  createField,
  createFileEntity,
  createModule,
  createNetwork,
  createProject,
  createRelationType,
  createTypeGroup,
  deleteProject,
  deleteArchetype,
  deleteConcept,
  deleteContext,
  deleteEdge,
  deleteField,
  deleteFileEntity,
  deleteModule,
  deleteNetwork,
  deleteProperty,
  deleteRelationType,
  deleteTypeGroup,
  getContext,
  getContextMembers,
  getAppRootNetwork,
  getArchetype,
  getByConceptId,
  getConceptsByProject,
  getEditorPrefs,
  getEdge,
  getEdgeVisuals,
  getFileEntitiesByProject,
  getFileEntity,
  getFileEntityByPath,
  getLayoutByNetwork,
  getNetworkAncestors,
  getNetworkFull,
  getNetworkTree,
  getNodePositions,
  getObject,
  getObjectByRef,
  getProjectRootNetwork,
  getProjectById,
  getRelationType,
  getSetting,
  getDatabase,
  initDatabase,
  listArchetypes,
  listContexts,
  listFields,
  listModuleDirectories,
  listModules,
  listNetworks,
  listProjects,
  listRelationTypes,
  listTypeGroups,
  parseFromAgent,
  removeEdgeVisual,
  removeContextMember,
  removeModuleDirectory,
  removeNetworkNode,
  removeNodePosition,
  reorderFields,
  searchConcepts,
  serializeToAgent,
  setEdgeVisual,
  setNodePosition,
  setSetting,
  upsertEditorPrefs,
  upsertProperty,
  updateArchetype,
  updateConcept,
  updateContext,
  updateEdge,
  updateField,
  updateFileEntity,
  updateLayout,
  updateModule,
  updateModuleDirectoryPath,
  updateNetwork,
  updateNetworkNode,
  updateProject,
  updateProjectRootDir,
  updateRelationType,
  updateTypeGroup,
} from '@netior/core';
import type {
  Archetype,
  ArchetypeCreate,
  ArchetypeField,
  ArchetypeFieldCreate,
  ArchetypeFieldUpdate,
  ArchetypeUpdate,
  Concept,
  ConceptEditorPrefsUpdate,
  ConceptCreate,
  ConceptProperty,
  ConceptPropertyUpsert,
  ConceptUpdate,
  ContextCreate,
  ContextUpdate,
  EdgeCreate,
  EdgeUpdate,
  FileEntityCreate,
  FileEntityUpdate,
  LayoutUpdate,
  ModuleCreate,
  ModuleDirectoryCreate,
  ModuleUpdate,
  NetworkObjectType,
  NetworkCreate,
  NetworkNodeCreate,
  NetworkNodeUpdate,
  NetworkUpdate,
  ProjectCreate,
  ProjectUpdate,
  RelationTypeCreate,
  RelationTypeUpdate,
  TypeGroupCreate,
  TypeGroupKind,
  TypeGroupUpdate,
} from '@netior/shared/types';

const PORT = parseInt(process.env.PORT ?? process.env.NETIOR_SERVICE_PORT ?? '3201', 10);
const DB_PATH = process.env.NETIOR_SERVICE_DB_PATH;
const NATIVE_BINDING = process.env.NETIOR_SERVICE_NATIVE_BINDING;

if (!DB_PATH) {
  console.error('Error: NETIOR_SERVICE_DB_PATH environment variable is required');
  process.exit(1);
}

initDatabase(DB_PATH, NATIVE_BINDING ? { nativeBinding: NATIVE_BINDING } : undefined);

const server = createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    console.error('[netior-service] Unhandled request error:', error);
    sendJson(res, 500, { ok: false, error: (error as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`[netior-service] Listening on port ${PORT}`);
  console.log(`[netior-service] DB path: ${DB_PATH}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    closeDatabase();
    server.close(() => process.exit(0));
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      data: {
        status: 'ok',
        pid: process.pid,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (pathname.startsWith('/config/')) {
    const key = decodeURIComponent(pathname.slice('/config/'.length));
    if (!key) {
      sendJson(res, 400, { ok: false, error: 'config key is required' });
      return;
    }

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getSetting(key) ?? null });
      return;
    }

    if (method === 'PUT') {
      const body = await readJsonBody<{ value: unknown }>(req);
      setSetting(key, typeof body.value === 'string' ? body.value : JSON.stringify(body.value));
      sendJson(res, 200, { ok: true, data: true });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/concepts/search') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const projectId = getRequiredSearchParam(url, 'projectId');
    const query = url.searchParams.get('query') ?? '';
    sendJson(res, 200, { ok: true, data: searchConcepts(projectId, query) });
    return;
  }

  if (pathname === '/concepts') {
    if (method === 'GET') {
      const projectId = getRequiredSearchParam(url, 'projectId');
      sendJson(res, 200, { ok: true, data: getConceptsByProject(projectId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<ConceptCreate>(req);
      sendJson(res, 200, { ok: true, data: createConcept(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  const conceptSyncToAgentMatch = pathname.match(/^\/concepts\/([^/]+)\/sync-to-agent$/);
  if (conceptSyncToAgentMatch) {
    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const conceptId = decodeURIComponent(conceptSyncToAgentMatch[1]);
    const data = loadConceptContentData(conceptId);
    if (!data) {
      sendJson(res, 404, { ok: false, error: 'Concept not found' });
      return;
    }

    const agentContent = serializeToAgent(data);
    sendJson(res, 200, { ok: true, data: updateConcept(conceptId, { agent_content: agentContent }) });
    return;
  }

  const conceptSyncFromAgentMatch = pathname.match(/^\/concepts\/([^/]+)\/sync-from-agent$/);
  if (conceptSyncFromAgentMatch) {
    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const conceptId = decodeURIComponent(conceptSyncFromAgentMatch[1]);
    const body = await readJsonBody<{ agentContent: string }>(req);
    const data = loadConceptContentData(conceptId);
    if (!data) {
      sendJson(res, 404, { ok: false, error: 'Concept not found' });
      return;
    }

    const parsed = parseFromAgent(body.agentContent, data.fields);

    for (const [fieldId, value] of Object.entries(parsed.properties)) {
      upsertProperty({ concept_id: conceptId, field_id: fieldId, value });
    }

    const updateData: Record<string, string | null | undefined> = { content: parsed.content };
    if (parsed.title) {
      updateData.title = parsed.title;
    }

    updateConcept(conceptId, updateData);

    const refreshed = loadConceptContentData(conceptId);
    if (refreshed) {
      const normalized = serializeToAgent(refreshed);
      updateConcept(conceptId, { agent_content: normalized });
    }

    const db = getDatabase();
    sendJson(res, 200, {
      ok: true,
      data: db.prepare('SELECT * FROM concepts WHERE id = ?').get(conceptId),
    });
    return;
  }

  if (pathname.startsWith('/concepts/')) {
    const id = decodeURIComponent(pathname.slice('/concepts/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<ConceptUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateConcept(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteConcept(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/archetypes') {
    if (method === 'GET') {
      const projectId = getRequiredSearchParam(url, 'projectId');
      sendJson(res, 200, { ok: true, data: listArchetypes(projectId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<ArchetypeCreate>(req);
      sendJson(res, 200, { ok: true, data: createArchetype(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/archetypes/')) {
    const id = decodeURIComponent(pathname.slice('/archetypes/'.length));

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getArchetype(id) });
      return;
    }

    if (method === 'PATCH') {
      const body = await readJsonBody<ArchetypeUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateArchetype(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteArchetype(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/archetype-fields/reorder') {
    if (method !== 'PATCH') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const body = await readJsonBody<{ archetypeId: string; orderedIds: string[] }>(req);
    reorderFields(body.archetypeId, body.orderedIds);
    sendJson(res, 200, { ok: true, data: true });
    return;
  }

  if (pathname === '/archetype-fields') {
    if (method === 'GET') {
      const archetypeId = getRequiredSearchParam(url, 'archetypeId');
      sendJson(res, 200, { ok: true, data: listFields(archetypeId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<ArchetypeFieldCreate>(req);
      sendJson(res, 200, { ok: true, data: createField(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/archetype-fields/')) {
    const id = decodeURIComponent(pathname.slice('/archetype-fields/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<ArchetypeFieldUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateField(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteField(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/relation-types') {
    if (method === 'GET') {
      const projectId = getRequiredSearchParam(url, 'projectId');
      sendJson(res, 200, { ok: true, data: listRelationTypes(projectId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<RelationTypeCreate>(req);
      sendJson(res, 200, { ok: true, data: createRelationType(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/relation-types/')) {
    const id = decodeURIComponent(pathname.slice('/relation-types/'.length));

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getRelationType(id) });
      return;
    }

    if (method === 'PATCH') {
      const body = await readJsonBody<RelationTypeUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateRelationType(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteRelationType(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/type-groups') {
    if (method === 'GET') {
      const projectId = getRequiredSearchParam(url, 'projectId');
      const kind = getRequiredSearchParam(url, 'kind') as TypeGroupKind;
      sendJson(res, 200, { ok: true, data: listTypeGroups(projectId, kind) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<TypeGroupCreate>(req);
      sendJson(res, 200, { ok: true, data: createTypeGroup(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/type-groups/')) {
    const id = decodeURIComponent(pathname.slice('/type-groups/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<TypeGroupUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateTypeGroup(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteTypeGroup(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/concept-properties') {
    if (method === 'GET') {
      const conceptId = getRequiredSearchParam(url, 'conceptId');
      sendJson(res, 200, { ok: true, data: getByConceptId(conceptId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<ConceptPropertyUpsert>(req);
      sendJson(res, 200, { ok: true, data: upsertProperty(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/concept-properties/')) {
    const id = decodeURIComponent(pathname.slice('/concept-properties/'.length));

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteProperty(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/editor-prefs/')) {
    const conceptId = decodeURIComponent(pathname.slice('/editor-prefs/'.length));

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getEditorPrefs(conceptId) });
      return;
    }

    if (method === 'PUT') {
      const body = await readJsonBody<ConceptEditorPrefsUpdate>(req);
      sendJson(res, 200, { ok: true, data: upsertEditorPrefs(conceptId, body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/objects/by-ref') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const objectType = getRequiredSearchParam(url, 'objectType') as NetworkObjectType;
    const refId = getRequiredSearchParam(url, 'refId');
    sendJson(res, 200, { ok: true, data: getObjectByRef(objectType, refId) });
    return;
  }

  if (pathname.startsWith('/objects/')) {
    const id = decodeURIComponent(pathname.slice('/objects/'.length));

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getObject(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/contexts') {
    if (method === 'GET') {
      const networkId = getRequiredSearchParam(url, 'networkId');
      sendJson(res, 200, { ok: true, data: listContexts(networkId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<ContextCreate>(req);
      sendJson(res, 200, { ok: true, data: createContext(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  const contextMembersMatch = pathname.match(/^\/contexts\/([^/]+)\/members$/);
  if (contextMembersMatch) {
    const contextId = decodeURIComponent(contextMembersMatch[1]);

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getContextMembers(contextId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<{ memberType: 'object' | 'edge'; memberId: string }>(req);
      sendJson(res, 200, { ok: true, data: addContextMember(contextId, body.memberType, body.memberId) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/contexts/')) {
    const id = decodeURIComponent(pathname.slice('/contexts/'.length));

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getContext(id) });
      return;
    }

    if (method === 'PATCH') {
      const body = await readJsonBody<ContextUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateContext(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteContext(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/context-members/')) {
    const id = decodeURIComponent(pathname.slice('/context-members/'.length));

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: removeContextMember(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/files/by-path') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const projectId = getRequiredSearchParam(url, 'projectId');
    const filePath = getRequiredSearchParam(url, 'path');
    sendJson(res, 200, { ok: true, data: getFileEntityByPath(projectId, filePath) });
    return;
  }

  if (pathname === '/files') {
    if (method === 'GET') {
      const projectId = getRequiredSearchParam(url, 'projectId');
      sendJson(res, 200, { ok: true, data: getFileEntitiesByProject(projectId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<FileEntityCreate>(req);
      sendJson(res, 200, { ok: true, data: createFileEntity(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/files/')) {
    const id = decodeURIComponent(pathname.slice('/files/'.length));

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getFileEntity(id) });
      return;
    }

    if (method === 'PATCH') {
      const body = await readJsonBody<FileEntityUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateFileEntity(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteFileEntity(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/modules') {
    if (method === 'GET') {
      const projectId = getRequiredSearchParam(url, 'projectId');
      sendJson(res, 200, { ok: true, data: listModules(projectId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<ModuleCreate>(req);
      sendJson(res, 200, { ok: true, data: createModule(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/modules/')) {
    const id = decodeURIComponent(pathname.slice('/modules/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<ModuleUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateModule(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteModule(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/module-directories') {
    if (method === 'GET') {
      const moduleId = getRequiredSearchParam(url, 'moduleId');
      sendJson(res, 200, { ok: true, data: listModuleDirectories(moduleId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<ModuleDirectoryCreate>(req);
      sendJson(res, 200, { ok: true, data: addModuleDirectory(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/module-directories/')) {
    const id = decodeURIComponent(pathname.slice('/module-directories/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<{ dirPath: string }>(req);
      sendJson(res, 200, { ok: true, data: updateModuleDirectoryPath(id, body.dirPath) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: removeModuleDirectory(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/projects') {
    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: listProjects() });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<ProjectCreate>(req);
      sendJson(res, 200, { ok: true, data: createProject(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/projects/')) {
    const suffix = pathname.slice('/projects/'.length);
    const rootDirSuffix = '/root-dir';

    if (suffix.endsWith(rootDirSuffix)) {
      const id = decodeURIComponent(suffix.slice(0, -rootDirSuffix.length));
      if (method !== 'PATCH') {
        sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
        return;
      }

      const body = await readJsonBody<{ rootDir: string }>(req);
      sendJson(res, 200, { ok: true, data: updateProjectRootDir(id, body.rootDir) });
      return;
    }

    const id = decodeURIComponent(suffix);

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getProjectById(id) });
      return;
    }

    if (method === 'PATCH') {
      const body = await readJsonBody<ProjectUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateProject(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteProject(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/networks/app-root') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    sendJson(res, 200, { ok: true, data: getAppRootNetwork() });
    return;
  }

  if (pathname === '/networks/project-root') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const projectId = getRequiredSearchParam(url, 'projectId');
    sendJson(res, 200, { ok: true, data: getProjectRootNetwork(projectId) });
    return;
  }

  if (pathname === '/networks/tree') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const projectId = getRequiredSearchParam(url, 'projectId');
    sendJson(res, 200, { ok: true, data: getNetworkTree(projectId) });
    return;
  }

  if (pathname === '/networks') {
    if (method === 'GET') {
      const projectId = getRequiredSearchParam(url, 'projectId');
      const rootOnly = parseOptionalBoolean(url.searchParams.get('rootOnly')) ?? false;
      sendJson(res, 200, { ok: true, data: listNetworks(projectId, rootOnly) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<NetworkCreate>(req);
      sendJson(res, 200, { ok: true, data: createNetwork(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  const networkFullMatch = pathname.match(/^\/networks\/([^/]+)\/full$/);
  if (networkFullMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const networkId = decodeURIComponent(networkFullMatch[1]);
    sendJson(res, 200, { ok: true, data: getNetworkFull(networkId) });
    return;
  }

  const networkAncestorsMatch = pathname.match(/^\/networks\/([^/]+)\/ancestors$/);
  if (networkAncestorsMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const networkId = decodeURIComponent(networkAncestorsMatch[1]);
    sendJson(res, 200, { ok: true, data: getNetworkAncestors(networkId) });
    return;
  }

  if (pathname.startsWith('/networks/')) {
    const id = decodeURIComponent(pathname.slice('/networks/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<NetworkUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateNetwork(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteNetwork(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/network-nodes') {
    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const body = await readJsonBody<NetworkNodeCreate>(req);
    sendJson(res, 200, { ok: true, data: addNetworkNode(body) });
    return;
  }

  if (pathname.startsWith('/network-nodes/')) {
    const id = decodeURIComponent(pathname.slice('/network-nodes/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<NetworkNodeUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateNetworkNode(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: removeNetworkNode(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/edges') {
    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const body = await readJsonBody<EdgeCreate>(req);
    sendJson(res, 200, { ok: true, data: createEdge(body) });
    return;
  }

  if (pathname.startsWith('/edges/')) {
    const id = decodeURIComponent(pathname.slice('/edges/'.length));

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getEdge(id) });
      return;
    }

    if (method === 'PATCH') {
      const body = await readJsonBody<EdgeUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateEdge(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteEdge(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/layouts/by-network') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const networkId = getRequiredSearchParam(url, 'networkId');
    sendJson(res, 200, { ok: true, data: getLayoutByNetwork(networkId) });
    return;
  }

  const layoutNodesMatch = pathname.match(/^\/layouts\/([^/]+)\/nodes$/);
  if (layoutNodesMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const layoutId = decodeURIComponent(layoutNodesMatch[1]);
    sendJson(res, 200, { ok: true, data: getNodePositions(layoutId) });
    return;
  }

  const layoutNodeMatch = pathname.match(/^\/layouts\/([^/]+)\/nodes\/([^/]+)$/);
  if (layoutNodeMatch) {
    const layoutId = decodeURIComponent(layoutNodeMatch[1]);
    const nodeId = decodeURIComponent(layoutNodeMatch[2]);

    if (method === 'PUT') {
      const body = await readJsonBody<{ positionJson: string }>(req);
      setNodePosition(layoutId, nodeId, body.positionJson);
      sendJson(res, 200, { ok: true, data: true });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: removeNodePosition(layoutId, nodeId) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  const layoutEdgesMatch = pathname.match(/^\/layouts\/([^/]+)\/edges$/);
  if (layoutEdgesMatch) {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const layoutId = decodeURIComponent(layoutEdgesMatch[1]);
    sendJson(res, 200, { ok: true, data: getEdgeVisuals(layoutId) });
    return;
  }

  const layoutEdgeMatch = pathname.match(/^\/layouts\/([^/]+)\/edges\/([^/]+)$/);
  if (layoutEdgeMatch) {
    const layoutId = decodeURIComponent(layoutEdgeMatch[1]);
    const edgeId = decodeURIComponent(layoutEdgeMatch[2]);

    if (method === 'PUT') {
      const body = await readJsonBody<{ visualJson: string }>(req);
      setEdgeVisual(layoutId, edgeId, body.visualJson);
      sendJson(res, 200, { ok: true, data: true });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: removeEdgeVisual(layoutId, edgeId) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/layouts/')) {
    const id = decodeURIComponent(pathname.slice('/layouts/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<LayoutUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateLayout(id, body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  sendJson(res, 404, { ok: false, error: `Route not found: ${method} ${pathname}` });
}

type ArchetypeFieldRow = Omit<ArchetypeField, 'required'> & { required: number };

function loadConceptContentData(conceptId: string): {
  concept: Concept;
  archetype: Archetype | null;
  fields: ArchetypeField[];
  properties: Record<string, string | null>;
} | null {
  const db = getDatabase();
  const concept = db.prepare('SELECT * FROM concepts WHERE id = ?').get(conceptId) as Concept | undefined;
  if (!concept) {
    return null;
  }

  let archetype: Archetype | null = null;
  let fields: ArchetypeField[] = [];
  const properties: Record<string, string | null> = {};

  if (concept.archetype_id) {
    archetype = db.prepare('SELECT * FROM archetypes WHERE id = ?').get(concept.archetype_id) as Archetype | null;
    if (archetype) {
      const rows = db.prepare('SELECT * FROM archetype_fields WHERE archetype_id = ? ORDER BY sort_order')
        .all(archetype.id) as ArchetypeFieldRow[];
      fields = rows.map((row) => ({ ...row, required: !!row.required }));
    }

    const props = db.prepare('SELECT * FROM concept_properties WHERE concept_id = ?')
      .all(conceptId) as ConceptProperty[];

    for (const field of fields) {
      const prop = props.find((entry) => entry.field_id === field.id);
      properties[field.name] = prop?.value ?? null;
    }
  }

  return { concept, archetype, fields, properties };
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Invalid JSON body: ${(error as Error).message}`);
  }
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: { ok: true; data: unknown } | { ok: false; error: string },
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function getRequiredSearchParam(url: URL, key: string): string {
  const value = url.searchParams.get(key);
  if (!value) {
    throw new Error(`${key} query parameter is required`);
  }
  return value;
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value == null) {
    return undefined;
  }

  return value === 'true' || value === '1';
}
