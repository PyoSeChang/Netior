import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const electronAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  project: {
    create: (data: { name: string; root_dir: string }) =>
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
  },
  canvasNode: {
    add: (data: Record<string, unknown>) => ipcRenderer.invoke('canvasNode:add', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('canvasNode:update', id, data),
    remove: (id: string) => ipcRenderer.invoke('canvasNode:remove', id),
  },
  edge: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('edge:create', data),
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
  editorPrefs: {
    get: (conceptId: string) => ipcRenderer.invoke('editorPrefs:get', conceptId),
    upsert: (conceptId: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('editorPrefs:upsert', conceptId, data),
  },
  fs: {
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', filePath, content),
    openDialog: (options?: Record<string, unknown>) =>
      ipcRenderer.invoke('fs:openDialog', options),
  },
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
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
