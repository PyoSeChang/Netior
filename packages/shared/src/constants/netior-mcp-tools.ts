import type {
  NetiorMcpToolSpec,
  NarreToolApprovalMode,
  NarreToolCategory,
  NarreToolKind,
  NarreToolMetadata,
  NetiorMcpToolProfile,
  NetiorMcpToolScope,
} from '../types/index.js';

type NetiorMcpToolSpecEntry = Omit<NetiorMcpToolSpec, 'key' | 'isMutation' | 'approvalMode'> & {
  isMutation?: boolean;
  approvalMode?: NarreToolApprovalMode;
};

export const NETIOR_MCP_TOOL_SPECS = {
  list_archetypes: {
    description: 'List all archetypes for a project',
    category: 'types',
    kind: 'query',
    profiles: ['discovery'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  create_archetype: {
    description: 'Create a new archetype for a project, including optional group, file template, and semantic traits',
    category: 'types',
    kind: 'mutation',
    scope: 'project',
    defaultProjectBinding: true,
  },
  update_archetype: {
    description: 'Update an existing archetype, including optional group, file template, and semantic traits',
    category: 'types',
    kind: 'mutation',
  },
  delete_archetype: {
    description: 'Delete an archetype',
    category: 'types',
    kind: 'mutation',
  },
  list_archetype_fields: {
    description: 'List field contracts for a specific archetype',
    category: 'types',
    kind: 'query',
  },
  create_archetype_field: {
    description: 'Create a field contract on an archetype. Use this for scalar fields, typed archetype references, choice-like fields, and slot-bound trait fields.',
    category: 'types',
    kind: 'mutation',
  },
  update_archetype_field: {
    description: 'Update an archetype field contract, including slot metadata and trait-generated flags',
    category: 'types',
    kind: 'mutation',
  },
  delete_archetype_field: {
    description: 'Delete an archetype field contract',
    category: 'types',
    kind: 'mutation',
  },
  reorder_archetype_fields: {
    description: 'Reorder field contracts within an archetype',
    category: 'types',
    kind: 'mutation',
  },
  list_concepts: {
    description: 'List or search concepts in a project. Supports title query, archetype narrowing, and property-based filters.',
    category: 'concepts',
    kind: 'query',
    scope: 'project',
    defaultProjectBinding: true,
  },
  create_concept: {
    description: 'Create a new concept in a project',
    category: 'concepts',
    kind: 'mutation',
    scope: 'project',
    defaultProjectBinding: true,
  },
  update_concept: {
    description: 'Update an existing concept',
    category: 'concepts',
    kind: 'mutation',
  },
  delete_concept: {
    description: 'Delete a concept',
    category: 'concepts',
    kind: 'mutation',
  },
  get_concept_properties: {
    description: 'Get the stored field values for a specific concept',
    category: 'concepts',
    kind: 'query',
  },
  upsert_concept_property: {
    description: 'Set or replace a concept property value for a specific field contract',
    category: 'concepts',
    kind: 'mutation',
  },
  delete_concept_property: {
    description: 'Delete a stored concept property value',
    category: 'concepts',
    kind: 'mutation',
  },
  create_edge: {
    description: 'Create an edge between two network nodes',
    category: 'graph',
    kind: 'mutation',
  },
  get_edge: {
    description: 'Get an edge by ID',
    category: 'graph',
    kind: 'query',
  },
  update_edge: {
    description: 'Update an edge relation type, system contract, or description',
    category: 'graph',
    kind: 'mutation',
  },
  delete_edge: {
    description: 'Delete an edge',
    category: 'graph',
    kind: 'mutation',
  },
  list_directory: {
    displayName: 'Browse Directory',
    description: 'List contents of a directory within registered module paths',
    category: 'files',
    kind: 'query',
    profiles: ['onboarding-skill'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  read_file: {
    displayName: 'Read File',
    description: 'Read contents of a file within registered module paths',
    category: 'files',
    kind: 'query',
    profiles: ['onboarding-skill'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  glob_files: {
    displayName: 'Find Files',
    description: 'Find files matching a glob pattern within registered module paths',
    category: 'search',
    kind: 'query',
    profiles: ['onboarding-skill'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  grep_files: {
    displayName: 'Search File Contents',
    description: 'Search file contents with a regex pattern within registered module paths',
    category: 'search',
    kind: 'analysis',
    profiles: ['onboarding-skill'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  list_modules: {
    description: 'List all modules for a project',
    category: 'modules',
    kind: 'query',
    profiles: ['discovery'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  get_field_candidates: {
    displayName: 'Suggest Field Options',
    description: 'Get candidate values or candidate concepts for a field contract. Use this before assigning relational or choice values.',
    category: 'types',
    kind: 'analysis',
    scope: 'project',
    defaultProjectBinding: true,
  },
  create_network_node: {
    description: 'Create a node in a network for an existing object record',
    category: 'graph',
    kind: 'mutation',
  },
  update_network_node: {
    description: 'Update a network node type, parent, or metadata',
    category: 'graph',
    kind: 'mutation',
  },
  delete_network_node: {
    description: 'Delete a network node',
    category: 'graph',
    kind: 'mutation',
  },
  list_networks: {
    description: 'List networks in a project',
    category: 'graph',
    kind: 'query',
    profiles: ['discovery'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  create_network: {
    description: 'Create a network for graph organization and navigation',
    category: 'graph',
    kind: 'mutation',
    scope: 'project',
    defaultProjectBinding: true,
  },
  update_network: {
    description: 'Update a network name, scope, or parent',
    category: 'graph',
    kind: 'mutation',
  },
  delete_network: {
    description: 'Delete a network',
    category: 'graph',
    kind: 'mutation',
  },
  get_network_full: {
    displayName: 'Inspect Network',
    description: 'Get a network with nodes, edges, objects, and layout references',
    category: 'graph',
    kind: 'query',
  },
  get_app_root_network: {
    description: 'Get the app root network',
    category: 'graph',
    kind: 'query',
    profiles: ['discovery'],
    scope: 'app',
  },
  get_project_root_network: {
    description: 'Get the root network for a project',
    category: 'graph',
    kind: 'query',
    profiles: ['discovery'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  get_network_tree: {
    displayName: 'Browse Network Tree',
    description: 'Get the network hierarchy tree for a project',
    category: 'graph',
    kind: 'query',
    profiles: ['discovery'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  get_network_ancestors: {
    description: 'Get breadcrumb ancestors for a network',
    category: 'graph',
    kind: 'query',
  },
  get_object: {
    displayName: 'Inspect Object',
    description: 'Get a network object record by object ID',
    category: 'graph',
    kind: 'query',
  },
  get_object_by_ref: {
    displayName: 'Find Object by Reference',
    description: 'Get a network object record from a domain object type and ref ID',
    category: 'graph',
    kind: 'query',
  },
  read_pdf_pages: {
    displayName: 'Read PDF Pages',
    description: 'Extract text from specified page range of a PDF file. Use this to read TOC pages for indexing.',
    category: 'files',
    kind: 'analysis',
    profiles: ['index-skill'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  read_pdf_pages_vision: {
    displayName: 'Read PDF with Vision',
    description: '[Experimental -- requires optional "canvas" npm package] Render PDF pages as images for vision-based TOC extraction. Will error if canvas is not installed. Not used by default prompts.',
    category: 'files',
    kind: 'analysis',
    profiles: ['index-skill'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  get_file_metadata: {
    displayName: 'Read File Metadata',
    description: 'Get a file entity and its metadata from the database. Use this to check if a PDF already has a TOC.',
    category: 'files',
    kind: 'query',
    profiles: ['index-skill'],
    scope: 'file',
  },
  update_file_pdf_toc: {
    displayName: 'Update PDF Table of Contents',
    description: 'Save or update the PDF table of contents for a file entity. Only call this after the user has approved the TOC.',
    category: 'files',
    kind: 'mutation',
    profiles: ['index-skill'],
    scope: 'file',
  },
  list_relation_types: {
    description: 'List all relation types for a project',
    category: 'types',
    kind: 'query',
    profiles: ['discovery'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  create_relation_type: {
    description: 'Create a new relation type for a project',
    category: 'types',
    kind: 'mutation',
  },
  update_relation_type: {
    description: 'Update an existing relation type',
    category: 'types',
    kind: 'mutation',
  },
  delete_relation_type: {
    description: 'Delete a relation type',
    category: 'types',
    kind: 'mutation',
  },
  get_project_summary: {
    displayName: 'Project Summary',
    description: 'Get a summary of a project including schema, relation, type-group, concept, and network context',
    category: 'project',
    kind: 'analysis',
    profiles: ['discovery'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  list_type_groups: {
    description: 'List type groups for archetypes or relation types in a project',
    category: 'types',
    kind: 'query',
    profiles: ['discovery'],
    scope: 'project',
    defaultProjectBinding: true,
  },
  create_type_group: {
    description: 'Create a folder-like type organization group for archetypes or relation types',
    category: 'types',
    kind: 'mutation',
    scope: 'project',
    defaultProjectBinding: true,
  },
  update_type_group: {
    description: 'Update a type group name, parent, or ordering',
    category: 'types',
    kind: 'mutation',
  },
  delete_type_group: {
    description: 'Delete a type group',
    category: 'types',
    kind: 'mutation',
  },
} as const satisfies Record<string, NetiorMcpToolSpecEntry>;

export type NetiorMcpToolKey = keyof typeof NETIOR_MCP_TOOL_SPECS;
export const DEFAULT_NETIOR_MCP_TOOL_PROFILE: NetiorMcpToolProfile = 'core';

function humanizeToolName(toolName: string): string {
  return toolName
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function inferToolCategory(toolName: string): NarreToolCategory {
  if (toolName.includes('archetype') || toolName.includes('relation_type') || toolName.includes('type_group') || toolName.includes('field')) {
    return 'types';
  }
  if (toolName.includes('concept')) {
    return 'concepts';
  }
  if (toolName.includes('network') || toolName.includes('edge') || toolName.includes('object') || toolName.includes('node')) {
    return 'graph';
  }
  if (toolName.includes('module')) {
    return 'modules';
  }
  if (toolName.includes('file') || toolName.includes('directory') || toolName.includes('pdf')) {
    return 'files';
  }
  if (toolName.includes('search') || toolName.includes('glob') || toolName.includes('grep')) {
    return 'search';
  }
  if (toolName.includes('project')) {
    return 'project';
  }
  return 'analysis';
}

function inferToolKind(toolName: string): NarreToolKind {
  if (/^(create|update|delete|upsert|reorder)_/.test(toolName)) {
    return 'mutation';
  }
  if (/^(read|list|get)_/.test(toolName)) {
    return 'query';
  }
  return 'analysis';
}

function inferToolScope(toolName: string): NetiorMcpToolScope {
  if (toolName === 'get_app_root_network') {
    return 'app';
  }
  if (toolName.includes('object')) {
    return 'object';
  }
  if (toolName.includes('network') || toolName.includes('edge') || toolName.includes('node')) {
    return 'network';
  }
  if (toolName.includes('file') || toolName.includes('pdf')) {
    return 'file';
  }
  if (
    toolName.includes('project')
    || toolName.includes('archetype')
    || toolName.includes('relation_type')
    || toolName.includes('type_group')
    || toolName.includes('concept')
    || toolName.includes('module')
  ) {
    return 'project';
  }
  return 'mixed';
}

function buildToolSpec(toolName: string, entry: NetiorMcpToolSpecEntry): NetiorMcpToolSpec {
  const isMutation = entry.isMutation ?? entry.kind === 'mutation';
  return {
    key: toolName,
    ...(entry.displayName ? { displayName: entry.displayName } : {}),
    description: entry.description,
    category: entry.category,
    kind: entry.kind,
    isMutation,
    approvalMode: entry.approvalMode ?? (isMutation ? 'prompt' : 'auto'),
    profiles: entry.profiles ?? [DEFAULT_NETIOR_MCP_TOOL_PROFILE],
    scope: entry.scope ?? inferToolScope(toolName),
    defaultProjectBinding: entry.defaultProjectBinding ?? false,
  };
}

export function normalizeNetiorToolName(toolName: string): string {
  const trimmed = toolName.trim();
  if (!trimmed) {
    return trimmed;
  }

  const lastSegment = trimmed.split('.').at(-1) ?? trimmed;
  return lastSegment.trim();
}

export function hasNetiorMcpToolSpec(toolName: string): toolName is NetiorMcpToolKey {
  return Object.prototype.hasOwnProperty.call(NETIOR_MCP_TOOL_SPECS, normalizeNetiorToolName(toolName));
}

export function getNetiorMcpToolSpec(toolName: NetiorMcpToolKey): NetiorMcpToolSpec;
export function getNetiorMcpToolSpec(toolName: string): NetiorMcpToolSpec | null;
export function getNetiorMcpToolSpec(toolName: string): NetiorMcpToolSpec | null {
  const normalizedToolName = normalizeNetiorToolName(toolName);
  if (!hasNetiorMcpToolSpec(normalizedToolName)) {
    return null;
  }

  return buildToolSpec(normalizedToolName, NETIOR_MCP_TOOL_SPECS[normalizedToolName]);
}

export function listNetiorMcpToolSpecs(): NetiorMcpToolSpec[] {
  return Object.entries(NETIOR_MCP_TOOL_SPECS).map(([toolName, entry]) => buildToolSpec(toolName, entry));
}

export function isNetiorMcpToolEnabledForProfile(toolName: string, profile: NetiorMcpToolProfile): boolean {
  const spec = getNetiorMcpToolSpec(toolName);
  if (!spec) {
    return false;
  }

  const profiles = spec.profiles ?? [DEFAULT_NETIOR_MCP_TOOL_PROFILE];
  return profiles.includes(profile);
}

export function getNarreToolMetadata(toolName: string): NarreToolMetadata {
  const normalizedToolName = normalizeNetiorToolName(toolName);
  const spec = getNetiorMcpToolSpec(normalizedToolName);
  if (spec) {
    return {
      displayName: spec.displayName ?? humanizeToolName(spec.key),
      description: spec.description,
      category: spec.category,
      kind: spec.kind,
      isMutation: spec.isMutation,
      approvalMode: spec.approvalMode,
      profiles: spec.profiles,
      scope: spec.scope,
      defaultProjectBinding: spec.defaultProjectBinding,
    };
  }

  const kind = inferToolKind(normalizedToolName);
  return {
    displayName: humanizeToolName(normalizedToolName),
    category: inferToolCategory(normalizedToolName),
    kind,
    isMutation: kind === 'mutation',
    approvalMode: kind === 'mutation' ? 'prompt' : 'auto',
    profiles: [DEFAULT_NETIOR_MCP_TOOL_PROFILE],
    scope: inferToolScope(normalizedToolName),
    defaultProjectBinding: false,
  };
}
