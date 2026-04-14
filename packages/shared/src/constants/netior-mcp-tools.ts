import type {
  NetiorMcpToolSpec,
  NarreToolCategory,
  NarreToolKind,
  NarreToolMetadata,
} from '../types/index.js';

type NetiorMcpToolSpecEntry = Omit<NetiorMcpToolSpec, 'key' | 'isMutation'> & {
  isMutation?: boolean;
};

export const NETIOR_MCP_TOOL_SPECS = {
  list_archetypes: {
    description: 'List all archetypes for a project',
    category: 'types',
    kind: 'query',
  },
  create_archetype: {
    description: 'Create a new archetype for a project',
    category: 'types',
    kind: 'mutation',
  },
  update_archetype: {
    description: 'Update an existing archetype',
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
    description: 'Create a field contract on an archetype. Use this for scalar fields, typed archetype references, and choice-like fields.',
    category: 'types',
    kind: 'mutation',
  },
  update_archetype_field: {
    description: 'Update an archetype field contract',
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
    description: 'List or search concepts in a project. If query is provided, searches by title; otherwise returns all concepts.',
    category: 'concepts',
    kind: 'query',
  },
  create_concept: {
    description: 'Create a new concept in a project',
    category: 'concepts',
    kind: 'mutation',
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
  },
  read_file: {
    displayName: 'Read File',
    description: 'Read contents of a file within registered module paths',
    category: 'files',
    kind: 'query',
  },
  glob_files: {
    displayName: 'Find Files',
    description: 'Find files matching a glob pattern within registered module paths',
    category: 'search',
    kind: 'query',
  },
  grep_files: {
    displayName: 'Search File Contents',
    description: 'Search file contents with a regex pattern within registered module paths',
    category: 'search',
    kind: 'analysis',
  },
  list_modules: {
    description: 'List all modules for a project',
    category: 'modules',
    kind: 'query',
  },
  get_field_candidates: {
    displayName: 'Suggest Field Options',
    description: 'Get candidate values or candidate concepts for a field contract. Use this before assigning relational or choice values.',
    category: 'types',
    kind: 'analysis',
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
  },
  create_network: {
    description: 'Create a network for graph organization and navigation',
    category: 'graph',
    kind: 'mutation',
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
  },
  get_project_root_network: {
    description: 'Get the root network for a project',
    category: 'graph',
    kind: 'query',
  },
  get_network_tree: {
    displayName: 'Browse Network Tree',
    description: 'Get the network hierarchy tree for a project',
    category: 'graph',
    kind: 'query',
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
  },
  read_pdf_pages_vision: {
    displayName: 'Read PDF with Vision',
    description: '[Experimental -- requires optional "canvas" npm package] Render PDF pages as images for vision-based TOC extraction. Will error if canvas is not installed. Not used by default prompts.',
    category: 'files',
    kind: 'analysis',
  },
  get_file_metadata: {
    displayName: 'Read File Metadata',
    description: 'Get a file entity and its metadata from the database. Use this to check if a PDF already has a TOC.',
    category: 'files',
    kind: 'query',
  },
  update_file_pdf_toc: {
    displayName: 'Update PDF Table of Contents',
    description: 'Save or update the PDF table of contents for a file entity. Only call this after the user has approved the TOC.',
    category: 'files',
    kind: 'mutation',
  },
  list_relation_types: {
    description: 'List all relation types for a project',
    category: 'types',
    kind: 'query',
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
  },
  list_type_groups: {
    description: 'List type groups for archetypes or relation types in a project',
    category: 'types',
    kind: 'query',
  },
  create_type_group: {
    description: 'Create a folder-like type organization group for archetypes or relation types',
    category: 'types',
    kind: 'mutation',
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

function buildToolSpec(toolName: string, entry: NetiorMcpToolSpecEntry): NetiorMcpToolSpec {
  return {
    key: toolName,
    ...(entry.displayName ? { displayName: entry.displayName } : {}),
    description: entry.description,
    category: entry.category,
    kind: entry.kind,
    isMutation: entry.isMutation ?? entry.kind === 'mutation',
  };
}

export function hasNetiorMcpToolSpec(toolName: string): toolName is NetiorMcpToolKey {
  return Object.prototype.hasOwnProperty.call(NETIOR_MCP_TOOL_SPECS, toolName);
}

export function getNetiorMcpToolSpec(toolName: NetiorMcpToolKey): NetiorMcpToolSpec;
export function getNetiorMcpToolSpec(toolName: string): NetiorMcpToolSpec | null;
export function getNetiorMcpToolSpec(toolName: string): NetiorMcpToolSpec | null {
  if (!hasNetiorMcpToolSpec(toolName)) {
    return null;
  }

  return buildToolSpec(toolName, NETIOR_MCP_TOOL_SPECS[toolName]);
}

export function listNetiorMcpToolSpecs(): NetiorMcpToolSpec[] {
  return Object.entries(NETIOR_MCP_TOOL_SPECS).map(([toolName, entry]) => buildToolSpec(toolName, entry));
}

export function getNarreToolMetadata(toolName: string): NarreToolMetadata {
  const spec = getNetiorMcpToolSpec(toolName);
  if (spec) {
    return {
      displayName: spec.displayName ?? humanizeToolName(spec.key),
      description: spec.description,
      category: spec.category,
      kind: spec.kind,
      isMutation: spec.isMutation,
    };
  }

  const kind = inferToolKind(toolName);
  return {
    displayName: humanizeToolName(toolName),
    category: inferToolCategory(toolName),
    kind,
    isMutation: kind === 'mutation',
  };
}
