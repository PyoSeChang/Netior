import type { SlashCommand } from '../types/index.js';

// ============================================
// Slash Commands
// ============================================

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: 'onboarding',
    description: 'narre.command.onboarding',
    type: 'conversation',
  },
  {
    name: 'index',
    description: 'narre.command.index',
    type: 'conversation',
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
  NETWORK_GET_BY_CONCEPT: 'network:getByConcept',
  NETWORK_GET_TREE: 'network:getTree',
  NETWORK_GET_ANCESTORS: 'network:getAncestors',

  // Network Node
  NETWORK_NODE_ADD: 'networkNode:add',
  NETWORK_NODE_UPDATE: 'networkNode:update',
  NETWORK_NODE_REMOVE: 'networkNode:remove',

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
} as const;

// ============================================
// Defaults
// ============================================

export const DEFAULTS = {
  NETWORK_ZOOM: 1.0,
  NETWORK_PAN_X: 0,
  NETWORK_PAN_Y: 0,
  WINDOW_WIDTH: 1200,
  WINDOW_HEIGHT: 800,
} as const;
