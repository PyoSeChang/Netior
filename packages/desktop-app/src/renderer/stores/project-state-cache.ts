import { useNetworkStore, type NetworkNodeWithObject, type EdgeWithRelationType } from './network-store';
import { useEditorStore } from './editor-store';
import { useModuleStore } from './module-store';
import { useConceptStore } from './concept-store';
import { useSchemaStore } from './schema-store';
import { useModelStore } from './model-store';
import { useTypeGroupStore } from './type-group-store';
import { useFileStore, type OpenFile, type ClipboardAction, type ClipboardState } from './file-store';
import type {
  Network, NetworkNode, Edge, Concept, Model,
  NetworkBreadcrumbItem, NetworkTreeNode,
  EditorTab, SplitNode,
  Module, ModuleDirectory,
  ConceptProperty,
  Schema, SchemaField,
  TypeGroup,
  FileTreeNode,
} from '@netior/shared/types';

interface NetworkSnapshot {
  networks: Network[];
  currentNetwork: Network | null;
  nodes: NetworkNodeWithObject[];
  edges: EdgeWithRelationType[];
  breadcrumbs: NetworkBreadcrumbItem[];
  networkHistory: string[];
  networkTree: NetworkTreeNode[];
}

interface EditorSnapshot {
  tabs: EditorTab[];
  activeTabId: string | null;
  sideLayout: SplitNode | null;
  fullLayout: SplitNode | null;
  sideLastActiveTabId: string | null;
  fullLastActiveTabId: string | null;
  hosts: Record<string, { id: string; label: string; activeTabId: string | null }>;
  focusedHostId: string;
}

interface ModuleSnapshot {
  modules: Module[];
  activeModuleId: string | null;
  directories: ModuleDirectory[];
}

interface ConceptSnapshot {
  concepts: Concept[];
  properties: Record<string, ConceptProperty[]>;
}

interface SchemaSnapshot {
  schemas: Schema[];
  fields: Record<string, SchemaField[]>;
}

interface ModelSnapshot {
  models: Model[];
  loading: boolean;
}

interface TypeGroupSnapshot {
  groupsByKind: {
    schema: TypeGroup[];
  };
}

interface FileSnapshot {
  fileTree: FileTreeNode[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  clipboard: ClipboardState | null;
  rootDirs: string[];
}

interface WorkspaceSnapshot {
  network: NetworkSnapshot;
  editor: EditorSnapshot;
  module: ModuleSnapshot;
  concept: ConceptSnapshot;
  schema: SchemaSnapshot;
  model: ModelSnapshot;
  typeGroup: TypeGroupSnapshot;
  file: FileSnapshot;
}

const APP_WORKSPACE_CACHE_KEY = '__app__';
const cache = new Map<string, WorkspaceSnapshot>();

function containsTab(node: SplitNode | null, tabId: string): boolean {
  if (!node) return false;
  if (node.type === 'leaf') return node.tabIds.includes(tabId);
  return containsTab(node.children[0], tabId) || containsTab(node.children[1], tabId);
}

function setActiveInLeaf(node: SplitNode, tabId: string): SplitNode {
  if (node.type === 'leaf') {
    if (!node.tabIds.includes(tabId)) return node;
    return node.activeTabId === tabId ? node : { ...node, activeTabId: tabId };
  }

  const newLeft = setActiveInLeaf(node.children[0], tabId);
  const newRight = setActiveInLeaf(node.children[1], tabId);
  if (newLeft === node.children[0] && newRight === node.children[1]) return node;
  return { ...node, children: [newLeft, newRight] };
}

function normalizeEditorSnapshot(editor: EditorSnapshot): EditorSnapshot {
  return {
    ...editor,
    sideLastActiveTabId: editor.sideLastActiveTabId ?? null,
    fullLastActiveTabId: editor.fullLastActiveTabId ?? null,
    hosts: editor.hosts ?? {},
    focusedHostId: editor.focusedHostId ?? 'main',
  };
}

function capture(): WorkspaceSnapshot {
  const network = useNetworkStore.getState();
  const editor = useEditorStore.getState();
  const module = useModuleStore.getState();
  const concept = useConceptStore.getState();
  const schema = useSchemaStore.getState();
  const model = useModelStore.getState();
  const typeGroup = useTypeGroupStore.getState();
  const file = useFileStore.getState();

  return {
    network: {
      networks: network.networks,
      currentNetwork: network.currentNetwork,
      nodes: network.nodes,
      edges: network.edges,
      breadcrumbs: network.breadcrumbs,
      networkHistory: network.networkHistory,
      networkTree: network.networkTree,
    },
    editor: {
      tabs: editor.tabs,
      activeTabId: editor.activeTabId,
      sideLayout: editor.sideLayout,
      fullLayout: editor.fullLayout,
      sideLastActiveTabId: editor.sideLastActiveTabId,
      fullLastActiveTabId: editor.fullLastActiveTabId,
      hosts: editor.hosts,
      focusedHostId: editor.focusedHostId,
    },
    module: {
      modules: module.modules,
      activeModuleId: module.activeModuleId,
      directories: module.directories,
    },
    concept: {
      concepts: concept.concepts,
      properties: concept.properties,
    },
    schema: {
      schemas: schema.schemas,
      fields: schema.fields,
    },
    model: {
      models: model.models,
      loading: model.loading,
    },
    typeGroup: {
      groupsByKind: typeGroup.groupsByKind,
    },
    file: {
      fileTree: file.fileTree,
      openFiles: file.openFiles,
      activeFilePath: file.activeFilePath,
      clipboard: file.clipboard,
      rootDirs: file.rootDirs,
    },
  };
}

function restore(snapshot: WorkspaceSnapshot): void {
  useNetworkStore.setState(snapshot.network);
  useEditorStore.setState({ ...normalizeEditorSnapshot(snapshot.editor), pendingCloseTabId: null });
  useModuleStore.setState(snapshot.module);
  useConceptStore.setState(snapshot.concept);
  useSchemaStore.setState(snapshot.schema);
  useModelStore.setState(snapshot.model);
  useTypeGroupStore.setState(snapshot.typeGroup);
  useFileStore.setState(snapshot.file);
}

export function clearAllProjectStores(): void {
  useNetworkStore.getState().clear();
  useEditorStore.getState().clear();
  useModuleStore.getState().clear();
  useConceptStore.getState().clear();
  useSchemaStore.getState().clear();
  useModelStore.getState().clear();
  useTypeGroupStore.getState().clear();
  useFileStore.getState().clear();
}

export function saveWorkspaceState(workspaceKey: string): void {
  cache.set(workspaceKey, capture());
}

/** Restore snapshot if available. Returns true if restored. */
export function restoreWorkspaceState(workspaceKey: string): boolean {
  const snapshot = cache.get(workspaceKey);
  if (!snapshot) return false;
  restore(snapshot);
  return true;
}

export function deleteWorkspaceState(workspaceKey: string): void {
  cache.delete(workspaceKey);
}

export function hasCachedState(workspaceKey: string): boolean {
  return cache.has(workspaceKey);
}

export interface CachedEditorTabRef {
  projectId: string;
  tab: EditorTab;
}

export function findCachedProjectEditorTab(tabId: string): CachedEditorTabRef | null {
  for (const [workspaceKey, snapshot] of cache.entries()) {
    if (workspaceKey === APP_WORKSPACE_CACHE_KEY) continue;
    const tab = snapshot.editor.tabs.find((entry) => entry.id === tabId);
    if (tab) {
      return { projectId: tab.projectId ?? workspaceKey, tab };
    }
  }

  return null;
}

export function updateCachedProjectEditorTab(
  tabId: string,
  updater: (tab: EditorTab) => EditorTab,
): void {
  for (const [workspaceKey, snapshot] of cache.entries()) {
    if (workspaceKey === APP_WORKSPACE_CACHE_KEY) continue;
    const nextTabs = snapshot.editor.tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab));
    if (nextTabs === snapshot.editor.tabs || !nextTabs.some((tab, index) => tab !== snapshot.editor.tabs[index])) {
      continue;
    }

    cache.set(workspaceKey, {
      ...snapshot,
      editor: {
        ...normalizeEditorSnapshot(snapshot.editor),
        tabs: nextTabs,
      },
    });
  }
}

export function focusCachedProjectEditorTab(projectId: string, tabId: string): void {
  const snapshot = cache.get(projectId);
  if (!snapshot) return;

  const editor = normalizeEditorSnapshot(snapshot.editor);
  const tab = editor.tabs.find((entry) => entry.id === tabId);
  if (!tab) return;

  const sideLayout = containsTab(editor.sideLayout, tabId)
    ? setActiveInLeaf(editor.sideLayout!, tabId)
    : editor.sideLayout;
  const fullLayout = containsTab(editor.fullLayout, tabId)
    ? setActiveInLeaf(editor.fullLayout!, tabId)
    : editor.fullLayout;
  const hosts = tab.hostId !== 'main' && editor.hosts[tab.hostId]
    ? {
        ...editor.hosts,
        [tab.hostId]: { ...editor.hosts[tab.hostId], activeTabId: tabId },
      }
    : editor.hosts;

  cache.set(projectId, {
    ...snapshot,
    editor: {
      ...editor,
      activeTabId: tab.hostId === 'main' ? tabId : editor.activeTabId,
      sideLayout,
      fullLayout,
      sideLastActiveTabId: containsTab(sideLayout, tabId) ? tabId : editor.sideLastActiveTabId,
      fullLastActiveTabId: containsTab(fullLayout, tabId) ? tabId : editor.fullLastActiveTabId,
      hosts,
      focusedHostId: tab.hostId,
    },
  });
}

export function saveProjectState(projectId: string): void {
  saveWorkspaceState(projectId);
}

export function restoreProjectState(projectId: string): boolean {
  return restoreWorkspaceState(projectId);
}

export function deleteProjectState(projectId: string): void {
  deleteWorkspaceState(projectId);
}

export function saveAppState(): void {
  saveWorkspaceState(APP_WORKSPACE_CACHE_KEY);
}

export function restoreAppState(): boolean {
  return restoreWorkspaceState(APP_WORKSPACE_CACHE_KEY);
}

export function deleteAppState(): void {
  deleteWorkspaceState(APP_WORKSPACE_CACHE_KEY);
}

export function hasCachedAppState(): boolean {
  return hasCachedState(APP_WORKSPACE_CACHE_KEY);
}
