import type {
  FieldType,
  SemanticCategoryKey,
  SemanticTraitKey,
  SlashCommand,
  SlotContractLevel,
  SystemSlotKey,
} from '../types/index.js';
export * from './netior-mcp-tools.js';

// ============================================
// Slash Commands
// ============================================

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: 'onboarding',
    description: 'narre.command.onboarding',
    type: 'conversation',
    hint: 'narre.command.onboardingHint',
  },
  {
    name: 'index',
    description: 'narre.command.index',
    type: 'conversation',
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

  // Archetype
  ARCHETYPE_CREATE: 'archetype:create',
  ARCHETYPE_LIST: 'archetype:list',
  ARCHETYPE_GET: 'archetype:get',
  ARCHETYPE_UPDATE: 'archetype:update',
  ARCHETYPE_DELETE: 'archetype:delete',

  // Archetype Field
  ARCHETYPE_FIELD_CREATE: 'archetypeField:create',
  ARCHETYPE_FIELD_LIST: 'archetypeField:list',
  ARCHETYPE_FIELD_UPDATE: 'archetypeField:update',
  ARCHETYPE_FIELD_DELETE: 'archetypeField:delete',
  ARCHETYPE_FIELD_REORDER: 'archetypeField:reorder',

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

  // Narre
  NARRE_SEND_MESSAGE: 'narre:sendMessage',
  NARRE_LIST_SESSIONS: 'narre:listSessions',
  NARRE_GET_SESSION: 'narre:getSession',
  NARRE_CREATE_SESSION: 'narre:createSession',
  NARRE_DELETE_SESSION: 'narre:deleteSession',
  NARRE_STREAM_EVENT: 'narre:streamEvent',
  NARRE_SEARCH_MENTIONS: 'narre:searchMentions',
  NARRE_GET_API_KEY_STATUS: 'narre:getApiKeyStatus',
  NARRE_SET_API_KEY: 'narre:setApiKey',
  NARRE_EXECUTE_COMMAND: 'narre:executeCommand',
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
// System Semantics
// ============================================

export interface SystemSlotDefinition {
  key: SystemSlotKey;
  category: SemanticCategoryKey;
  label: string;
  allowedFieldTypes: readonly FieldType[];
  contractLevel: SlotContractLevel;
  multiValue?: boolean;
}

export interface SemanticTraitDefinition {
  key: SemanticTraitKey;
  category: SemanticCategoryKey;
  label: string;
  coreSlots: readonly SystemSlotKey[];
  optionalSlots: readonly SystemSlotKey[];
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

export const SYSTEM_SLOT_DEFINITIONS: readonly SystemSlotDefinition[] = [
  { key: 'start_at', category: 'time', label: 'Start At', allowedFieldTypes: ['date', 'datetime'], contractLevel: 'strict' },
  { key: 'end_at', category: 'time', label: 'End At', allowedFieldTypes: ['date', 'datetime'], contractLevel: 'strict' },
  { key: 'all_day', category: 'time', label: 'All Day', allowedFieldTypes: ['boolean'], contractLevel: 'strict' },
  { key: 'timezone', category: 'time', label: 'Timezone', allowedFieldTypes: ['text', 'select'], contractLevel: 'constrained' },
  { key: 'due_at', category: 'time', label: 'Due At', allowedFieldTypes: ['date', 'datetime'], contractLevel: 'strict' },
  { key: 'recurrence_rule', category: 'time', label: 'Recurrence Rule', allowedFieldTypes: ['text', 'select'], contractLevel: 'constrained' },
  { key: 'recurrence_until', category: 'time', label: 'Recurrence Until', allowedFieldTypes: ['date', 'datetime'], contractLevel: 'constrained' },
  { key: 'recurrence_count', category: 'time', label: 'Recurrence Count', allowedFieldTypes: ['number'], contractLevel: 'constrained' },
  { key: 'status', category: 'workflow', label: 'Status', allowedFieldTypes: ['select', 'radio', 'text'], contractLevel: 'constrained' },
  { key: 'status_changed_at', category: 'workflow', label: 'Status Changed At', allowedFieldTypes: ['datetime'], contractLevel: 'constrained' },
  { key: 'assignee_refs', category: 'workflow', label: 'Assignees', allowedFieldTypes: ['multi-select', 'tags'], contractLevel: 'loose', multiValue: true },
  { key: 'primary_assignee_ref', category: 'workflow', label: 'Primary Assignee', allowedFieldTypes: ['select', 'relation', 'archetype_ref'], contractLevel: 'constrained' },
  { key: 'priority', category: 'workflow', label: 'Priority', allowedFieldTypes: ['number', 'select', 'radio'], contractLevel: 'constrained' },
  { key: 'progress_ratio', category: 'workflow', label: 'Progress Ratio', allowedFieldTypes: ['number', 'rating'], contractLevel: 'constrained' },
  { key: 'completed_at', category: 'workflow', label: 'Completed At', allowedFieldTypes: ['date', 'datetime'], contractLevel: 'constrained' },
  { key: 'estimate_value', category: 'workflow', label: 'Estimate Value', allowedFieldTypes: ['number'], contractLevel: 'constrained' },
  { key: 'estimate_unit', category: 'workflow', label: 'Estimate Unit', allowedFieldTypes: ['select', 'radio', 'text'], contractLevel: 'constrained' },
  { key: 'actual_value', category: 'workflow', label: 'Actual Value', allowedFieldTypes: ['number'], contractLevel: 'constrained' },
  { key: 'parent_ref', category: 'structure', label: 'Parent', allowedFieldTypes: ['relation', 'archetype_ref'], contractLevel: 'strict' },
  { key: 'order_index', category: 'structure', label: 'Order Index', allowedFieldTypes: ['number'], contractLevel: 'strict' },
  { key: 'tag_keys', category: 'structure', label: 'Tags', allowedFieldTypes: ['tags', 'multi-select'], contractLevel: 'constrained', multiValue: true },
  { key: 'category_key', category: 'structure', label: 'Category', allowedFieldTypes: ['select', 'radio', 'text'], contractLevel: 'constrained' },
  { key: 'source_url', category: 'knowledge', label: 'Source URL', allowedFieldTypes: ['url', 'text'], contractLevel: 'constrained' },
  { key: 'source_ref', category: 'knowledge', label: 'Source Ref', allowedFieldTypes: ['relation', 'archetype_ref'], contractLevel: 'constrained' },
  { key: 'citation', category: 'knowledge', label: 'Citation', allowedFieldTypes: ['text', 'textarea'], contractLevel: 'loose' },
  { key: 'attachment_refs', category: 'knowledge', label: 'Attachments', allowedFieldTypes: ['file', 'multi-select', 'tags'], contractLevel: 'loose', multiValue: true },
  { key: 'version', category: 'knowledge', label: 'Version', allowedFieldTypes: ['text'], contractLevel: 'constrained' },
  { key: 'revision', category: 'knowledge', label: 'Revision', allowedFieldTypes: ['text'], contractLevel: 'constrained' },
  { key: 'supersedes_ref', category: 'knowledge', label: 'Supersedes', allowedFieldTypes: ['relation', 'archetype_ref'], contractLevel: 'constrained' },
  { key: 'place_ref', category: 'space', label: 'Place', allowedFieldTypes: ['relation', 'archetype_ref'], contractLevel: 'constrained' },
  { key: 'address', category: 'space', label: 'Address', allowedFieldTypes: ['text', 'textarea'], contractLevel: 'loose' },
  { key: 'lat', category: 'space', label: 'Latitude', allowedFieldTypes: ['number'], contractLevel: 'strict' },
  { key: 'lng', category: 'space', label: 'Longitude', allowedFieldTypes: ['number'], contractLevel: 'strict' },
  { key: 'measure_value', category: 'quant', label: 'Measure Value', allowedFieldTypes: ['number', 'rating'], contractLevel: 'constrained' },
  { key: 'measure_unit', category: 'quant', label: 'Measure Unit', allowedFieldTypes: ['text', 'select'], contractLevel: 'constrained' },
  { key: 'target_value', category: 'quant', label: 'Target Value', allowedFieldTypes: ['number'], contractLevel: 'constrained' },
  { key: 'budget_amount', category: 'quant', label: 'Budget Amount', allowedFieldTypes: ['number'], contractLevel: 'constrained' },
  { key: 'budget_currency', category: 'quant', label: 'Budget Currency', allowedFieldTypes: ['text', 'select'], contractLevel: 'constrained' },
  { key: 'budget_limit', category: 'quant', label: 'Budget Limit', allowedFieldTypes: ['number'], contractLevel: 'constrained' },
  { key: 'owner_ref', category: 'governance', label: 'Owner', allowedFieldTypes: ['relation', 'archetype_ref', 'select'], contractLevel: 'constrained' },
  { key: 'approval_state', category: 'governance', label: 'Approval State', allowedFieldTypes: ['select', 'radio', 'text'], contractLevel: 'constrained' },
  { key: 'approved_by_ref', category: 'governance', label: 'Approved By', allowedFieldTypes: ['relation', 'archetype_ref', 'select'], contractLevel: 'constrained' },
  { key: 'approved_at', category: 'governance', label: 'Approved At', allowedFieldTypes: ['datetime'], contractLevel: 'constrained' },
] as const;

export const SEMANTIC_TRAIT_DEFINITIONS: readonly SemanticTraitDefinition[] = [
  { key: 'temporal', category: 'time', label: 'Temporal', coreSlots: ['start_at'], optionalSlots: ['end_at', 'all_day', 'timezone'] },
  { key: 'dueable', category: 'time', label: 'Dueable', coreSlots: ['due_at'], optionalSlots: [] },
  { key: 'recurring', category: 'time', label: 'Recurring', coreSlots: ['recurrence_rule'], optionalSlots: ['recurrence_until', 'recurrence_count'] },
  { key: 'statusful', category: 'workflow', label: 'Statusful', coreSlots: ['status'], optionalSlots: ['status_changed_at'] },
  { key: 'assignable', category: 'workflow', label: 'Assignable', coreSlots: ['assignee_refs'], optionalSlots: ['primary_assignee_ref'] },
  { key: 'prioritizable', category: 'workflow', label: 'Prioritizable', coreSlots: ['priority'], optionalSlots: [] },
  { key: 'progressable', category: 'workflow', label: 'Progressable', coreSlots: ['progress_ratio'], optionalSlots: ['completed_at'] },
  { key: 'estimable', category: 'workflow', label: 'Estimable', coreSlots: ['estimate_value'], optionalSlots: ['estimate_unit', 'actual_value'] },
  { key: 'hierarchical', category: 'structure', label: 'Hierarchical', coreSlots: ['parent_ref'], optionalSlots: ['order_index'] },
  { key: 'ordered', category: 'structure', label: 'Ordered', coreSlots: ['order_index'], optionalSlots: [] },
  { key: 'taggable', category: 'structure', label: 'Taggable', coreSlots: ['tag_keys'], optionalSlots: [] },
  { key: 'categorizable', category: 'structure', label: 'Categorizable', coreSlots: ['category_key'], optionalSlots: [] },
  { key: 'sourceable', category: 'knowledge', label: 'Sourceable', coreSlots: ['source_url'], optionalSlots: ['source_ref', 'citation'] },
  { key: 'attachable', category: 'knowledge', label: 'Attachable', coreSlots: ['attachment_refs'], optionalSlots: [] },
  { key: 'versioned', category: 'knowledge', label: 'Versioned', coreSlots: ['version'], optionalSlots: ['revision', 'supersedes_ref'] },
  { key: 'locatable', category: 'space', label: 'Locatable', coreSlots: ['place_ref'], optionalSlots: ['address', 'lat', 'lng'] },
  { key: 'measurable', category: 'quant', label: 'Measurable', coreSlots: ['measure_value'], optionalSlots: ['measure_unit', 'target_value'] },
  { key: 'budgeted', category: 'quant', label: 'Budgeted', coreSlots: ['budget_amount'], optionalSlots: ['budget_currency', 'budget_limit'] },
  { key: 'ownable', category: 'governance', label: 'Ownable', coreSlots: ['owner_ref'], optionalSlots: [] },
  { key: 'approvable', category: 'governance', label: 'Approvable', coreSlots: ['approval_state'], optionalSlots: ['approved_by_ref', 'approved_at'] },
] as const;

export function getSystemSlotDefinition(slot: SystemSlotKey): SystemSlotDefinition | undefined {
  return SYSTEM_SLOT_DEFINITIONS.find((definition) => definition.key === slot);
}

export function getSemanticTraitDefinition(trait: SemanticTraitKey): SemanticTraitDefinition | undefined {
  return SEMANTIC_TRAIT_DEFINITIONS.find((definition) => definition.key === trait);
}

export function getSemanticCategoryLabelKey(category: SemanticCategoryKey): string {
  return `semantic.category.${category}.label`;
}

export function getSemanticCategoryDescriptionKey(category: SemanticCategoryKey): string {
  return `semantic.category.${category}.description`;
}

export function getSemanticTraitLabelKey(trait: SemanticTraitKey): string {
  return `semantic.trait.${trait}.label`;
}

export function getSemanticTraitDescriptionKey(trait: SemanticTraitKey): string {
  return `semantic.trait.${trait}.description`;
}

export function getSystemSlotLabelKey(slot: SystemSlotKey): string {
  return `semantic.slot.${slot}.label`;
}

export function getSystemSlotDescriptionKey(slot: SystemSlotKey): string {
  return `semantic.slot.${slot}.description`;
}
