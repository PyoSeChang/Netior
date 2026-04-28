import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createNetworkNode,
  deleteNetworkNode,
  getNetworkNode,
  updateNetworkNode,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';

const nodeTypeSchema = z.enum(['basic', 'portal', 'group', 'hierarchy']);
const nodeSortDirectionSchema = z.enum(['asc', 'desc']);
const nodeSortEmptyPlacementSchema = z.enum(['first', 'last']);
const NODE_CONFIG_METADATA_KEY = 'nodeConfig';

const nodeSortConfigSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('meaning_binding'),
    meaning: z.string().describe('Meaning binding key to sort by, such as time.due or temporal.deadline'),
    direction: nodeSortDirectionSchema.optional().describe('Sort direction'),
    emptyPlacement: nodeSortEmptyPlacementSchema.optional().describe('Where empty values should be placed'),
  }),
  z.object({
    kind: z.literal('property'),
    fieldId: z.string().describe('Schema field ID to sort by'),
    direction: nodeSortDirectionSchema.optional().describe('Sort direction'),
    emptyPlacement: nodeSortEmptyPlacementSchema.optional().describe('Where empty values should be placed'),
  }),
]);

const nodeConfigSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('freeform'),
  }),
  z.object({
    kind: z.literal('grid'),
    columns: z.number().int().min(1).optional().describe('Grid column count'),
    gapX: z.number().min(0).optional().describe('Horizontal gap between items'),
    gapY: z.number().min(0).optional().describe('Vertical gap between items'),
    padding: z.number().min(0).optional().describe('Inner padding'),
    itemWidth: z.number().min(1).optional().describe('Preferred child item width'),
    itemHeight: z.number().min(1).optional().describe('Preferred child item height'),
    sort: nodeSortConfigSchema.nullable().optional().describe('Optional child sort configuration'),
  }),
  z.object({
    kind: z.literal('list'),
    gap: z.number().min(0).optional().describe('Vertical gap between items'),
    padding: z.number().min(0).optional().describe('Inner padding'),
    itemHeight: z.number().min(1).optional().describe('Preferred child item height'),
    sort: nodeSortConfigSchema.nullable().optional().describe('Optional child sort configuration'),
  }),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseMetadataObject(raw: string | null | undefined, label: string): Record<string, unknown> {
  if (raw == null || raw.trim() === '') {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} must be valid JSON object text: ${(error as Error).message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`${label} must decode to a JSON object`);
  }

  return { ...parsed };
}

function stringifyMetadataObject(metadata: Record<string, unknown>): string | null {
  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata, null, 2) : null;
}

function buildNodeMetadata(params: {
  existingMetadata?: string | null;
  metadata?: string | null;
  node_config?: z.infer<typeof nodeConfigSchema> | null;
}): string | null | undefined {
  const hasMetadata = params.metadata !== undefined;
  const hasNodeConfig = params.node_config !== undefined;

  if (!hasMetadata && !hasNodeConfig) {
    return undefined;
  }

  const base = hasMetadata
    ? parseMetadataObject(params.metadata, 'metadata')
    : parseMetadataObject(params.existingMetadata, 'existing node metadata');

  if (hasNodeConfig) {
    if (params.node_config === null) {
      delete base[NODE_CONFIG_METADATA_KEY];
    } else {
      base[NODE_CONFIG_METADATA_KEY] = params.node_config;
    }
  }

  return stringifyMetadataObject(base);
}

export function registerNetworkNodeTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'create_network_node',
    {
      network_id: z.string().describe('The network ID'),
      object_id: z.string().describe('The object record ID'),
      node_type: nodeTypeSchema.optional().describe('The node type'),
      parent_node_id: z.string().optional().describe('Optional parent node ID'),
      metadata: z.string().nullable().optional().describe('Raw node metadata JSON string. Prefer node_config for layout/sort changes.'),
      node_config: nodeConfigSchema.optional().describe('Structured node config stored at metadata.nodeConfig. Use this for group node layout and sort settings.'),
    },
    async ({ network_id, object_id, node_type, parent_node_id, metadata, node_config }) => {
      try {
        const mergedMetadata = buildNodeMetadata({ metadata, node_config });
        const result = await createNetworkNode({
          network_id,
          object_id,
          node_type,
          parent_node_id,
          ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
        });
        emitChange({ type: 'networkNode', action: 'create', id: result.id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  registerNetiorTool(
    server,
    'update_network_node',
    {
      node_id: z.string().describe('The network node ID'),
      node_type: nodeTypeSchema.optional().describe('New node type'),
      parent_node_id: z.string().nullable().optional().describe('Parent node ID or null'),
      metadata: z.string().nullable().optional().describe('Raw node metadata JSON string or null. Prefer node_config for layout/sort changes.'),
      node_config: nodeConfigSchema.nullable().optional().describe('Structured node config stored at metadata.nodeConfig. Pass null to remove existing nodeConfig.'),
    },
    async ({ node_id, node_type, parent_node_id, metadata, node_config }) => {
      try {
        const existingNode = node_config !== undefined && metadata === undefined
          ? await getNetworkNode(node_id)
          : null;

        if (node_config !== undefined && metadata === undefined && !existingNode) {
          return {
            content: [{ type: 'text' as const, text: `Error: Network node not found: ${node_id}` }],
            isError: true,
          };
        }

        const mergedMetadata = buildNodeMetadata({
          existingMetadata: existingNode?.metadata,
          metadata,
          node_config,
        });
        const result = await updateNetworkNode(node_id, {
          node_type,
          parent_node_id,
          ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
        });
        emitChange({ type: 'networkNode', action: 'update', id: node_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  registerNetiorTool(
    server,
    'delete_network_node',
    { node_id: z.string().describe('The network node ID') },
    async ({ node_id }) => {
      try {
        const deleted = await deleteNetworkNode(node_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Network node not found: ${node_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'networkNode', action: 'delete', id: node_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: node_id }) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
