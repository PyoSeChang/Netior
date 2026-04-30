import type {
  SkillDefinition,
  FieldType,
  SemanticCategoryKey,
  FieldMeaningKey,
  MeaningBindingKey,
  MeaningSlotKey,
  SemanticMeaningKey,
  ModelKey,
  ModelTargetKind,
  EdgeLineStyle,
  FieldMeaningBindingKey,
  SlotConstraintLevel,
} from '../types/index.js';
export * from './netior-mcp-tools.js';

// ============================================
// Agent Skill Storage
// ============================================

export const AGENT_SKILL_STORAGE = {
  PROJECT_CONFIG_DIR: '.netior',
  AGENTS_DIR: 'agents',
  AGENT_FILE_NAME: 'agent.json',
  SKILLS_DIR: 'skills',
  SKILL_FILE_NAME: 'SKILL.md',
  FORMAT: 'skill-md-directory',
} as const;

// ============================================
// Built-in Skills
// ============================================

export const BUILT_IN_SKILLS: readonly SkillDefinition[] = [
  {
    id: 'bootstrap',
    name: 'bootstrap',
    description: 'narre.command.bootstrap',
    source: 'builtin',
    trigger: { type: 'slash', name: 'bootstrap' },
    hint: 'narre.command.bootstrapHint',
  },
  {
    id: 'index',
    name: 'index',
    description: 'narre.command.index',
    source: 'builtin',
    trigger: { type: 'slash', name: 'index' },
    hint: 'narre.command.indexHint',
    args: [
      {
        name: 'startPage',
        description: 'pdfToc.startPage',
        required: true,
        type: 'number',
      },
      {
        name: 'endPage',
        description: 'pdfToc.endPage',
        required: true,
        type: 'number',
      },
      {
        name: 'overviewPages',
        description: 'pdfToc.overviewPages',
        required: false,
        type: 'number_list',
      },
    ],
    requiredMentionTypes: ['file'],
  },
] as const;

export const SLASH_TRIGGER_SKILLS = BUILT_IN_SKILLS.filter(
  (skill) => skill.trigger?.type === 'slash',
);

export function findSkillBySlashTrigger(triggerName: string): SkillDefinition | null {
  const normalized = triggerName.toLowerCase();
  return SLASH_TRIGGER_SKILLS.find((skill) => skill.trigger?.name === normalized) ?? null;
}

// ============================================
// IPC Channels
// ============================================

export const IPC_CHANNELS = {
  // Project
  PROJECT_CREATE: 'project:create',
  PROJECT_LIST: 'project:list',
  PROJECT_DELETE: 'project:delete',
  PROJECT_UPDATE_ROOT_DIR: 'project:updateRootDir',

  // Concept
  CONCEPT_CREATE: 'concept:create',
  CONCEPT_GET_BY_PROJECT: 'concept:getByProject',
  CONCEPT_UPDATE: 'concept:update',
  CONCEPT_DELETE: 'concept:delete',
  CONCEPT_SEARCH: 'concept:search',
  CONCEPT_SYNC_TO_AGENT: 'concept:syncToAgent',
  CONCEPT_SYNC_FROM_AGENT: 'concept:syncFromAgent',

  // Network
  NETWORK_CREATE: 'network:create',
  NETWORK_LIST: 'network:list',
  NETWORK_UPDATE: 'network:update',
  NETWORK_DELETE: 'network:delete',
  NETWORK_GET_FULL: 'network:getFull',
  NETWORK_GET_TREE: 'network:getTree',
  NETWORK_GET_ANCESTORS: 'network:getAncestors',

  // Network Node
  NETWORK_NODE_ADD: 'networkNode:add',
  NETWORK_NODE_UPDATE: 'networkNode:update',
  NETWORK_NODE_REMOVE: 'networkNode:remove',

  // Object
  OBJECT_GET: 'object:get',
  OBJECT_GET_BY_REF: 'object:getByRef',

  // Layout
  LAYOUT_GET: 'layout:get',
  LAYOUT_GET_BY_NETWORK: 'layout:getByNetwork',
  LAYOUT_UPDATE: 'layout:update',
  LAYOUT_NODE_SET_POSITION: 'layoutNode:setPosition',
  LAYOUT_NODE_GET_POSITIONS: 'layoutNode:getPositions',
  LAYOUT_NODE_REMOVE: 'layoutNode:remove',
  LAYOUT_EDGE_SET_VISUAL: 'layoutEdge:setVisual',
  LAYOUT_EDGE_GET_VISUALS: 'layoutEdge:getVisuals',
  LAYOUT_EDGE_REMOVE: 'layoutEdge:remove',

  // Context
  CONTEXT_CREATE: 'context:create',
  CONTEXT_LIST: 'context:list',
  CONTEXT_GET: 'context:get',
  CONTEXT_UPDATE: 'context:update',
  CONTEXT_DELETE: 'context:delete',
  CONTEXT_ADD_MEMBER: 'context:addMember',
  CONTEXT_REMOVE_MEMBER: 'context:removeMember',
  CONTEXT_GET_MEMBERS: 'context:getMembers',

  // Edge
  EDGE_CREATE: 'edge:create',
  EDGE_GET: 'edge:get',
  EDGE_UPDATE: 'edge:update',
  EDGE_DELETE: 'edge:delete',

  // File Entity
  FILE_CREATE: 'file:create',
  FILE_GET: 'file:get',
  FILE_GET_BY_PATH: 'file:getByPath',
  FILE_GET_BY_PROJECT: 'file:getByProject',
  FILE_UPDATE: 'file:update',
  FILE_DELETE: 'file:delete',

  // Module
  MODULE_CREATE: 'module:create',
  MODULE_LIST: 'module:list',
  MODULE_UPDATE: 'module:update',
  MODULE_DELETE: 'module:delete',

  // Module Directory
  MODULE_DIR_ADD: 'moduleDir:add',
  MODULE_DIR_LIST: 'moduleDir:list',
  MODULE_DIR_REMOVE: 'moduleDir:remove',
  MODULE_DIR_UPDATE_PATH: 'moduleDir:updatePath',

  // Schema
  SCHEMA_CREATE: 'schema:create',
  SCHEMA_LIST: 'schema:list',
  SCHEMA_GET: 'schema:get',
  SCHEMA_UPDATE: 'schema:update',
  SCHEMA_DELETE: 'schema:delete',

  // Schema Field
  SCHEMA_FIELD_CREATE: 'schemaField:create',
  SCHEMA_FIELD_LIST: 'schemaField:list',
  SCHEMA_FIELD_UPDATE: 'schemaField:update',
  SCHEMA_FIELD_DELETE: 'schemaField:delete',
  SCHEMA_FIELD_REORDER: 'schemaField:reorder',

  // RelationType
  RELATION_TYPE_CREATE: 'relationType:create',
  RELATION_TYPE_LIST: 'relationType:list',
  RELATION_TYPE_GET: 'relationType:get',
  RELATION_TYPE_UPDATE: 'relationType:update',
  RELATION_TYPE_DELETE: 'relationType:delete',

  // Type Group
  TYPE_GROUP_CREATE: 'typeGroup:create',
  TYPE_GROUP_LIST: 'typeGroup:list',
  TYPE_GROUP_UPDATE: 'typeGroup:update',
  TYPE_GROUP_DELETE: 'typeGroup:delete',

  // Concept Property
  CONCEPT_PROP_UPSERT: 'conceptProp:upsert',
  CONCEPT_PROP_GET_BY_CONCEPT: 'conceptProp:getByConcept',
  CONCEPT_PROP_DELETE: 'conceptProp:delete',

  // Editor Prefs
  EDITOR_PREFS_GET: 'editorPrefs:get',
  EDITOR_PREFS_UPSERT: 'editorPrefs:upsert',

  // File System
  FS_READ_DIR: 'fs:readDir',
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_OPEN_DIALOG: 'fs:openDialog',
  FS_DIR_CHANGED: 'fs:dirChanged',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',

  // Terminal
  TERMINAL_CREATE_INSTANCE: 'terminal:createInstance',
  TERMINAL_GET_SESSION: 'terminal:getSession',
  TERMINAL_ATTACH: 'terminal:attach',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_SHUTDOWN: 'terminal:shutdown',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_READY: 'terminal:ready',
  TERMINAL_EXIT: 'terminal:exit',
  TERMINAL_TITLE_CHANGED: 'terminal:titleChanged',
  TERMINAL_STATE_CHANGED: 'terminal:stateChanged',

  // Claude Code Integration
  CLAUDE_SESSION_EVENT: 'claude:sessionEvent',
  CLAUDE_STATUS_EVENT: 'claude:statusEvent',
  CLAUDE_NAME_CHANGED: 'claude:nameChanged',

  // Agent Runtime
  AGENT_GET_SNAPSHOT: 'agent:getSnapshot',
  AGENT_SESSION_EVENT: 'agent:sessionEvent',
  AGENT_STATUS_EVENT: 'agent:statusEvent',
  AGENT_NAME_CHANGED: 'agent:nameChanged',
  AGENT_TURN_EVENT: 'agent:turnEvent',
  AGENT_LIST_DEFINITIONS: 'agent:listDefinitions',
  AGENT_UPSERT_DEFINITION: 'agent:upsertDefinition',
  AGENT_DELETE_DEFINITION: 'agent:deleteDefinition',
  AGENT_UPSERT_SKILL: 'agent:upsertSkill',
  AGENT_DELETE_SKILL: 'agent:deleteSkill',

  // Narre
  NARRE_SEND_MESSAGE: 'narre:sendMessage',
  NARRE_LIST_SESSIONS: 'narre:listSessions',
  NARRE_LIST_SKILLS: 'narre:listSkills',
  NARRE_SUPERVISOR_LIST_AGENTS: 'narre:supervisorListAgents',
  NARRE_SUPERVISOR_LIST_SKILLS: 'narre:supervisorListSkills',
  NARRE_SUPERVISOR_LIST_SESSIONS: 'narre:supervisorListSessions',
  NARRE_SUPERVISOR_LIST_EVENTS: 'narre:supervisorListEvents',
  NARRE_GET_SESSION: 'narre:getSession',
  NARRE_CREATE_SESSION: 'narre:createSession',
  NARRE_DELETE_SESSION: 'narre:deleteSession',
  NARRE_STREAM_EVENT: 'narre:streamEvent',
  NARRE_SEARCH_MENTIONS: 'narre:searchMentions',
  NARRE_GET_API_KEY_STATUS: 'narre:getApiKeyStatus',
  NARRE_SET_API_KEY: 'narre:setApiKey',
  NARRE_RESPOND_CARD: 'narre:respondCard',
  NARRE_INTERRUPT_MESSAGE: 'narre:interruptMessage',
} as const;

// ============================================
// Defaults
// ============================================

export const DEFAULTS = {
  WINDOW_WIDTH: 1200,
  WINDOW_HEIGHT: 800,
} as const;

// ============================================
// Meaning Model
// ============================================

export interface MeaningSlotDefinition {
  key: MeaningSlotKey;
  fieldMeaning: FieldMeaningKey;
  bindings?: readonly FieldMeaningBindingKey[];
  category: SemanticCategoryKey;
  label: string;
  allowedFieldTypes: readonly FieldType[];
  constraintLevel: SlotConstraintLevel;
  multiValue?: boolean;
}

export interface MeaningBindingDefinition {
  key: MeaningBindingKey;
  scope: 'field' | 'relation';
  category: SemanticCategoryKey;
  label: string;
  description?: string;
  allowedFieldTypes?: readonly FieldType[];
  constraintLevel?: SlotConstraintLevel;
  multiValue?: boolean;
  impliedByFieldMeanings?: readonly FieldMeaningKey[];
}

export interface FieldMeaningBindingDefinition {
  key: FieldMeaningBindingKey;
  category: SemanticCategoryKey;
  label: string;
  description?: string;
  allowedFieldTypes?: readonly FieldType[];
  impliedByFieldMeanings?: readonly FieldMeaningKey[];
}

export interface SemanticMeaningDefinition {
  key: SemanticMeaningKey;
  category: SemanticCategoryKey;
  label: string;
  description?: string;
  coreSlots: readonly MeaningSlotKey[];
  optionalSlots: readonly MeaningSlotKey[];
  fallbackSlots?: readonly MeaningSlotKey[];
}

export interface ModelDefinition {
  key: ModelKey;
  category: SemanticCategoryKey;
  targetKind?: ModelTargetKind;
  label: string;
  description?: string;
  meanings: readonly SemanticMeaningKey[];
  coreSlots: readonly MeaningSlotKey[];
  optionalSlots: readonly MeaningSlotKey[];
  lineStyle?: EdgeLineStyle;
  directed?: boolean;
}

export const SEMANTIC_CATEGORY_LABELS: Readonly<Record<SemanticCategoryKey, string>> = {
  time: 'Time',
  workflow: 'Workflow',
  structure: 'Structure',
  knowledge: 'Knowledge',
  space: 'Space',
  quant: 'Quant',
  governance: 'Governance',
} as const;

export const MEANING_SLOT_DEFINITIONS: readonly MeaningSlotDefinition[] = [
  { key: 'start_at', fieldMeaning: 'time.start', category: 'time', label: 'Start At', allowedFieldTypes: ['date', 'datetime'], constraintLevel: 'strict' },
  { key: 'end_at', fieldMeaning: 'time.end', category: 'time', label: 'End At', allowedFieldTypes: ['date', 'datetime'], constraintLevel: 'strict' },
  { key: 'all_day', fieldMeaning: 'time.all_day', category: 'time', label: 'All Day', allowedFieldTypes: ['boolean'], constraintLevel: 'strict' },
  { key: 'timezone', fieldMeaning: 'time.timezone', category: 'time', label: 'Timezone', allowedFieldTypes: ['text', 'select'], constraintLevel: 'constrained' },
  { key: 'due_at', fieldMeaning: 'time.due', category: 'time', label: 'Due At', allowedFieldTypes: ['date', 'datetime'], constraintLevel: 'strict' },
  { key: 'recurrence_rule', fieldMeaning: 'time.recurrence_rule', category: 'time', label: 'Recurrence Rule', allowedFieldTypes: ['text'], constraintLevel: 'loose' },
  { key: 'recurrence_frequency', fieldMeaning: 'time.recurrence_frequency', category: 'time', label: 'Recurrence Frequency', allowedFieldTypes: ['select', 'radio'], constraintLevel: 'strict' },
  { key: 'recurrence_interval', fieldMeaning: 'time.recurrence_interval', category: 'time', label: 'Recurrence Interval', allowedFieldTypes: ['number'], constraintLevel: 'strict' },
  { key: 'recurrence_weekdays', fieldMeaning: 'time.recurrence_weekdays', category: 'time', label: 'Recurrence Weekdays', allowedFieldTypes: ['multi-select', 'tags'], constraintLevel: 'constrained', multiValue: true },
  { key: 'recurrence_monthday', fieldMeaning: 'time.recurrence_monthday', category: 'time', label: 'Recurrence Month Day', allowedFieldTypes: ['number'], constraintLevel: 'constrained' },
  { key: 'recurrence_until', fieldMeaning: 'time.recurrence_until', category: 'time', label: 'Recurrence Until', allowedFieldTypes: ['date', 'datetime'], constraintLevel: 'constrained' },
  { key: 'recurrence_count', fieldMeaning: 'time.recurrence_count', category: 'time', label: 'Recurrence Count', allowedFieldTypes: ['number'], constraintLevel: 'constrained' },
  { key: 'status', fieldMeaning: 'workflow.status', category: 'workflow', label: 'Status', allowedFieldTypes: ['select', 'radio', 'text'], constraintLevel: 'constrained' },
  { key: 'status_changed_at', fieldMeaning: 'workflow.status_changed_at', category: 'workflow', label: 'Status Changed At', allowedFieldTypes: ['datetime'], constraintLevel: 'constrained' },
  { key: 'assignee_refs', fieldMeaning: 'workflow.assignees', category: 'workflow', label: 'Assignees', allowedFieldTypes: ['multi-select', 'tags'], constraintLevel: 'loose', multiValue: true },
  { key: 'primary_assignee_ref', fieldMeaning: 'workflow.primary_assignee', category: 'workflow', label: 'Primary Assignee', allowedFieldTypes: ['select', 'relation', 'schema_ref'], constraintLevel: 'constrained' },
  { key: 'priority', fieldMeaning: 'workflow.priority', category: 'workflow', label: 'Priority', allowedFieldTypes: ['number', 'select', 'radio'], constraintLevel: 'constrained' },
  { key: 'progress_ratio', fieldMeaning: 'workflow.progress', category: 'workflow', label: 'Progress Ratio', allowedFieldTypes: ['number', 'rating'], constraintLevel: 'constrained' },
  { key: 'completed_at', fieldMeaning: 'workflow.completed_at', category: 'workflow', label: 'Completed At', allowedFieldTypes: ['date', 'datetime'], constraintLevel: 'constrained' },
  { key: 'estimate_value', fieldMeaning: 'workflow.estimate_value', category: 'workflow', label: 'Estimate Value', allowedFieldTypes: ['number'], constraintLevel: 'constrained' },
  { key: 'estimate_unit', fieldMeaning: 'workflow.estimate_unit', category: 'workflow', label: 'Estimate Unit', allowedFieldTypes: ['select', 'radio', 'text'], constraintLevel: 'constrained' },
  { key: 'actual_value', fieldMeaning: 'workflow.actual_value', category: 'workflow', label: 'Actual Value', allowedFieldTypes: ['number'], constraintLevel: 'constrained' },
  { key: 'parent_ref', fieldMeaning: 'structure.parent', category: 'structure', label: 'Parent', allowedFieldTypes: ['relation', 'schema_ref'], constraintLevel: 'strict' },
  { key: 'order_index', fieldMeaning: 'structure.order', category: 'structure', label: 'Order Index', allowedFieldTypes: ['number'], constraintLevel: 'strict' },
  { key: 'tag_keys', fieldMeaning: 'structure.tags', category: 'structure', label: 'Tags', allowedFieldTypes: ['tags', 'multi-select'], constraintLevel: 'constrained', multiValue: true },
  { key: 'category_key', fieldMeaning: 'structure.category', category: 'structure', label: 'Category', allowedFieldTypes: ['select', 'radio', 'text'], constraintLevel: 'constrained' },
  { key: 'source_url', fieldMeaning: 'knowledge.source_url', category: 'knowledge', label: 'Source URL', allowedFieldTypes: ['url', 'text'], constraintLevel: 'constrained' },
  { key: 'source_ref', fieldMeaning: 'knowledge.source_ref', category: 'knowledge', label: 'Source Ref', allowedFieldTypes: ['relation', 'schema_ref'], constraintLevel: 'constrained' },
  { key: 'citation', fieldMeaning: 'knowledge.citation', category: 'knowledge', label: 'Citation', allowedFieldTypes: ['text', 'textarea'], constraintLevel: 'loose' },
  { key: 'attachment_refs', fieldMeaning: 'knowledge.attachments', category: 'knowledge', label: 'Attachments', allowedFieldTypes: ['file', 'multi-select', 'tags'], constraintLevel: 'loose', multiValue: true },
  { key: 'version', fieldMeaning: 'knowledge.version', category: 'knowledge', label: 'Version', allowedFieldTypes: ['text'], constraintLevel: 'constrained' },
  { key: 'revision', fieldMeaning: 'knowledge.revision', category: 'knowledge', label: 'Revision', allowedFieldTypes: ['text'], constraintLevel: 'constrained' },
  { key: 'supersedes_ref', fieldMeaning: 'knowledge.supersedes', category: 'knowledge', label: 'Supersedes', allowedFieldTypes: ['relation', 'schema_ref'], constraintLevel: 'constrained' },
  { key: 'place_ref', fieldMeaning: 'space.place', category: 'space', label: 'Place', allowedFieldTypes: ['relation', 'schema_ref'], constraintLevel: 'constrained' },
  { key: 'address', fieldMeaning: 'space.address', category: 'space', label: 'Address', allowedFieldTypes: ['text', 'textarea'], constraintLevel: 'loose' },
  { key: 'lat', fieldMeaning: 'space.lat', category: 'space', label: 'Latitude', allowedFieldTypes: ['number'], constraintLevel: 'strict' },
  { key: 'lng', fieldMeaning: 'space.lng', category: 'space', label: 'Longitude', allowedFieldTypes: ['number'], constraintLevel: 'strict' },
  { key: 'measure_value', fieldMeaning: 'quant.measure_value', category: 'quant', label: 'Measure Value', allowedFieldTypes: ['number', 'rating'], constraintLevel: 'constrained' },
  { key: 'measure_unit', fieldMeaning: 'quant.measure_unit', category: 'quant', label: 'Measure Unit', allowedFieldTypes: ['text', 'select'], constraintLevel: 'constrained' },
  { key: 'target_value', fieldMeaning: 'quant.target_value', category: 'quant', label: 'Target Value', allowedFieldTypes: ['number'], constraintLevel: 'constrained' },
  { key: 'budget_amount', fieldMeaning: 'quant.budget_amount', category: 'quant', label: 'Budget Amount', allowedFieldTypes: ['number'], constraintLevel: 'constrained' },
  { key: 'budget_currency', fieldMeaning: 'quant.budget_currency', category: 'quant', label: 'Budget Currency', allowedFieldTypes: ['text', 'select'], constraintLevel: 'constrained' },
  { key: 'budget_limit', fieldMeaning: 'quant.budget_limit', category: 'quant', label: 'Budget Limit', allowedFieldTypes: ['number'], constraintLevel: 'constrained' },
  { key: 'owner_ref', fieldMeaning: 'governance.owner', category: 'governance', label: 'Owner', allowedFieldTypes: ['relation', 'schema_ref', 'select'], constraintLevel: 'constrained' },
  { key: 'approval_state', fieldMeaning: 'governance.approval_state', category: 'governance', label: 'Approval State', allowedFieldTypes: ['select', 'radio', 'text'], constraintLevel: 'constrained' },
  { key: 'approved_by_ref', fieldMeaning: 'governance.approved_by', category: 'governance', label: 'Approved By', allowedFieldTypes: ['relation', 'schema_ref', 'select'], constraintLevel: 'constrained' },
  { key: 'approved_at', fieldMeaning: 'governance.approved_at', category: 'governance', label: 'Approved At', allowedFieldTypes: ['datetime'], constraintLevel: 'constrained' },
] as const;

export const SEMANTIC_MEANING_DEFINITIONS: readonly SemanticMeaningDefinition[] = [
  { key: 'time_interval', category: 'time', label: 'Time Interval', description: 'Places the object on a time axis.', coreSlots: ['start_at'], optionalSlots: ['end_at', 'all_day', 'timezone'] },
  { key: 'deadline', category: 'time', label: 'Deadline', description: 'Gives the object a due point.', coreSlots: ['due_at'], optionalSlots: ['timezone'] },
  { key: 'recurrence', category: 'time', label: 'Recurrence', description: 'Lets the object repeat by structured cadence.', coreSlots: ['recurrence_frequency', 'recurrence_interval'], optionalSlots: ['recurrence_weekdays', 'recurrence_monthday', 'recurrence_until', 'recurrence_count'], fallbackSlots: ['recurrence_rule'] },
  { key: 'workflow_state', category: 'workflow', label: 'Workflow State', coreSlots: ['status'], optionalSlots: ['status_changed_at'] },
  { key: 'assignment', category: 'workflow', label: 'Assignment', coreSlots: ['assignee_refs'], optionalSlots: ['primary_assignee_ref'] },
  { key: 'priority', category: 'workflow', label: 'Priority', coreSlots: ['priority'], optionalSlots: [] },
  { key: 'progress', category: 'workflow', label: 'Progress', coreSlots: ['progress_ratio'], optionalSlots: ['completed_at'] },
  { key: 'estimate', category: 'workflow', label: 'Estimate', coreSlots: ['estimate_value'], optionalSlots: ['estimate_unit', 'actual_value'] },
  { key: 'hierarchy', category: 'structure', label: 'Hierarchy', coreSlots: ['parent_ref'], optionalSlots: ['order_index'] },
  { key: 'ordering', category: 'structure', label: 'Ordering', coreSlots: ['order_index'], optionalSlots: [] },
  { key: 'tagging', category: 'structure', label: 'Tagging', coreSlots: ['tag_keys'], optionalSlots: [] },
  { key: 'classification', category: 'structure', label: 'Classification', coreSlots: ['category_key'], optionalSlots: [] },
  { key: 'source', category: 'knowledge', label: 'Source', coreSlots: ['source_url'], optionalSlots: ['source_ref', 'citation'] },
  { key: 'attachment', category: 'knowledge', label: 'Attachment', coreSlots: ['attachment_refs'], optionalSlots: [] },
  { key: 'versioning', category: 'knowledge', label: 'Versioning', coreSlots: ['version'], optionalSlots: ['revision', 'supersedes_ref'] },
  { key: 'location', category: 'space', label: 'Location', coreSlots: ['place_ref'], optionalSlots: ['address', 'lat', 'lng'] },
  { key: 'measurement', category: 'quant', label: 'Measurement', coreSlots: ['measure_value'], optionalSlots: ['measure_unit', 'target_value'] },
  { key: 'budget', category: 'quant', label: 'Budget', coreSlots: ['budget_amount'], optionalSlots: ['budget_currency', 'budget_limit'] },
  { key: 'ownership', category: 'governance', label: 'Ownership', coreSlots: ['owner_ref'], optionalSlots: [] },
  { key: 'approval', category: 'governance', label: 'Approval', coreSlots: ['approval_state'], optionalSlots: ['approved_by_ref', 'approved_at'] },
] as const;

export const MODEL_DEFINITIONS: readonly ModelDefinition[] = [
  { key: 'temporal', category: 'time', label: 'Temporal', description: 'Represents objects that occupy time with a start point and optional end context.', meanings: ['time_interval'], coreSlots: ['start_at'], optionalSlots: ['end_at', 'all_day', 'timezone'] },
  { key: 'dueable', category: 'time', label: 'Dueable', description: 'Represents objects that have one deadline or due point.', meanings: ['deadline'], coreSlots: ['due_at'], optionalSlots: [] },
  { key: 'recurring', category: 'time', label: 'Recurring', description: 'Represents objects that repeat through frequency, interval, calendar constraints, and end conditions.', meanings: ['recurrence'], coreSlots: ['recurrence_frequency', 'recurrence_interval'], optionalSlots: ['recurrence_weekdays', 'recurrence_monthday', 'recurrence_until', 'recurrence_count'] },
  { key: 'statusful', category: 'workflow', label: 'Statusful', description: 'Represents objects whose workflow state can be read by boards, lists, and filters.', meanings: ['workflow_state'], coreSlots: ['status'], optionalSlots: ['status_changed_at'] },
  { key: 'assignable', category: 'workflow', label: 'Assignable', description: 'Represents objects that can be assigned to one or more responsible actors.', meanings: ['assignment'], coreSlots: ['assignee_refs'], optionalSlots: ['primary_assignee_ref'] },
  { key: 'prioritizable', category: 'workflow', label: 'Prioritizable', description: 'Represents objects that carry a priority value for ranking and triage.', meanings: ['priority'], coreSlots: ['priority'], optionalSlots: [] },
  { key: 'progressable', category: 'workflow', label: 'Progressable', description: 'Represents objects with measurable progress and completion timing.', meanings: ['progress'], coreSlots: ['progress_ratio'], optionalSlots: ['completed_at'] },
  { key: 'estimable', category: 'workflow', label: 'Estimable', description: 'Represents objects with estimated and actual effort, cost, or resource values.', meanings: ['estimate'], coreSlots: ['estimate_value'], optionalSlots: ['estimate_unit', 'actual_value'] },
  { key: 'hierarchical', category: 'structure', label: 'Hierarchical', description: 'Represents objects arranged in parent-child structures.', meanings: ['hierarchy'], coreSlots: ['parent_ref'], optionalSlots: ['order_index'] },
  { key: 'ordered', category: 'structure', label: 'Ordered', description: 'Represents objects with an explicit manual sort position.', meanings: ['ordering'], coreSlots: ['order_index'], optionalSlots: [] },
  { key: 'taggable', category: 'structure', label: 'Taggable', description: 'Represents objects classified by a lightweight set of tags.', meanings: ['tagging'], coreSlots: ['tag_keys'], optionalSlots: [] },
  { key: 'categorizable', category: 'structure', label: 'Categorizable', description: 'Represents objects classified by one category or taxonomy key.', meanings: ['classification'], coreSlots: ['category_key'], optionalSlots: [] },
  { key: 'sourceable', category: 'knowledge', label: 'Sourceable', description: 'Represents objects that can cite where their information came from.', meanings: ['source'], coreSlots: ['source_url'], optionalSlots: ['source_ref', 'citation'] },
  { key: 'attachable', category: 'knowledge', label: 'Attachable', description: 'Represents objects that can reference attached files or external assets.', meanings: ['attachment'], coreSlots: ['attachment_refs'], optionalSlots: [] },
  { key: 'versioned', category: 'knowledge', label: 'Versioned', description: 'Represents objects with version, revision, and supersession metadata.', meanings: ['versioning'], coreSlots: ['version'], optionalSlots: ['revision', 'supersedes_ref'] },
  { key: 'locatable', category: 'space', label: 'Locatable', description: 'Represents objects that can be placed by location, address, or coordinates.', meanings: ['location'], coreSlots: ['place_ref'], optionalSlots: ['address', 'lat', 'lng'] },
  { key: 'measurable', category: 'quant', label: 'Measurable', description: 'Represents objects with measured values, units, and optional targets.', meanings: ['measurement'], coreSlots: ['measure_value'], optionalSlots: ['measure_unit', 'target_value'] },
  { key: 'budgeted', category: 'quant', label: 'Budgeted', description: 'Represents objects with budget amount, currency, and limit metadata.', meanings: ['budget'], coreSlots: ['budget_amount'], optionalSlots: ['budget_currency', 'budget_limit'] },
  { key: 'ownable', category: 'governance', label: 'Ownable', description: 'Represents objects with an accountable owner.', meanings: ['ownership'], coreSlots: ['owner_ref'], optionalSlots: [] },
  { key: 'approvable', category: 'governance', label: 'Approvable', description: 'Represents objects with approval state, approver, and approval time.', meanings: ['approval'], coreSlots: ['approval_state'], optionalSlots: ['approved_by_ref', 'approved_at'] },
  { key: 'contains_relation', category: 'structure', targetKind: 'edge', label: 'Contains', description: 'Represents containment, composition, or membership between two nodes.', meanings: [], coreSlots: [], optionalSlots: [], lineStyle: 'solid', directed: true },
  { key: 'entry_portal_relation', category: 'structure', targetKind: 'edge', label: 'Entry Portal', description: 'Marks the node that should open as the entry point for a contained structure.', meanings: [], coreSlots: [], optionalSlots: [], lineStyle: 'dashed', directed: true },
  { key: 'parent_relation', category: 'structure', targetKind: 'edge', label: 'Parent Relation', description: 'Represents a hierarchy parent-child relation between nodes.', meanings: [], coreSlots: [], optionalSlots: [], lineStyle: 'solid', directed: true },
] as const;

export const MEANING_SLOT_TO_FIELD_MEANING: Readonly<Record<MeaningSlotKey, FieldMeaningKey>> =
  Object.fromEntries(MEANING_SLOT_DEFINITIONS.map((definition) => [definition.key, definition.fieldMeaning])) as Record<MeaningSlotKey, FieldMeaningKey>;

export const FIELD_MEANING_TO_MEANING_SLOT: Readonly<Partial<Record<FieldMeaningKey, MeaningSlotKey>>> =
  Object.fromEntries(MEANING_SLOT_DEFINITIONS.map((definition) => [definition.fieldMeaning, definition.key])) as Partial<Record<FieldMeaningKey, MeaningSlotKey>>;

const FIELD_MEANING_BINDING_OVERRIDES: Readonly<Partial<Record<FieldMeaningKey, readonly FieldMeaningBindingKey[]>>> = {
  'time.start': ['time.start', 'temporal.point', 'temporal.boundary.start'],
  'time.end': ['time.end', 'temporal.point', 'temporal.boundary.end'],
  'time.due': ['time.due', 'temporal.point', 'temporal.deadline', 'obligation.due', 'boundary.deadline', 'consequence.trigger'],
  'time.recurrence_rule': ['time.recurrence_rule', 'temporal.recurrence', 'recurrence.compound_rule'],
  'time.recurrence_frequency': ['time.recurrence_frequency', 'temporal.recurrence', 'temporal.cadence'],
  'time.recurrence_interval': ['time.recurrence_interval', 'temporal.recurrence', 'temporal.interval'],
  'time.recurrence_weekdays': ['time.recurrence_weekdays', 'temporal.recurrence', 'calendar.weekday_set'],
  'time.recurrence_monthday': ['time.recurrence_monthday', 'temporal.recurrence', 'calendar.month_day'],
  'time.recurrence_until': ['time.recurrence_until', 'temporal.boundary.end'],
  'workflow.completed_at': ['workflow.completed_at', 'temporal.point', 'workflow.completion'],
  'structure.parent': ['structure.parent', 'relation.parent', 'structure.hierarchy'],
  'knowledge.source_url': ['knowledge.source_url', 'provenance.source'],
  'knowledge.source_ref': ['knowledge.source_ref', 'provenance.source', 'relation.citation'],
  'knowledge.citation': ['knowledge.citation', 'provenance.source'],
  'governance.owner': ['governance.owner', 'responsibility.accountable_agent'],
  'governance.approved_by': ['governance.approved_by', 'authority.approver'],
  'governance.approved_at': ['governance.approved_at', 'temporal.point', 'governance.approval_event'],
} as const;

function dedupeMeaningBindings(meanings: readonly FieldMeaningBindingKey[]): FieldMeaningBindingKey[] {
  return [...new Set(meanings)];
}

export const FIELD_MEANING_TO_MEANING_BINDINGS: Readonly<Record<FieldMeaningKey, readonly FieldMeaningBindingKey[]>> =
  Object.fromEntries(MEANING_SLOT_DEFINITIONS.map((definition) => [
    definition.fieldMeaning,
    dedupeMeaningBindings(FIELD_MEANING_BINDING_OVERRIDES[definition.fieldMeaning] ?? [definition.fieldMeaning]),
  ])) as unknown as Record<FieldMeaningKey, readonly FieldMeaningBindingKey[]>;

export const MEANING_BINDING_DEFINITIONS: readonly MeaningBindingDefinition[] = [
  ...MEANING_SLOT_DEFINITIONS.map((definition) => ({
    key: definition.fieldMeaning,
    scope: 'field' as const,
    category: definition.category,
    label: definition.label,
    allowedFieldTypes: definition.allowedFieldTypes,
    constraintLevel: definition.constraintLevel,
    multiValue: definition.multiValue,
  })),
] as const;

const EXTRA_FIELD_MEANING_BINDING_DEFINITIONS: readonly FieldMeaningBindingDefinition[] = [
  { key: 'temporal.point', category: 'time', label: 'Temporal Point', description: 'A point on a temporal axis.', allowedFieldTypes: ['date', 'datetime'] },
  { key: 'temporal.boundary.start', category: 'time', label: 'Temporal Start Boundary', allowedFieldTypes: ['date', 'datetime'] },
  { key: 'temporal.boundary.end', category: 'time', label: 'Temporal End Boundary', allowedFieldTypes: ['date', 'datetime'] },
  { key: 'temporal.deadline', category: 'time', label: 'Temporal Deadline', allowedFieldTypes: ['date', 'datetime'] },
  { key: 'obligation.due', category: 'workflow', label: 'Obligation Due', allowedFieldTypes: ['date', 'datetime'] },
  { key: 'boundary.deadline', category: 'structure', label: 'Deadline Boundary', allowedFieldTypes: ['date', 'datetime'] },
  { key: 'consequence.trigger', category: 'workflow', label: 'Consequence Trigger', allowedFieldTypes: ['date', 'datetime', 'boolean'] },
  { key: 'temporal.recurrence', category: 'time', label: 'Temporal Recurrence', allowedFieldTypes: ['select', 'radio', 'number', 'multi-select', 'tags'] },
  { key: 'temporal.cadence', category: 'time', label: 'Temporal Cadence', allowedFieldTypes: ['select', 'radio'] },
  { key: 'temporal.interval', category: 'time', label: 'Temporal Interval', allowedFieldTypes: ['number'] },
  { key: 'calendar.weekday_set', category: 'time', label: 'Calendar Weekday Set', allowedFieldTypes: ['multi-select', 'tags'] },
  { key: 'calendar.month_day', category: 'time', label: 'Calendar Month Day', allowedFieldTypes: ['number'] },
  { key: 'recurrence.compound_rule', category: 'time', label: 'Compound Recurrence Rule', allowedFieldTypes: ['text'] },
  { key: 'workflow.completion', category: 'workflow', label: 'Workflow Completion', allowedFieldTypes: ['date', 'datetime', 'boolean'] },
  { key: 'relation.parent', category: 'structure', label: 'Parent Relation', allowedFieldTypes: ['relation', 'schema_ref'] },
  { key: 'structure.hierarchy', category: 'structure', label: 'Hierarchy Structure', allowedFieldTypes: ['relation', 'schema_ref'] },
  { key: 'provenance.source', category: 'knowledge', label: 'Provenance Source', allowedFieldTypes: ['url', 'text', 'relation', 'schema_ref'] },
  { key: 'relation.citation', category: 'knowledge', label: 'Citation Relation', allowedFieldTypes: ['text', 'textarea', 'relation', 'schema_ref'] },
  { key: 'responsibility.accountable_agent', category: 'governance', label: 'Accountable Agent', allowedFieldTypes: ['relation', 'schema_ref', 'select'] },
  { key: 'authority.approver', category: 'governance', label: 'Approving Authority', allowedFieldTypes: ['relation', 'schema_ref', 'select'] },
  { key: 'governance.approval_event', category: 'governance', label: 'Approval Event', allowedFieldTypes: ['date', 'datetime'] },
] as const;

export const FIELD_MEANING_BINDING_DEFINITIONS: readonly FieldMeaningBindingDefinition[] = [
  ...MEANING_SLOT_DEFINITIONS.map((definition) => ({
    key: definition.fieldMeaning,
    category: definition.category,
    label: definition.label,
    allowedFieldTypes: definition.allowedFieldTypes,
    impliedByFieldMeanings: [definition.fieldMeaning],
  })),
  ...EXTRA_FIELD_MEANING_BINDING_DEFINITIONS,
] as const;

export function getMeaningSlotDefinition(slot: MeaningSlotKey): MeaningSlotDefinition | undefined {
  return MEANING_SLOT_DEFINITIONS.find((definition) => definition.key === slot);
}

export function getMeaningBindingDefinition(binding: MeaningBindingKey): MeaningBindingDefinition | undefined {
  return MEANING_BINDING_DEFINITIONS.find((definition) => definition.key === binding);
}

export function getFieldMeaningBindingDefinition(meaning: FieldMeaningBindingKey): FieldMeaningBindingDefinition | undefined {
  return FIELD_MEANING_BINDING_DEFINITIONS.find((definition) => definition.key === meaning);
}

export function getSemanticMeaningDefinition(meaning: SemanticMeaningKey): SemanticMeaningDefinition | undefined {
  return SEMANTIC_MEANING_DEFINITIONS.find((definition) => definition.key === meaning);
}

export function getSemanticMeaningForSlot(slot: MeaningSlotKey | null | undefined): SemanticMeaningDefinition | undefined {
  return slot ? SEMANTIC_MEANING_DEFINITIONS.find((definition) => (
    definition.coreSlots.includes(slot) || definition.optionalSlots.includes(slot) || definition.fallbackSlots?.includes(slot)
  )) : undefined;
}

export function meaningSlotToFieldMeaning(slot: MeaningSlotKey | null | undefined): FieldMeaningKey | null {
  return slot ? MEANING_SLOT_TO_FIELD_MEANING[slot] ?? null : null;
}

export function fieldMeaningToMeaningBindings(fieldMeaning: FieldMeaningKey | null | undefined): FieldMeaningBindingKey[] {
  return fieldMeaning ? [...(FIELD_MEANING_TO_MEANING_BINDINGS[fieldMeaning] ?? [fieldMeaning])] : [];
}

export function meaningSlotToMeaningBindings(slot: MeaningSlotKey | null | undefined): FieldMeaningBindingKey[] {
  return fieldMeaningToMeaningBindings(meaningSlotToFieldMeaning(slot));
}

export function fieldMeaningToMeaningSlot(fieldMeaning: FieldMeaningKey | null | undefined): MeaningSlotKey | null {
  return fieldMeaning ? FIELD_MEANING_TO_MEANING_SLOT[fieldMeaning] ?? null : null;
}

export function meaningBindingToMeaningSlot(meaning: FieldMeaningBindingKey | null | undefined): MeaningSlotKey | null {
  return fieldMeaningToMeaningSlot(meaning as FieldMeaningKey | null | undefined);
}

export function getModelDefinition(model: ModelKey): ModelDefinition | undefined {
  return MODEL_DEFINITIONS.find((definition) => definition.key === model);
}

export function getSemanticCategoryLabelKey(category: SemanticCategoryKey): string {
  return `semantic.category.${category}.label`;
}

export function getSemanticCategoryDescriptionKey(category: SemanticCategoryKey): string {
  return `semantic.category.${category}.description`;
}

export function getModelLabelKey(model: ModelKey): string {
  return `semantic.model.${model}.label`;
}

export function getModelDescriptionKey(model: ModelKey): string {
  return `semantic.model.${model}.description`;
}

export function getSemanticMeaningLabelKey(meaning: SemanticMeaningKey): string {
  return `semantic.meaning.${meaning}.label`;
}

export function getSemanticMeaningDescriptionKey(meaning: SemanticMeaningKey): string {
  return `semantic.meaning.${meaning}.description`;
}

export function getFieldMeaningLabelKey(fieldMeaning: FieldMeaningKey): string {
  return `semantic.fieldMeaning.${fieldMeaning}.label`;
}

export function getFieldMeaningDescriptionKey(fieldMeaning: FieldMeaningKey): string {
  return `semantic.fieldMeaning.${fieldMeaning}.description`;
}

export function getMeaningSlotLabelKey(slot: MeaningSlotKey): string {
  return `semantic.slot.${slot}.label`;
}

export function getMeaningSlotDescriptionKey(slot: MeaningSlotKey): string {
  return `semantic.slot.${slot}.description`;
}
