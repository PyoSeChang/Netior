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
  archetype_id: string | null;
  title: string;
  color: string | null;
  icon: string | null;
  content: string | null;
  agent_content: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConceptCreate {
  project_id: string;
  title: string;
  archetype_id?: string;
  color?: string;
  icon?: string;
  content?: string;
  agent_content?: string;
}

export interface ConceptUpdate {
  title?: string;
  archetype_id?: string | null;
  color?: string | null;
  icon?: string | null;
  content?: string | null;
  agent_content?: string | null;
}

// ============================================
// Canvas
// ============================================

export interface Canvas {
  id: string;
  project_id: string;
  concept_id: string | null;
  canvas_type_id: string | null;
  name: string;
  layout: string;
  layout_config: Record<string, unknown> | null;
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
  canvas_type_id?: string;
  layout?: string;
  layout_config?: Record<string, unknown>;
}

export interface CanvasUpdate {
  name?: string;
  canvas_type_id?: string | null;
  layout?: string;
  layout_config?: Record<string, unknown> | null;
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
  concept_id: string | null;
  file_path: string | null;
  dir_path: string | null;
  position_x: number;
  position_y: number;
  width: number | null;
  height: number | null;
}

export interface CanvasNodeCreate {
  canvas_id: string;
  concept_id?: string;
  file_path?: string;
  dir_path?: string;
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
  relation_type_id: string | null;
  description: string | null;
  color: string | null;
  line_style: string | null;
  directed: number | null;
  created_at: string;
}

export interface EdgeCreate {
  canvas_id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type_id?: string;
  description?: string;
  color?: string;
  line_style?: string;
  directed?: boolean;
}

export interface EdgeUpdate {
  relation_type_id?: string | null;
  description?: string | null;
  color?: string | null;
  line_style?: string | null;
  directed?: boolean | null;
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
  /** Directory exists but children not yet loaded (lazy loading) */
  hasChildren?: boolean;
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
// Archetype
// ============================================

export interface Archetype {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  node_shape: string | null;
  file_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArchetypeCreate {
  project_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  node_shape?: string;
  file_template?: string;
}

export interface ArchetypeUpdate {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  node_shape?: string | null;
  file_template?: string | null;
}

// ============================================
// Archetype Field
// ============================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi-select'
  | 'radio'
  | 'relation'
  | 'file'
  | 'url'
  | 'color'
  | 'rating'
  | 'tags';

export interface ArchetypeField {
  id: string;
  archetype_id: string;
  name: string;
  field_type: FieldType;
  options: string | null;
  sort_order: number;
  required: boolean;
  default_value: string | null;
  created_at: string;
}

export interface ArchetypeFieldCreate {
  archetype_id: string;
  name: string;
  field_type: FieldType;
  options?: string;
  sort_order: number;
  required?: boolean;
  default_value?: string;
}

export interface ArchetypeFieldUpdate {
  name?: string;
  field_type?: FieldType;
  options?: string | null;
  sort_order?: number;
  required?: boolean;
  default_value?: string | null;
}

// ============================================
// Concept Property
// ============================================

export interface ConceptProperty {
  id: string;
  concept_id: string;
  field_id: string;
  value: string | null;
}

export interface ConceptPropertyUpsert {
  concept_id: string;
  field_id: string;
  value: string | null;
}

// ============================================
// RelationType
// ============================================

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface RelationType {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  color: string | null;
  line_style: LineStyle;
  directed: boolean;
  created_at: string;
  updated_at: string;
}

export interface RelationTypeCreate {
  project_id: string;
  name: string;
  description?: string;
  color?: string;
  line_style?: LineStyle;
  directed?: boolean;
}

export interface RelationTypeUpdate {
  name?: string;
  description?: string | null;
  color?: string | null;
  line_style?: LineStyle;
  directed?: boolean;
}

// ============================================
// CanvasType
// ============================================

export interface CanvasType {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanvasTypeCreate {
  project_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface CanvasTypeUpdate {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

export interface CanvasTypeAllowedRelation {
  id: string;
  canvas_type_id: string;
  relation_type_id: string;
}

// ============================================
// Canvas Tree
// ============================================

export interface CanvasTreeNode {
  canvas: Canvas;
  conceptTitle: string | null;
  children: CanvasTreeNode[];
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
export type EditorTabType = 'concept' | 'file' | 'archetype' | 'terminal' | 'edge' | 'relationType' | 'canvasType' | 'canvas' | 'narre';

// Split layout tree for side/full editor panes
export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitLeaf {
  type: 'leaf';
  tabIds: string[];
  activeTabId: string;
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
  /** Override editor type for file tabs (when user switches via context menu) */
  editorType?: string;
  /** Draft data for unsaved new entities (concept creation flow) */
  draftData?: {
    canvasId?: string;
    positionX?: number;
    positionY?: number;
    allowedArchetypeIds?: string[];
  };
  /** Whether the user manually renamed this tab (prevents auto-title updates) */
  isManuallyRenamed?: boolean;
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

// ============================================
// Narre Types
// ============================================

export interface NarreSession {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
}

export interface NarreMessage {
  role: 'user' | 'assistant';
  content: string;
  mentions?: NarreMention[];
  tool_calls?: NarreToolCall[];
  timestamp: string;
}

export interface NarreMention {
  type: 'concept' | 'canvas' | 'edge' | 'archetype' | 'relationType' | 'canvasType' | 'module' | 'file';
  id?: string;
  path?: string;
  display: string;
}

export interface NarreToolCall {
  tool: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: string;
  error?: string;
}

export interface NarreStreamEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error' | 'done' | 'card';
  content?: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  error?: string;
  card?: NarreCard;
}

// ============================================
// Slash Command Types
// ============================================

export type CommandArgType = 'string' | 'enum';

export interface CommandArg {
  name: string;
  description: string;
  required: boolean;
  type: CommandArgType;
  options?: string[];
}

export type CommandType = 'conversation' | 'system';

export interface SlashCommand {
  name: string;
  description: string;
  type: CommandType;
  args?: CommandArg[];
}

// ============================================
// Narre Response Card Types
// ============================================

export type NarreCardType = 'proposal' | 'permission' | 'interview' | 'summary';

export type ProposalCellType = 'text' | 'icon' | 'color' | 'enum' | 'boolean' | 'readonly';

export interface ProposalColumn {
  key: string;
  label: string;
  cellType: ProposalCellType;
  options?: string[];
}

export interface ProposalRow {
  id: string;
  values: Record<string, unknown>;
}

export interface NarreProposalCard {
  type: 'proposal';
  toolCallId: string;
  title: string;
  columns: ProposalColumn[];
  rows: ProposalRow[];
}

export interface NarrePermissionCard {
  type: 'permission';
  toolCallId: string;
  message: string;
  actions: Array<{ key: string; label: string; variant?: 'danger' | 'default' }>;
}

export interface NarreInterviewCard {
  type: 'interview';
  toolCallId: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
}

export interface NarreSummaryCard {
  type: 'summary';
  title: string;
  items: Array<{ label: string; status: 'success' | 'error' }>;
}

export type NarreCard = NarreProposalCard | NarrePermissionCard | NarreInterviewCard | NarreSummaryCard;

export interface NetiorChangeEvent {
  type: 'archetypes' | 'concepts' | 'relationTypes' | 'canvasTypes' | 'canvases' | 'edges';
  action: 'created' | 'updated' | 'deleted';
  id: string;
}

// ============================================
// Terminal Types
// ============================================

export type TerminalSessionState = 'created' | 'starting' | 'running' | 'exited';

export interface TerminalLaunchConfig {
  cwd: string;
  shell?: string;
  args?: string[];
  title?: string;
}

export interface TerminalSessionInfo {
  sessionId: string;
  cwd: string;
  title: string;
  shellPath: string;
  shellArgs: string[];
  state: TerminalSessionState;
  pid: number | null;
  exitCode: number | null;
  cols: number;
  rows: number;
}
