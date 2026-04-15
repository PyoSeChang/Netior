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
  parent_network_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface NetworkCreate {
  project_id: string | null;
  name: string;
  scope?: string;
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
  | 'relation_type' | 'agent' | 'context'
  | 'file' | 'module' | 'folder';

export type NodeType = 'basic' | 'portal' | 'group' | 'hierarchy';

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

export interface Edge {
  id: string;
  network_id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type_id: string | null;
  system_contract: SystemContract | null;
  description: string | null;
  created_at: string;
}

export interface EdgeCreate {
  network_id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type_id?: string;
  system_contract?: SystemContract;
  description?: string;
}

export interface EdgeUpdate {
  relation_type_id?: string | null;
  system_contract?: SystemContract | null;
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
  slot_binding_locked?: boolean;
  generated_by_trait?: boolean;
}

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
export type EditorTabType = 'concept' | 'file' | 'archetype' | 'terminal' | 'edge' | 'relationType' | 'network' | 'project' | 'narre' | 'fileMetadata' | 'context';

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
  result?: string;
  error?: string;
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
  toolResult?: string;
  error?: string;
  card?: NarreCard;
  sessionId?: string;
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
  type: 'archetypes' | 'concepts' | 'relationTypes' | 'typeGroups' | 'networks' | 'edges' | 'layouts' | 'contexts';
  action: 'created' | 'updated' | 'deleted';
  id: string;
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
