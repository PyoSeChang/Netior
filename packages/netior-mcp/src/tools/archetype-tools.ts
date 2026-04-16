import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SEMANTIC_TRAIT_DEFINITIONS } from '@netior/shared/constants';
import type { SemanticTraitKey } from '@netior/shared/types';
import {
  listArchetypes,
  createArchetype,
  updateArchetype,
  deleteArchetype,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';

const semanticTraitKeys = new Set(SEMANTIC_TRAIT_DEFINITIONS.map((definition) => definition.key));
const semanticTraitsSchema = z.array(z.string()).refine(
  (values) => values.every((value) => semanticTraitKeys.has(value as never)),
  'Invalid semantic trait key',
);

export function registerArchetypeTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_archetypes',
    { project_id: projectIdSchema() },
    async ({ project_id }) => {
      try {
        const result = await listArchetypes(resolveProjectId(project_id));
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
    'create_archetype',
    {
      project_id: projectIdSchema(),
      group_id: z.string().nullable().optional().describe('Optional archetype group ID or null'),
      name: z.string().describe('Archetype name'),
      icon: z.string().optional().describe('Icon identifier'),
      color: z.string().optional().describe('Color value'),
      node_shape: z.string().optional().describe('Node shape for network rendering'),
      description: z.string().optional().describe('Archetype description'),
      file_template: z.string().nullable().optional().describe('Optional file template for new concepts'),
      semantic_traits: semanticTraitsSchema.optional().describe('Optional semantic trait keys'),
    },
    async ({ project_id, group_id, name, icon, color, node_shape, description, file_template, semantic_traits }) => {
      try {
        const result = await createArchetype({
          project_id: resolveProjectId(project_id),
          group_id,
          name,
          icon,
          color,
          node_shape,
          description,
          file_template: file_template ?? undefined,
          semantic_traits: semantic_traits as SemanticTraitKey[] | undefined,
        });
        emitChange({ type: 'archetype', action: 'create', id: result.id });
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
    'update_archetype',
    {
      archetype_id: z.string().describe('The archetype ID to update'),
      group_id: z.string().nullable().optional().describe('New group ID or null'),
      name: z.string().optional().describe('New name'),
      icon: z.string().optional().describe('New icon identifier'),
      color: z.string().optional().describe('New color value'),
      node_shape: z.string().optional().describe('New node shape'),
      description: z.string().optional().describe('New description'),
      file_template: z.string().nullable().optional().describe('New file template or null'),
      semantic_traits: semanticTraitsSchema.optional().describe('New semantic trait keys'),
    },
    async ({ archetype_id, group_id, name, icon, color, node_shape, description, file_template, semantic_traits }) => {
      try {
        const result = await updateArchetype(archetype_id, {
          group_id,
          name,
          icon,
          color,
          node_shape,
          description,
          file_template,
          semantic_traits: semantic_traits as SemanticTraitKey[] | undefined,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Archetype not found: ${archetype_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'archetype', action: 'update', id: archetype_id });
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
    'delete_archetype',
    { archetype_id: z.string().describe('The archetype ID to delete') },
    async ({ archetype_id }) => {
      try {
        const deleted = await deleteArchetype(archetype_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Archetype not found: ${archetype_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'archetype', action: 'delete', id: archetype_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: archetype_id }) }],
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
