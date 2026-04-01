import { useCanvasStore, type CanvasNodeWithConcept, type EdgeWithRelationType } from './canvas-store';
import { useEditorStore } from './editor-store';
import { useModuleStore } from './module-store';
import { useConceptStore } from './concept-store';
import { useArchetypeStore } from './archetype-store';
import { useRelationTypeStore } from './relation-type-store';
import { useCanvasTypeStore } from './canvas-type-store';
import { useFileStore, type OpenFile, type ClipboardAction } from './file-store';
import type {
  Canvas, CanvasNode, Edge, Concept, RelationType,
  CanvasBreadcrumbItem, CanvasTreeNode,
  EditorTab, SplitNode,
  Module, ModuleDirectory,
  ConceptProperty,
  Archetype, ArchetypeField,
  CanvasType,
  FileTreeNode,
} from '@netior/shared/types';

interface CanvasSnapshot {
  canvases: Canvas[];
  currentCanvas: Canvas | null;
  nodes: CanvasNodeWithConcept[];
  edges: EdgeWithRelationType[];
  breadcrumbs: CanvasBreadcrumbItem[];
  canvasHistory: string[];
  canvasTree: CanvasTreeNode[];
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

interface CanvasTypeSnapshot {
  canvasTypes: CanvasType[];
  allowedRelations: Record<string, RelationType[]>;
}

interface FileSnapshot {
  fileTree: FileTreeNode[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  clipboard: { path: string; action: ClipboardAction } | null;
  rootDirs: string[];
}

interface ProjectSnapshot {
  canvas: CanvasSnapshot;
  editor: EditorSnapshot;
  module: ModuleSnapshot;
  concept: ConceptSnapshot;
  archetype: ArchetypeSnapshot;
  relationType: RelationTypeSnapshot;
  canvasType: CanvasTypeSnapshot;
  file: FileSnapshot;
}

const cache = new Map<string, ProjectSnapshot>();

function capture(): ProjectSnapshot {
  const canvas = useCanvasStore.getState();
  const editor = useEditorStore.getState();
  const module = useModuleStore.getState();
  const concept = useConceptStore.getState();
  const archetype = useArchetypeStore.getState();
  const relationType = useRelationTypeStore.getState();
  const canvasType = useCanvasTypeStore.getState();
  const file = useFileStore.getState();

  return {
    canvas: {
      canvases: canvas.canvases,
      currentCanvas: canvas.currentCanvas,
      nodes: canvas.nodes,
      edges: canvas.edges,
      breadcrumbs: canvas.breadcrumbs,
      canvasHistory: canvas.canvasHistory,
      canvasTree: canvas.canvasTree,
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
    canvasType: {
      canvasTypes: canvasType.canvasTypes,
      allowedRelations: canvasType.allowedRelations,
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

function restore(snapshot: ProjectSnapshot): void {
  useCanvasStore.setState(snapshot.canvas);
  useEditorStore.setState(snapshot.editor);
  useModuleStore.setState(snapshot.module);
  useConceptStore.setState(snapshot.concept);
  useArchetypeStore.setState(snapshot.archetype);
  useRelationTypeStore.setState(snapshot.relationType);
  useCanvasTypeStore.setState(snapshot.canvasType);
  useFileStore.setState(snapshot.file);
}

export function clearAllProjectStores(): void {
  useCanvasStore.getState().clear();
  useEditorStore.getState().clear();
  useModuleStore.getState().clear();
  useConceptStore.getState().clear();
  useArchetypeStore.getState().clear();
  useRelationTypeStore.getState().clear();
  useCanvasTypeStore.getState().clear();
  useFileStore.getState().clear();
}

export function saveProjectState(projectId: string): void {
  cache.set(projectId, capture());
}

/** Restore snapshot if available. Returns true if restored. */
export function restoreProjectState(projectId: string): boolean {
  const snapshot = cache.get(projectId);
  if (!snapshot) return false;
  restore(snapshot);
  return true;
}

export function deleteProjectState(projectId: string): void {
  cache.delete(projectId);
}
