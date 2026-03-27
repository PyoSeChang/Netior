// ============================================
// Project
// ============================================

export interface Project {
  id: string;
  name: string;
  root_dir: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  root_dir: string;
}

// ============================================
// Concept
// ============================================

export interface Concept {
  id: string;
  project_id: string;
  title: string;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConceptCreate {
  project_id: string;
  title: string;
  color?: string;
  icon?: string;
}

export interface ConceptUpdate {
  title?: string;
  color?: string | null;
  icon?: string | null;
}

// ============================================
// Canvas
// ============================================

export interface Canvas {
  id: string;
  project_id: string;
  concept_id: string | null;
  name: string;
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasCreate {
  project_id: string;
  name: string;
  concept_id?: string;
}

export interface CanvasUpdate {
  name?: string;
  viewport_x?: number;
  viewport_y?: number;
  viewport_zoom?: number;
}

// ============================================
// CanvasNode
// ============================================

export interface CanvasNode {
  id: string;
  canvas_id: string;
  concept_id: string;
  position_x: number;
  position_y: number;
  width: number | null;
  height: number | null;
}

export interface CanvasNodeCreate {
  canvas_id: string;
  concept_id: string;
  position_x: number;
  position_y: number;
  width?: number;
  height?: number;
}

export interface CanvasNodeUpdate {
  position_x?: number;
  position_y?: number;
  width?: number | null;
  height?: number | null;
}

// ============================================
// Edge
// ============================================

export interface Edge {
  id: string;
  canvas_id: string;
  source_node_id: string;
  target_node_id: string;
  created_at: string;
}

export interface EdgeCreate {
  canvas_id: string;
  source_node_id: string;
  target_node_id: string;
}

// ============================================
// ConceptFile
// ============================================

export interface ConceptFile {
  id: string;
  concept_id: string;
  file_path: string;
  created_at: string;
}

export interface ConceptFileCreate {
  concept_id: string;
  file_path: string;
}

// ============================================
// IPC
// ============================================

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================
// File System
// ============================================

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  extension?: string;
}

// ============================================
// Module
// ============================================

export interface Module {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleCreate {
  project_id: string;
  name: string;
}

export interface ModuleUpdate {
  name?: string;
}

// ============================================
// Module Directory
// ============================================

export interface ModuleDirectory {
  id: string;
  module_id: string;
  dir_path: string;
  created_at: string;
}

export interface ModuleDirectoryCreate {
  module_id: string;
  dir_path: string;
}

// ============================================
// Canvas Breadcrumb
// ============================================

export interface CanvasBreadcrumbItem {
  canvasId: string;
  canvasName: string;
  conceptTitle: string | null;
}

// ============================================
// Editor System
// ============================================

export type EditorViewMode = 'float' | 'full' | 'side' | 'detached';
export type EditorTabType = 'concept' | 'file';

// Split layout tree for side/full editor panes
export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitLeaf {
  type: 'leaf';
  tabId: string;
}

export interface SplitBranch {
  type: 'branch';
  direction: SplitDirection;
  ratio: number;
  children: [SplitNode, SplitNode];
}

export type SplitNode = SplitLeaf | SplitBranch;

export interface EditorTab {
  id: string;
  type: EditorTabType;
  /** Display name for tab bar */
  title: string;
  /** Target entity identifier: conceptId for concept tabs, absolutePath for file tabs */
  targetId: string;
  viewMode: EditorViewMode;
  floatRect: { x: number; y: number; width: number; height: number };
  isMinimized: boolean;
  sideSplitRatio: number;
  isDirty: boolean;
  /** Active sub-file within a concept editor */
  activeFilePath: string | null;
}

export interface ConceptEditorPrefs {
  id: string;
  concept_id: string;
  view_mode: EditorViewMode;
  float_x: number | null;
  float_y: number | null;
  float_width: number;
  float_height: number;
  side_split_ratio: number;
  updated_at: string;
}

export interface ConceptEditorPrefsUpdate {
  view_mode?: EditorViewMode;
  float_x?: number;
  float_y?: number;
  float_width?: number;
  float_height?: number;
  side_split_ratio?: number;
}
