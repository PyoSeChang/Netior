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

export interface ProjectUpdate {
  name?: string;
  root_dir?: string;
}

// ============================================
// Concept
// ============================================

export interface Concept {
  id: string;
  project_id: string;
  archetype_id: string | null;
  recurrence_source_concept_id: string | null;
  recurrence_occurrence_key: string | null;
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
  recurrence_source_concept_id?: string | null;
  recurrence_occurrence_key?: string | null;
  color?: string;
  icon?: string;
  content?: string;
  agent_content?: string;
}

export interface ConceptUpdate {
  title?: string;
  archetype_id?: string | null;
  recurrence_source_concept_id?: string | null;
  recurrence_occurrence_key?: string | null;
  color?: string | null;
  icon?: string | null;
  content?: string | null;
  agent_content?: string | null;
}

// ============================================
// Network
// ============================================

export interface Network {
  id: string;
  project_id: string | null;
  scope: string;
  kind: NetworkKind;
  parent_network_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export type NetworkKind = 'universe' | 'ontology' | 'network';

export interface NetworkCreate {
  project_id: string | null;
  name: string;
  scope?: string;
  kind?: NetworkKind;
  parent_network_id?: string;
}

export interface NetworkUpdate {
  name?: string;
  scope?: string;
  parent_network_id?: string | null;
}

// ============================================
// File (1급 엔티티 — 파일/디렉토리)
// ============================================

export type FileEntityType = 'file' | 'directory';

export interface FileEntity {
  id: string;
  project_id: string;
  path: string;
  type: FileEntityType;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileEntityCreate {
  project_id: string;
  path: string;
  type: FileEntityType;
}

export interface FileEntityUpdate {
  metadata?: string | null;
}

// ============================================
// PDF TOC (file.metadata.pdf_toc)
// ============================================

export interface PdfTocEntry {
  id: string;
  title: string;
  destPage: number;
  level: number;
}

export interface PdfToc {
  entries: PdfTocEntry[];
  pageCount: number;
  analyzedAt: string;
  sourceMethod: 'text' | 'vision';
}

// ============================================
// Context
// ============================================

export interface Context {
  id: string;
  network_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContextCreate {
  network_id: string;
  name: string;
  description?: string;
}

export interface ContextUpdate {
  name?: string;
  description?: string | null;
}

export interface ContextMember {
  id: string;
  context_id: string;
  member_type: 'object' | 'edge';
  member_id: string;
}

// ============================================
// Network Object
// ============================================

export type NetworkObjectType =
  | 'concept' | 'network' | 'project' | 'archetype'
  | 'relation_type' | 'type_group' | 'agent' | 'context'
  | 'file' | 'module' | 'folder';

export type NodeType = 'basic' | 'portal' | 'group' | 'hierarchy';
export type NodeConfigKind = 'freeform' | 'grid' | 'list';
export type NodeSortDirection = 'asc' | 'desc';
export type NodeSortEmptyPlacement = 'first' | 'last';

export type NodeSortConfig =
  | {
      kind: 'system_slot';
      slot: SystemSlotKey;
      direction?: NodeSortDirection;
      emptyPlacement?: NodeSortEmptyPlacement;
    }
  | {
      kind: 'semantic_annotation';
      annotation: SlotSemanticAnnotationKey;
      direction?: NodeSortDirection;
      emptyPlacement?: NodeSortEmptyPlacement;
    }
  | {
      kind: 'property';
      fieldId: string;
      direction?: NodeSortDirection;
      emptyPlacement?: NodeSortEmptyPlacement;
    };

export interface NodeFreeformConfig {
  kind: 'freeform';
}

export interface NodeGridConfig {
  kind: 'grid';
  columns?: number;
  gapX?: number;
  gapY?: number;
  padding?: number;
  itemWidth?: number;
  itemHeight?: number;
  sort?: NodeSortConfig | null;
}

export interface NodeListConfig {
  kind: 'list';
  gap?: number;
  padding?: number;
  itemHeight?: number;
  sort?: NodeSortConfig | null;
}

export type NodeConfig = NodeFreeformConfig | NodeGridConfig | NodeListConfig;

export interface ObjectRecord {
  id: string;
  object_type: NetworkObjectType;
  scope: string;
  project_id: string | null;
  ref_id: string;
  created_at: string;
}

// ============================================
// NetworkNode
// ============================================

export interface NetworkNode {
  id: string;
  network_id: string;
  object_id: string;
  node_type: NodeType;
  parent_node_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface NetworkNodeCreate {
  network_id: string;
  object_id: string;
  node_type?: NodeType;
  parent_node_id?: string;
  metadata?: string | null;
}

export interface NetworkNodeUpdate {
  node_type?: NodeType;
  parent_node_id?: string | null;
  metadata?: string | null;
}

// ============================================
// Edge
// ============================================

export type SystemContract =
  | 'core:contains'
  | 'core:entry_portal'
  | 'core:hierarchy_parent';

export type RelationSemanticAnnotationKey =
  | 'structure.contains'
  | 'structure.entry_portal'
  | 'structure.parent';

export interface Edge {
  id: string;
  network_id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type_id: string | null;
  system_contract: SystemContract | null;
  semantic_annotation?: RelationSemanticAnnotationKey | null;
  description: string | null;
  created_at: string;
}

export interface EdgeCreate {
  network_id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type_id?: string;
  system_contract?: SystemContract;
  semantic_annotation?: RelationSemanticAnnotationKey;
  description?: string;
}

export interface EdgeUpdate {
  relation_type_id?: string | null;
  system_contract?: SystemContract | null;
  semantic_annotation?: RelationSemanticAnnotationKey | null;
  description?: string | null;
}

// ============================================
// System Semantics
// ============================================

export type SemanticCategoryKey =
  | 'time'
  | 'workflow'
  | 'structure'
  | 'knowledge'
  | 'space'
  | 'quant'
  | 'governance';

export type SemanticTraitKey =
  | 'temporal'
  | 'dueable'
  | 'recurring'
  | 'statusful'
  | 'assignable'
  | 'prioritizable'
  | 'progressable'
  | 'estimable'
  | 'hierarchical'
  | 'ordered'
  | 'taggable'
  | 'categorizable'
  | 'sourceable'
  | 'attachable'
  | 'versioned'
  | 'locatable'
  | 'measurable'
  | 'budgeted'
  | 'ownable'
  | 'approvable';

export type SystemSlotKey =
  | 'start_at'
  | 'end_at'
  | 'all_day'
  | 'timezone'
  | 'due_at'
  | 'recurrence_rule'
  | 'recurrence_until'
  | 'recurrence_count'
  | 'status'
  | 'status_changed_at'
  | 'assignee_refs'
  | 'primary_assignee_ref'
  | 'priority'
  | 'progress_ratio'
  | 'completed_at'
  | 'estimate_value'
  | 'estimate_unit'
  | 'actual_value'
  | 'parent_ref'
  | 'order_index'
  | 'tag_keys'
  | 'category_key'
  | 'source_url'
  | 'source_ref'
  | 'citation'
  | 'attachment_refs'
  | 'version'
  | 'revision'
  | 'supersedes_ref'
  | 'place_ref'
  | 'address'
  | 'lat'
  | 'lng'
  | 'measure_value'
  | 'measure_unit'
  | 'target_value'
  | 'budget_amount'
  | 'budget_currency'
  | 'budget_limit'
  | 'owner_ref'
  | 'approval_state'
  | 'approved_by_ref'
  | 'approved_at';

export type SlotSemanticAnnotationKey =
  | 'time.start'
  | 'time.end'
  | 'time.all_day'
  | 'time.timezone'
  | 'time.due'
  | 'time.recurrence_rule'
  | 'time.recurrence_until'
  | 'time.recurrence_count'
  | 'workflow.status'
  | 'workflow.status_changed_at'
  | 'workflow.assignees'
  | 'workflow.primary_assignee'
  | 'workflow.priority'
  | 'workflow.progress'
  | 'workflow.completed_at'
  | 'workflow.estimate_value'
  | 'workflow.estimate_unit'
  | 'workflow.actual_value'
  | 'structure.parent'
  | 'structure.order'
  | 'structure.tags'
  | 'structure.category'
  | 'knowledge.source_url'
  | 'knowledge.source_ref'
  | 'knowledge.citation'
  | 'knowledge.attachments'
  | 'knowledge.version'
  | 'knowledge.revision'
  | 'knowledge.supersedes'
  | 'space.place'
  | 'space.address'
  | 'space.lat'
  | 'space.lng'
  | 'quant.measure_value'
  | 'quant.measure_unit'
  | 'quant.target_value'
  | 'quant.budget_amount'
  | 'quant.budget_currency'
  | 'quant.budget_limit'
  | 'governance.owner'
  | 'governance.approval_state'
  | 'governance.approved_by'
  | 'governance.approved_at';

export type SemanticAnnotationKey = SlotSemanticAnnotationKey | RelationSemanticAnnotationKey;
export type SemanticFacetKey = SemanticTraitKey;

export type SlotContractLevel = 'strict' | 'constrained' | 'loose';

// ============================================
// Layout
// ============================================

export interface Layout {
  id: string;
  layout_type: string;
  layout_config_json: string | null;
  viewport_json: string | null;
  network_id: string | null;
  context_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayoutUpdate {
  layout_type?: string;
  layout_config_json?: string | null;
  viewport_json?: string | null;
}

export interface LayoutNodePosition {
  id: string;
  layout_id: string;
  node_id: string;
  position_json: string;
}

export interface LayoutEdgeVisual {
  id: string;
  layout_id: string;
  edge_id: string;
  visual_json: string;
}

// ============================================
// Service DTOs
// ============================================

export interface NodePosition {
  nodeId: string;
  positionJson: string;
}

export interface EdgeVisual {
  edgeId: string;
  visualJson: string;
}

export interface NetworkFullData {
  network: Network;
  layout: Layout | undefined;
  nodes: (NetworkNode & {
    object?: ObjectRecord;
    concept?: Concept;
    file?: FileEntity;
  })[];
  edges: (Edge & { relation_type?: RelationType })[];
  nodePositions: NodePosition[];
  edgeVisuals: EdgeVisual[];
}

// ============================================
// IPC
// ============================================

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface NetiorServiceSuccess<T> {
  ok: true;
  data: T;
}

export interface NetiorServiceError {
  ok: false;
  error: string;
}

export type NetiorServiceResponse<T> = NetiorServiceSuccess<T> | NetiorServiceError;

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
  path: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleCreate {
  project_id: string;
  name: string;
  path: string;
}

export interface ModuleUpdate {
  name?: string;
  path?: string;
}

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
  group_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  node_shape: string | null;
  file_template: string | null;
  semantic_traits: SemanticTraitKey[];
  facets?: SemanticFacetKey[];
  created_at: string;
  updated_at: string;
}

export interface ArchetypeCreate {
  project_id: string;
  group_id?: string | null;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  node_shape?: string;
  file_template?: string;
  semantic_traits?: SemanticTraitKey[];
  facets?: SemanticFacetKey[];
}

export interface ArchetypeUpdate {
  group_id?: string | null;
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  node_shape?: string | null;
  file_template?: string | null;
  semantic_traits?: SemanticTraitKey[];
  facets?: SemanticFacetKey[];
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
  | 'tags'
  | 'archetype_ref';

export interface ArchetypeField {
  id: string;
  archetype_id: string;
  name: string;
  field_type: FieldType;
  options: string | null;
  sort_order: number;
  required: boolean;
  default_value: string | null;
  ref_archetype_id: string | null;
  system_slot: SystemSlotKey | null;
  semantic_annotation?: SlotSemanticAnnotationKey | null;
  slot_binding_locked: boolean;
  generated_by_trait: boolean;
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
  ref_archetype_id?: string;
  system_slot?: SystemSlotKey | null;
  semantic_annotation?: SlotSemanticAnnotationKey | null;
  slot_binding_locked?: boolean;
  generated_by_trait?: boolean;
}

export interface ArchetypeFieldUpdate {
  name?: string;
  field_type?: FieldType;
  options?: string | null;
  sort_order?: number;
  required?: boolean;
  default_value?: string | null;
  ref_archetype_id?: string | null;
  system_slot?: SystemSlotKey | null;
  semantic_annotation?: SlotSemanticAnnotationKey | null;
  slot_binding_locked?: boolean;
  generated_by_trait?: boolean;
}

export type Schema = Archetype;
export type SchemaCreate = ArchetypeCreate;
export type SchemaUpdate = ArchetypeUpdate;
export type SchemaSlot = ArchetypeField;
export type SchemaSlotCreate = ArchetypeFieldCreate;
export type SchemaSlotUpdate = ArchetypeFieldUpdate;

// ============================================
// Type Group
// ============================================

export type TypeGroupKind = 'archetype' | 'relation_type';

export interface TypeGroup {
  id: string;
  scope: string;
  project_id: string | null;
  kind: TypeGroupKind;
  name: string;
  parent_group_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TypeGroupCreate {
  project_id: string | null;
  kind: TypeGroupKind;
  name: string;
  scope?: string;
  parent_group_id?: string;
  sort_order?: number;
}

export interface TypeGroupUpdate {
  name?: string;
  parent_group_id?: string | null;
  sort_order?: number;
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
  group_id: string | null;
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
  group_id?: string | null;
  name: string;
  description?: string;
  color?: string;
  line_style?: LineStyle;
  directed?: boolean;
}

export interface RelationTypeUpdate {
  group_id?: string | null;
  name?: string;
  description?: string | null;
  color?: string | null;
  line_style?: LineStyle;
  directed?: boolean;
}

// ============================================
// Network Tree
// ============================================

export interface NetworkTreeNode {
  network: Network;
  children: NetworkTreeNode[];
}

// ============================================
// Network Breadcrumb
// ============================================

export interface NetworkBreadcrumbItem {
  networkId: string;
  networkName: string;
}

// ============================================
// Editor System
// ============================================

export type EditorViewMode = 'float' | 'full' | 'side' | 'detached';
export type EditorTabType = 'concept' | 'file' | 'archetype' | 'terminal' | 'edge' | 'relationType' | 'network' | 'networkViewer' | 'project' | 'narre' | 'agent' | 'fileMetadata' | 'context';

/** Identifies a window that hosts editor tabs (main window or detached window) */
export interface EditorHostState {
  id: string;
  /** Display label for the window (shown in context menu "Move to > ...") */
  label: string;
  /** 'main' for the primary window, 'detached' for pop-out windows */
  kind: 'main' | 'detached';
  /** Per-host active tab id */
  activeTabId: string | null;
  /** Split layout tree for side-mode tabs in this host */
  sideLayout: SplitNode | null;
  /** Split layout tree for full-mode tabs in this host */
  fullLayout: SplitNode | null;
}

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
  /** Owning project id for project-scoped tabs */
  projectId?: string;
  /** Host window this tab belongs to */
  hostId: string;
  viewMode: EditorViewMode;
  floatRect: { x: number; y: number; width: number; height: number };
  isMinimized: boolean;
  sideSplitRatio: number;
  isDirty: boolean;
  isStale?: boolean;
  /** Active sub-file within a concept editor */
  activeFilePath: string | null;
  /** Override editor type for file tabs (when user switches via context menu) */
  editorType?: string;
  /** Network context for object tabs opened from a network node */
  networkId?: string;
  /** Network node context for object tabs opened from a concrete node */
  nodeId?: string;
  /** Working directory override for terminal tabs */
  terminalCwd?: string;
  /** Launch override for terminal tabs (for example agent-specific terminals) */
  terminalLaunchConfig?: Pick<TerminalLaunchConfig, 'shell' | 'args' | 'agent'>;
  /** Draft data for unsaved new entities (concept creation flow) */
  draftData?: {
    networkId?: string;
    parentGroupNodeId?: string;
    slotIndex?: number;
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
  type: 'concept' | 'network' | 'edge' | 'archetype' | 'relationType' | 'module' | 'file';
  id?: string;
  path?: string;
  display: string;
}

export interface NarreToolCall {
  tool: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  metadata?: NarreToolMetadata;
  result?: string;
  error?: string;
}

export type NarreToolCategory =
  | 'project'
  | 'types'
  | 'concepts'
  | 'graph'
  | 'files'
  | 'modules'
  | 'search'
  | 'analysis';

export type NarreToolKind = 'query' | 'mutation' | 'analysis';
export type NarreToolApprovalMode = 'auto' | 'prompt';
export type NetiorMcpToolProfile =
  | 'core'
  | 'discovery'
  | 'bootstrap-skill'
  | 'bootstrap-interview'
  | 'bootstrap-execution'
  | 'index-skill';
export type NetiorMcpToolScope = 'app' | 'project' | 'network' | 'object' | 'file' | 'mixed';

export interface NetiorMcpToolSpec {
  key: string;
  displayName?: string;
  description: string;
  category: NarreToolCategory;
  kind: NarreToolKind;
  isMutation: boolean;
  approvalMode: NarreToolApprovalMode;
  profiles?: readonly NetiorMcpToolProfile[];
  scope?: NetiorMcpToolScope;
  defaultProjectBinding?: boolean;
}

export interface NarreToolMetadata {
  displayName: string;
  description?: string;
  category: NarreToolCategory;
  kind: NarreToolKind;
  isMutation: boolean;
  approvalMode: NarreToolApprovalMode;
  profiles?: readonly NetiorMcpToolProfile[];
  scope?: NetiorMcpToolScope;
  defaultProjectBinding?: boolean;
}

export type NarreActorProvider = 'narre' | 'claude' | 'openai' | 'codex' | 'custom';

export interface NarreActor {
  provider: NarreActorProvider;
  id?: string;
  label?: string;
}

export interface NarreRichTextBlock {
  id: string;
  type: 'rich_text';
  text: string;
  mentions?: NarreMention[];
}

export interface NarreSkillInvocationBlock {
  id: string;
  type: 'skill';
  skillId: string;
  name: string;
  label: string;
  args?: Record<string, string>;
  refs?: NarreMention[];
}

export interface NarreLegacyCommandBlock {
  id: string;
  type: 'command';
  name: string;
  label: string;
  args?: Record<string, string>;
  refs?: NarreMention[];
}

export interface NarreDraftBlock {
  id: string;
  type: 'draft';
  format: 'markdown';
  content: string;
}

export interface NarreToolBlock {
  id: string;
  type: 'tool';
  toolKey: string;
  displayName?: string;
  metadata?: NarreToolMetadata;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
}

export interface NarreCardBlock {
  id: string;
  type: 'card';
  card: NarreCard;
}

export interface NarreTranscriptTurn {
  id: string;
  role: 'user' | 'assistant';
  createdAt: string;
  actor?: NarreActor;
  blocks: NarreTranscriptBlock[];
}

export type NarreTranscriptBlock =
  | NarreRichTextBlock
  | NarreSkillInvocationBlock
  | NarreLegacyCommandBlock
  | NarreDraftBlock
  | NarreToolBlock
  | NarreCardBlock;

export interface NarreTranscript {
  turns: NarreTranscriptTurn[];
}

export interface NarreSessionFileV1 {
  messages: NarreMessage[];
}

export interface NarreSessionFileV2 {
  version: 2;
  transcript: NarreTranscript;
}

export interface NarreSessionDetail extends NarreSession {
  projectId?: string;
  messages: NarreMessage[];
  transcript?: NarreTranscript;
}

export type NarreGraphPriority = 'balanced' | 'strict';

export interface NarreBehaviorSettings {
  graphPriority: NarreGraphPriority;
  discourageLocalWorkspaceActions: boolean;
  extraInstructions?: string;
}

export type NarreCodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';
export type NarreCodexApprovalPolicy = 'untrusted' | 'on-request' | 'never';

export interface NarreCodexSettings {
  model?: string;
  useProjectRootAsWorkingDirectory: boolean;
  sandboxMode: NarreCodexSandboxMode;
  approvalPolicy: NarreCodexApprovalPolicy;
  enableShellTool: boolean;
  enableMultiAgent: boolean;
  enableWebSearch: boolean;
  enableViewImage: boolean;
  enableApps: boolean;
}

export interface NarreStreamEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'error' | 'done' | 'card';
  content?: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  toolMetadata?: NarreToolMetadata;
  toolResult?: string;
  error?: string;
  card?: NarreCard;
  sessionId?: string;
  projectId?: string;
}

// ============================================
// Skill Types
// ============================================

export type SkillId = string;
export type BuiltInSkillId = 'bootstrap' | 'index';
export type SkillSource = 'builtin' | 'file';
export type SkillArgType = 'string' | 'enum' | 'number' | 'number_list';

export interface SkillArg {
  name: string;
  description: string;
  required: boolean;
  type: SkillArgType;
  options?: string[];
}

export interface SkillSlashTrigger {
  type: 'slash';
  name: string;
}

export type SkillTrigger = SkillSlashTrigger;

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  source: SkillSource;
  trigger?: SkillTrigger;
  args?: SkillArg[];
  hint?: string;
  requiredMentionTypes?: NarreMention['type'][];
  instructions?: string;
}

export interface SkillInvocation {
  skillId: SkillId;
  trigger?: SkillTrigger;
  args: Record<string, string>;
}

// ============================================
// Narre Response Card Types
// ============================================

export type NarreCardType = 'draft' | 'proposal' | 'permission' | 'interview' | 'summary';

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

export interface NarreDraftCard {
  type: 'draft';
  toolCallId: string;
  title?: string;
  content: string;
  format?: 'markdown';
  placeholder?: string;
  confirmLabel?: string;
  feedbackLabel?: string;
  feedbackPlaceholder?: string;
  submittedResponse?: NarreDraftResponse;
}

export interface NarrePermissionCard {
  type: 'permission';
  toolCallId: string;
  message: string;
  resolvedActionKey?: string;
  actions: Array<{ key: string; label: string; variant?: 'danger' | 'default' }>;
}

export interface NarreInterviewCard {
  type: 'interview';
  toolCallId: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
  allowText?: boolean;
  textPlaceholder?: string;
  submitLabel?: string;
  submittedResponse?: NarreInterviewResponse;
}

export interface NarreInterviewResponse {
  selected: string[];
  text?: string;
}

export interface NarreDraftResponse {
  action: 'confirm' | 'feedback';
  content: string;
  feedback?: string;
}

export interface NarreSummaryCard {
  type: 'summary';
  title: string;
  items: Array<{ label: string; status: 'success' | 'error' }>;
}

export type NarreCard =
  | NarreDraftCard
  | NarreProposalCard
  | NarrePermissionCard
  | NarreInterviewCard
  | NarreSummaryCard;

export interface NetiorChangeEvent {
  type: 'archetypes' | 'concepts' | 'relationTypes' | 'typeGroups' | 'networks' | 'edges' | 'layouts' | 'contexts';
  action: 'created' | 'updated' | 'deleted';
  id: string;
}

// ============================================
// Agent Definition Types
// ============================================

export type AgentDefinitionKind = 'narre' | 'terminal';
export type NarreAgentType = 'system' | 'user';
export type NarreSystemAgentType = 'network-builder' | 'network-finder' | 'agent-operator';
export type NarreUserAgentType = 'global' | 'project';
export type TerminalAgentType = 'codex-cli' | 'claude-code';
export type AgentSkillPackageFormat = 'skill-md-directory';

export interface AgentSkillRef {
  id: string;
  name?: string;
  version?: string;
  format?: AgentSkillPackageFormat;
}

export interface UserAgentSkillPackage {
  id: string;
  rootDir: string;
  skillFilePath: string;
  format: AgentSkillPackageFormat;
}

export interface UserAgentSkillSummary {
  id: string;
  name: string;
  description: string;
  body: string;
  rootDir: string;
  skillFilePath: string;
  updatedAt: string | null;
}

export interface UserAgentRecord {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userAgentType: NarreUserAgentType;
  projectId?: string;
  rootDir: string;
  createdAt: string;
  updatedAt: string;
  skills: UserAgentSkillSummary[];
}

export interface UpsertUserAgentInput {
  id?: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  userAgentType: NarreUserAgentType;
  projectId?: string;
}

export interface UpsertUserAgentSkillInput {
  agentId: string;
  userAgentType: NarreUserAgentType;
  projectId?: string;
  skillId?: string;
  name: string;
  description: string;
  body: string;
}

export interface DeleteUserAgentInput {
  agentId: string;
  userAgentType: NarreUserAgentType;
  projectId?: string;
}

export interface DeleteUserAgentSkillInput extends DeleteUserAgentInput {
  skillId: string;
}

export interface BaseAgentDefinition {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
}

export interface NarreSystemAgentDefinition extends BaseAgentDefinition {
  kind: 'narre';
  narreAgentType: 'system';
  systemAgentType: NarreSystemAgentType;
  skills: AgentSkillRef[];
}

export interface NarreGlobalUserAgentDefinition extends BaseAgentDefinition {
  kind: 'narre';
  narreAgentType: 'user';
  userAgentType: 'global';
  skills: AgentSkillRef[];
}

export interface NarreProjectUserAgentDefinition extends BaseAgentDefinition {
  kind: 'narre';
  narreAgentType: 'user';
  userAgentType: 'project';
  projectId: string;
  skills: AgentSkillRef[];
}

export type NarreUserAgentDefinition =
  | NarreGlobalUserAgentDefinition
  | NarreProjectUserAgentDefinition;

export type NarreAgentDefinition =
  | NarreSystemAgentDefinition
  | NarreUserAgentDefinition;

export interface TerminalAgentDefinition extends BaseAgentDefinition {
  kind: 'terminal';
  terminalAgentType: TerminalAgentType;
}

export type AgentDefinition =
  | NarreAgentDefinition
  | TerminalAgentDefinition;

export type SupervisorEventType =
  | 'session_started'
  | 'session_updated'
  | 'session_completed'
  | 'session_failed'
  | 'session_reported';

export interface SupervisorAgentSessionSnapshot {
  id: string;
  agentKey: string;
  agentId: string;
  agent: AgentDefinition;
  status: AgentStatus;
  reason: AgentAttentionReason | null;
  surface: AgentSurfaceRef;
  externalSessionId: string | null;
  projectId?: string;
  title?: string | null;
  skillId?: SkillId | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface SupervisorEvent {
  seq: number;
  type: SupervisorEventType;
  sessionId: string;
  agentKey: string;
  status: AgentStatus;
  createdAt: string;
  snapshot: SupervisorAgentSessionSnapshot;
}

export interface SupervisorSessionReport {
  agent: AgentDefinition;
  surface: AgentSurfaceRef;
  sessionId: string;
  externalSessionId?: string | null;
  projectId?: string;
  title?: string | null;
  status?: AgentStatus;
  reason?: AgentAttentionReason | null;
  skillId?: SkillId | null;
  metadata?: Record<string, string>;
}

// ============================================
// Terminal Types
// ============================================

export type TerminalSessionState = 'created' | 'starting' | 'running' | 'exited';

export type AgentProvider = 'claude' | 'codex' | 'narre';

export interface TerminalAgentLaunchConfig {
  provider: Exclude<AgentProvider, 'narre'>;
  remoteUrl?: string;
}

export interface TerminalLaunchConfig {
  cwd: string;
  shell?: string;
  args?: string[];
  title?: string;
  env?: Record<string, string>;
  agent?: TerminalAgentLaunchConfig;
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

// ============================================
// Agent Runtime Types
// ============================================

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'error' | 'offline';
export type AgentAttentionReason = 'approval' | 'user_input' | 'unknown';
export type AgentUxState = 'working' | 'needs_attention' | 'idle' | 'error' | 'offline';

export interface AgentSurfaceRef {
  kind: 'terminal' | 'editor';
  id: string;
}

export interface AgentSessionEvent {
  provider: AgentProvider;
  sessionId: string;
  surface: AgentSurfaceRef;
  externalSessionId?: string | null;
  type: 'start' | 'stop';
}

export interface AgentStatusEvent {
  provider: AgentProvider;
  sessionId: string;
  status: AgentStatus;
  reason?: AgentAttentionReason | null;
}

export interface AgentNameEvent {
  provider: AgentProvider;
  sessionId: string;
  name: string;
}

export interface AgentTurnEvent {
  provider: AgentProvider;
  sessionId: string;
  turnId?: string | null;
  type: 'start' | 'complete';
}

export interface AgentSessionSnapshot {
  provider: AgentProvider;
  sessionId: string;
  surface: AgentSurfaceRef;
  externalSessionId: string | null;
  status: AgentStatus;
  reason: AgentAttentionReason | null;
  name: string | null;
  turnState: 'idle' | 'working';
}

// ============================================
// Claude Code Integration Types
// ============================================

export type ClaudeCodeStatus = 'idle' | 'working';

export interface ClaudeSessionEvent {
  ptySessionId: string;
  claudeSessionId: string | null;
  type: 'start' | 'stop';
}

export interface ClaudeStatusEvent {
  ptySessionId: string;
  status: ClaudeCodeStatus;
}

export interface ClaudeNameEvent {
  ptySessionId: string;
  sessionName: string;
}
