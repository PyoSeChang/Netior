import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import {
  addContextMember,
  addModuleDirectory,
  addNetworkNode,
  closeDatabase,
  createSchema,
  createConcept,
  createContext,
  createEdge,
  createField,
  createFileEntity,
  deleteMeaning,
  createModule,
  createNetwork,
  createProject,
  createModel,
  createTypeGroup,
  deleteProject,
  deleteSchema,
  deleteConcept,
  deleteContext,
  deleteEdge,
  deleteField,
  deleteFileEntity,
  deleteModule,
  deleteNetwork,
  deleteProperty,
  deleteModel,
  deleteTypeGroup,
  getContext,
  getContextMembers,
  getSchema,
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
  getNetworkNode,
  getNetworkTree,
  getNodePositions,
  getObject,
  getObjectByRef,
  getProjectOntologyNetwork,
  getProjectById,
  getModel,
  getSetting,
  getUniverseNetwork,
  getDatabase,
  initDatabase,
  listSchemas,
  listContexts,
  listFields,
  listMeanings,
  listModuleDirectories,
  listModules,
  listNetworks,
  listProjects,
  listModels,
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
  updateSchema,
  updateConcept,
  updateContext,
  updateEdge,
  updateField,
  ensureMeaning,
  updateMeaning,
  updateMeaningSlotBinding,
  updateFileEntity,
  updateLayout,
  updateModule,
  updateModuleDirectoryPath,
  updateNetwork,
  updateNetworkNode,
  updateProject,
  updateProjectRootDir,
  updateModel,
  updateTypeGroup,
} from '@netior/core';
import type {
  Schema,
  SchemaCreate,
  SchemaField,
  SchemaFieldCreate,
  SchemaFieldUpdate,
  SchemaMeaningCreate,
  SchemaMeaningSlotBindingUpdate,
  SchemaMeaningUpdate,
  SchemaUpdate,
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
  ModelCreate,
  ModelUpdate,
  TypeGroupCreate,
  TypeGroupKind,
  TypeGroupUpdate,
  NetiorServiceResponse,
  FieldMeaningBindingKey,
  ModelKey,
  FieldMeaningKey,
  MeaningSlotKey,
} from '@netior/shared/types';
import {
  fieldMeaningToMeaningBindings,
  meaningSlotToFieldMeaning,
} from '@netior/shared/constants';

const PORT = parseInt(process.env.PORT ?? process.env.NETIOR_SERVICE_PORT ?? '3201', 10);
const DB_PATH = process.env.NETIOR_SERVICE_DB_PATH;
const EVAL_QUERIES_ENABLED = process.env.NETIOR_SERVICE_ENABLE_EVAL === '1';

if (!DB_PATH) {
  console.error('Error: NETIOR_SERVICE_DB_PATH environment variable is required');
  process.exit(1);
}

initDatabase(DB_PATH);

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

  if (pathname === '/eval/query') {
    if (!EVAL_QUERIES_ENABLED) {
      sendJson(res, 404, { ok: false, error: 'Route not found' });
      return;
    }

    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const body = await readJsonBody<{ sql?: string; params?: unknown[] }>(req);
    const sql = body.sql?.trim();
    if (!sql) {
      sendJson(res, 400, { ok: false, error: 'sql is required' });
      return;
    }

    if (!sql.toLowerCase().startsWith('select')) {
      sendJson(res, 400, { ok: false, error: 'Only SELECT queries are allowed' });
      return;
    }

    const rows = getDatabase()
      .prepare(sql)
      .all(...(body.params ?? [])) as Record<string, unknown>[];

    sendJson(res, 200, { ok: true, data: rows });
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

  if (pathname === '/schemas') {
    if (method === 'GET') {
      const projectId = getRequiredSearchParam(url, 'projectId');
      sendJson(res, 200, { ok: true, data: listSchemas(projectId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<SchemaCreate>(req);
      sendJson(res, 200, { ok: true, data: createSchema(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/schemas/')) {
    const id = decodeURIComponent(pathname.slice('/schemas/'.length));

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getSchema(id) });
      return;
    }

    if (method === 'PATCH') {
      const body = await readJsonBody<SchemaUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateSchema(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteSchema(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/schema-fields/reorder') {
    if (method !== 'PATCH') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const body = await readJsonBody<{ schemaId: string; orderedIds: string[] }>(req);
    reorderFields(body.schemaId, body.orderedIds);
    sendJson(res, 200, { ok: true, data: true });
    return;
  }

  if (pathname === '/schema-fields') {
    if (method === 'GET') {
      const schemaId = getRequiredSearchParam(url, 'schemaId');
      sendJson(res, 200, { ok: true, data: listFields(schemaId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<SchemaFieldCreate>(req);
      sendJson(res, 200, { ok: true, data: createField(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname === '/schema-meanings') {
    if (method === 'GET') {
      const schemaId = getRequiredSearchParam(url, 'schemaId');
      sendJson(res, 200, { ok: true, data: listMeanings(schemaId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<SchemaMeaningCreate>(req);
      sendJson(res, 200, { ok: true, data: ensureMeaning(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/schema-meanings/')) {
    const id = decodeURIComponent(pathname.slice('/schema-meanings/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<SchemaMeaningUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateMeaning(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteMeaning(id) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/schema-meaning-slots/')) {
    const id = decodeURIComponent(pathname.slice('/schema-meaning-slots/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<SchemaMeaningSlotBindingUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateMeaningSlotBinding(id, body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/schema-fields/')) {
    const id = decodeURIComponent(pathname.slice('/schema-fields/'.length));

    if (method === 'PATCH') {
      const body = await readJsonBody<SchemaFieldUpdate>(req);
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

  if (pathname === '/models') {
    if (method === 'GET') {
      const projectId = getRequiredSearchParam(url, 'projectId');
      sendJson(res, 200, { ok: true, data: listModels(projectId) });
      return;
    }

    if (method === 'POST') {
      const body = await readJsonBody<ModelCreate>(req);
      sendJson(res, 200, { ok: true, data: createModel(body) });
      return;
    }

    sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
    return;
  }

  if (pathname.startsWith('/models/')) {
    const id = decodeURIComponent(pathname.slice('/models/'.length));

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getModel(id) });
      return;
    }

    if (method === 'PATCH') {
      const body = await readJsonBody<ModelUpdate>(req);
      sendJson(res, 200, { ok: true, data: updateModel(id, body) });
      return;
    }

    if (method === 'DELETE') {
      sendJson(res, 200, { ok: true, data: deleteModel(id) });
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

  if (pathname === '/networks/universe') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    sendJson(res, 200, { ok: true, data: getUniverseNetwork() });
    return;
  }

  if (pathname === '/networks/ontology') {
    if (method !== 'GET') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const projectId = getRequiredSearchParam(url, 'projectId');
    sendJson(res, 200, { ok: true, data: getProjectOntologyNetwork(projectId) });
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

    if (method === 'GET') {
      sendJson(res, 200, { ok: true, data: getNetworkNode(id) ?? null });
      return;
    }

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

  if (pathname === '/eval/query') {
    if (!EVAL_QUERIES_ENABLED) {
      sendJson(res, 404, { ok: false, error: `Route not found: ${method} ${pathname}` });
      return;
    }

    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, error: `Method ${method} not allowed for ${pathname}` });
      return;
    }

    const body = await readJsonBody<{ sql?: string; params?: unknown[] }>(req);
    const sql = body.sql?.trim();
    if (!sql) {
      sendJson(res, 400, { ok: false, error: 'sql is required' });
      return;
    }
    if (!/^select\b/i.test(sql)) {
      sendJson(res, 400, { ok: false, error: 'Only SELECT statements are allowed for /eval/query' });
      return;
    }

    const rows = getDatabase().prepare(sql).all(...(body.params ?? [])) as Record<string, unknown>[];
    sendJson(res, 200, { ok: true, data: rows });
    return;
  }

  sendJson(res, 404, { ok: false, error: `Route not found: ${method} ${pathname}` });
}

type SchemaRow = Omit<Schema, 'models'> & {
  models: string | null;
};
type SchemaFieldRow = Omit<SchemaField, 'required' | 'slot_binding_locked' | 'generated_by_model' | 'meaning_bindings'> & {
  required: number;
  slot_binding_locked: number;
  generated_by_model?: number;
  meaning_slot?: MeaningSlotKey | null;
  meaning_key?: FieldMeaningKey | null;
};

function parseModels(raw: string | null | undefined): ModelKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is ModelKey => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toSchema(row: SchemaRow): Schema {
  return {
    ...row,
    models: parseModels(row.models),
  };
}

function normalizeMeaningBindings(
  bindings: readonly FieldMeaningBindingKey[] | null | undefined,
  annotation: FieldMeaningKey | null | undefined,
): FieldMeaningBindingKey[] {
  const raw = bindings && bindings.length > 0
    ? bindings
    : fieldMeaningToMeaningBindings(annotation);
  return [...new Set(raw.filter((item): item is FieldMeaningBindingKey => typeof item === 'string' && item.trim().length > 0))];
}

function getFieldMeaningBindingsByFieldId(fieldIds: string[]): Map<string, FieldMeaningBindingKey[]> {
  const byField = new Map<string, FieldMeaningBindingKey[]>();
  if (fieldIds.length === 0) return byField;

  const db = getDatabase();
  const placeholders = fieldIds.map(() => '?').join(',');
  const meaningRows = db.prepare(
    `SELECT field_id, meaning_key FROM field_meaning_bindings WHERE field_id IN (${placeholders}) ORDER BY field_id, sort_order, meaning_key`,
  ).all(...fieldIds) as { field_id: string; meaning_key: string }[];
  const rows = meaningRows.length > 0
    ? meaningRows.map((row) => ({ field_id: row.field_id, meaning_key: row.meaning_key }))
    : [];

  for (const row of rows) {
    const current = byField.get(row.field_id) ?? [];
    current.push(row.meaning_key as FieldMeaningBindingKey);
    byField.set(row.field_id, current);
  }
  return byField;
}

function toSchemaField(row: SchemaFieldRow, meaningBindings?: readonly FieldMeaningBindingKey[]): SchemaField {
  const fieldMeaning = row.meaning_key ?? meaningSlotToFieldMeaning(row.meaning_slot);
  const bindings = normalizeMeaningBindings(meaningBindings, fieldMeaning);
  const generatedByModel = Boolean(row.generated_by_model);
  const {
    meaning_slot: _meaningSlot,
    meaning_key: _meaningKey,
    generated_by_model: _generatedByModel,
    ...field
  } = row;

  return {
    ...field,
    meaning_bindings: bindings,
    required: !!row.required,
    slot_binding_locked: !!row.slot_binding_locked,
    generated_by_model: generatedByModel,
  };
}

function loadConceptContentData(conceptId: string): {
  concept: Concept;
  schema: Schema | null;
  fields: SchemaField[];
  properties: Record<string, string | null>;
} | null {
  const db = getDatabase();
  const concept = db.prepare('SELECT * FROM concepts WHERE id = ?').get(conceptId) as Concept | undefined;
  if (!concept) {
    return null;
  }

  let schema: Schema | null = null;
  let fields: SchemaField[] = [];
  const properties: Record<string, string | null> = {};

  if (concept.schema_id) {
    const schemaRow = db.prepare('SELECT * FROM schemas WHERE id = ?').get(concept.schema_id) as SchemaRow | null;
    schema = schemaRow ? toSchema(schemaRow) : null;
    if (schema) {
      const rows = db.prepare('SELECT * FROM schema_fields WHERE schema_id = ? ORDER BY sort_order')
        .all(schema.id) as SchemaFieldRow[];
      const bindingsByFieldId = getFieldMeaningBindingsByFieldId(rows.map((row) => row.id));
      fields = rows.map((row) => toSchemaField(row, bindingsByFieldId.get(row.id)));
    }

    const props = db.prepare('SELECT * FROM concept_properties WHERE concept_id = ?')
      .all(conceptId) as ConceptProperty[];

    for (const field of fields) {
      const prop = props.find((entry) => entry.field_id === field.id);
      properties[field.name] = prop?.value ?? null;
    }
  }

  return { concept, schema, fields, properties };
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
  payload: NetiorServiceResponse<unknown>,
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
