import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const electronAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  project: {
    create: (data: { name: string; root_dir?: string }) =>
      ipcRenderer.invoke('project:create', data),
    list: () => ipcRenderer.invoke('project:list'),
    delete: (id: string) => ipcRenderer.invoke('project:delete', id),
  },
  concept: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('concept:create', data),
    getByProject: (projectId: string) => ipcRenderer.invoke('concept:getByProject', projectId),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('concept:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('concept:delete', id),
  },
  canvas: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('canvas:create', data),
    list: (projectId: string, rootOnly?: boolean) =>
      ipcRenderer.invoke('canvas:list', projectId, rootOnly),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('canvas:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('canvas:delete', id),
    getFull: (canvasId: string) => ipcRenderer.invoke('canvas:getFull', canvasId),
    getByConcept: (conceptId: string) => ipcRenderer.invoke('canvas:getByConcept', conceptId),
    getAncestors: (canvasId: string) => ipcRenderer.invoke('canvas:getAncestors', canvasId),
    getTree: (projectId: string) => ipcRenderer.invoke('canvas:getTree', projectId),
  },
  canvasNode: {
    add: (data: Record<string, unknown>) => ipcRenderer.invoke('canvasNode:add', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('canvasNode:update', id, data),
    remove: (id: string) => ipcRenderer.invoke('canvasNode:remove', id),
  },
  edge: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('edge:create', data),
    get: (id: string) => ipcRenderer.invoke('edge:get', id),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('edge:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('edge:delete', id),
  },
  conceptFile: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('conceptFile:create', data),
    getByConcept: (conceptId: string) => ipcRenderer.invoke('conceptFile:getByConcept', conceptId),
    delete: (id: string) => ipcRenderer.invoke('conceptFile:delete', id),
  },
  module: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('module:create', data),
    list: (projectId: string) => ipcRenderer.invoke('module:list', projectId),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('module:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('module:delete', id),
  },
  moduleDir: {
    add: (data: Record<string, unknown>) => ipcRenderer.invoke('moduleDir:add', data),
    list: (moduleId: string) => ipcRenderer.invoke('moduleDir:list', moduleId),
    remove: (id: string) => ipcRenderer.invoke('moduleDir:remove', id),
  },
  archetype: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('archetype:create', data),
    list: (projectId: string) => ipcRenderer.invoke('archetype:list', projectId),
    get: (id: string) => ipcRenderer.invoke('archetype:get', id),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('archetype:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('archetype:delete', id),
    createField: (data: Record<string, unknown>) => ipcRenderer.invoke('archetypeField:create', data),
    listFields: (archetypeId: string) => ipcRenderer.invoke('archetypeField:list', archetypeId),
    updateField: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('archetypeField:update', id, data),
    deleteField: (id: string) => ipcRenderer.invoke('archetypeField:delete', id),
    reorderFields: (archetypeId: string, orderedIds: string[]) =>
      ipcRenderer.invoke('archetypeField:reorder', archetypeId, orderedIds),
  },
  canvasType: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('canvasType:create', data),
    list: (projectId: string) => ipcRenderer.invoke('canvasType:list', projectId),
    get: (id: string) => ipcRenderer.invoke('canvasType:get', id),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('canvasType:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('canvasType:delete', id),
    addRelation: (canvasTypeId: string, relationTypeId: string) =>
      ipcRenderer.invoke('canvasType:addRelation', canvasTypeId, relationTypeId),
    removeRelation: (canvasTypeId: string, relationTypeId: string) =>
      ipcRenderer.invoke('canvasType:removeRelation', canvasTypeId, relationTypeId),
    listRelations: (canvasTypeId: string) => ipcRenderer.invoke('canvasType:listRelations', canvasTypeId),
  },
  relationType: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('relationType:create', data),
    list: (projectId: string) => ipcRenderer.invoke('relationType:list', projectId),
    get: (id: string) => ipcRenderer.invoke('relationType:get', id),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('relationType:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('relationType:delete', id),
  },
  conceptProp: {
    upsert: (data: Record<string, unknown>) => ipcRenderer.invoke('conceptProp:upsert', data),
    getByConcept: (conceptId: string) => ipcRenderer.invoke('conceptProp:getByConcept', conceptId),
    delete: (id: string) => ipcRenderer.invoke('conceptProp:delete', id),
  },
  conceptContent: {
    syncToAgent: (conceptId: string) => ipcRenderer.invoke('concept:syncToAgent', conceptId),
    syncFromAgent: (conceptId: string, agentContent: string) =>
      ipcRenderer.invoke('concept:syncFromAgent', conceptId, agentContent),
  },
  editorPrefs: {
    get: (conceptId: string) => ipcRenderer.invoke('editorPrefs:get', conceptId),
    upsert: (conceptId: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('editorPrefs:upsert', conceptId, data),
  },
  fs: {
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    readDirShallow: (dirPath: string, depth?: number) => ipcRenderer.invoke('fs:readDirShallow', dirPath, depth),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', filePath, content),
    openDialog: (options?: Record<string, unknown>) =>
      ipcRenderer.invoke('fs:openDialog', options),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('fs:rename', oldPath, newPath),
    delete: (targetPath: string) => ipcRenderer.invoke('fs:delete', targetPath),
    createFile: (filePath: string) => ipcRenderer.invoke('fs:createFile', filePath),
    createDir: (dirPath: string) => ipcRenderer.invoke('fs:createDir', dirPath),
    copy: (src: string, dest: string) => ipcRenderer.invoke('fs:copy', src, dest),
    move: (src: string, dest: string) => ipcRenderer.invoke('fs:move', src, dest),
    showInExplorer: (targetPath: string) => ipcRenderer.invoke('fs:showInExplorer', targetPath),
    exists: (targetPath: string) => ipcRenderer.invoke('fs:exists', targetPath),
  },
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
  },
  terminal: {
    spawn: (sessionId: string, cwd: string) => ipcRenderer.invoke('pty:spawn', sessionId, cwd),
    input: (sessionId: string, data: string) => ipcRenderer.send('pty:input', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send('pty:resize', sessionId, cols, rows),
    kill: (sessionId: string) => ipcRenderer.invoke('pty:kill', sessionId),
    onOutput: (callback: (sessionId: string, data: string) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { sessionId: string; data: string }) =>
        callback(payload.sessionId, payload.data);
      ipcRenderer.on('pty:output', handler);
      return () => { ipcRenderer.removeListener('pty:output', handler); };
    },
    onExit: (callback: (sessionId: string, exitCode: number) => void) => {
      const handler = (_event: IpcRendererEvent, payload: { sessionId: string; exitCode: number }) =>
        callback(payload.sessionId, payload.exitCode);
      ipcRenderer.on('pty:exit', handler);
      return () => { ipcRenderer.removeListener('pty:exit', handler); };
    },
  },
  editor: {
    detach: (tabId: string, title: string) => ipcRenderer.invoke('editor:detach', tabId, title),
    reattach: (tabId: string, mode: string) => ipcRenderer.send('editor:reattach', tabId, mode),
    onDetachedClosed: (callback: (tabId: string) => void) => {
      const handler = (_event: IpcRendererEvent, tabId: string) => callback(tabId);
      ipcRenderer.on('editor:detached-closed', handler);
      return () => { ipcRenderer.removeListener('editor:detached-closed', handler); };
    },
    onReattachToMode: (callback: (tabId: string, mode: string) => void) => {
      const handler = (_event: IpcRendererEvent, tabId: string, mode: string) => callback(tabId, mode);
      ipcRenderer.on('editor:reattach-to-mode', handler);
      return () => { ipcRenderer.removeListener('editor:reattach-to-mode', handler); };
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);

export type ElectronAPI = typeof electronAPI;
