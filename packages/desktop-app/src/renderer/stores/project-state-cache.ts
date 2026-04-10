import { useNetworkStore, type NetworkNodeWithObject, type EdgeWithRelationType } from './network-store';
import { useEditorStore } from './editor-store';
import { useModuleStore } from './module-store';
import { useConceptStore } from './concept-store';
import { useArchetypeStore } from './archetype-store';
import { useRelationTypeStore } from './relation-type-store';
import { useTypeGroupStore } from './type-group-store';
import { useFileStore, type OpenFile, type ClipboardAction, type ClipboardState } from './file-store';
import type {
  Network, NetworkNode, Edge, Concept, RelationType,
  NetworkBreadcrumbItem, NetworkTreeNode,
  EditorTab, SplitNode,
  Module, ModuleDirectory,
  ConceptProperty,
  Archetype, ArchetypeField,
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

interface ArchetypeSnapshot {
  archetypes: Archetype[];
  fields: Record<string, ArchetypeField[]>;
}

interface RelationTypeSnapshot {
  relationTypes: RelationType[];
}

interface TypeGroupSnapshot {
  groupsByKind: {
    archetype: TypeGroup[];
    relation_type: TypeGroup[];
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
  archetype: ArchetypeSnapshot;
  relationType: RelationTypeSnapshot;
  typeGroup: TypeGroupSnapshot;
  file: FileSnapshot;
}

const APP_WORKSPACE_CACHE_KEY = '__app__';
const cache = new Map<string, WorkspaceSnapshot>();

function capture(): WorkspaceSnapshot {
  const network = useNetworkStore.getState();
  const editor = useEditorStore.getState();
  const module = useModuleStore.getState();
  const concept = useConceptStore.getState();
  const archetype = useArchetypeStore.getState();
  const relationType = useRelationTypeStore.getState();
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
    archetype: {
      archetypes: archetype.archetypes,
      fields: archetype.fields,
    },
    relationType: {
      relationTypes: relationType.relationTypes,
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
  useEditorStore.setState(snapshot.editor);
  useModuleStore.setState(snapshot.module);
  useConceptStore.setState(snapshot.concept);
  useArchetypeStore.setState(snapshot.archetype);
  useRelationTypeStore.setState(snapshot.relationType);
  useTypeGroupStore.setState(snapshot.typeGroup);
  useFileStore.setState(snapshot.file);
}

export function clearAllProjectStores(): void {
  useNetworkStore.getState().clear();
  useEditorStore.getState().clear();
  useModuleStore.getState().clear();
  useConceptStore.getState().clear();
  useArchetypeStore.getState().clear();
  useRelationTypeStore.getState().clear();
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
