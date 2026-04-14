import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createTypeGroup,
  deleteTypeGroup,
  listTypeGroups,
  updateTypeGroup,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';

const typeGroupKindSchema = z.enum(['archetype', 'relation_type']);

export function registerTypeGroupTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_type_groups',
    {
      project_id: z.string().describe('The project ID'),
      kind: typeGroupKindSchema.describe('Whether to list archetype groups or relation type groups'),
    },
    async ({ project_id, kind }) => {
      try {
        const result = await listTypeGroups(project_id, kind);
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
    'create_type_group',
    {
      kind: typeGroupKindSchema.describe('The type-group kind'),
      name: z.string().describe('Group name'),
      project_id: z.string().nullable().optional().describe('Project ID or null for app-level scope'),
      scope: z.string().optional().describe('Optional explicit scope'),
      parent_group_id: z.string().optional().describe('Parent group ID'),
      sort_order: z.number().optional().describe('Group order index'),
    },
    async ({ kind, name, project_id, scope, parent_group_id, sort_order }) => {
      try {
        const result = await createTypeGroup({
          kind,
          name,
          project_id: project_id ?? null,
          scope,
          parent_group_id,
          sort_order,
        });
        emitChange({ type: 'typeGroup', action: 'create', id: result.id });
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
    'update_type_group',
    {
      group_id: z.string().describe('The type group ID to update'),
      name: z.string().optional().describe('New group name'),
      parent_group_id: z.string().nullable().optional().describe('Parent group ID or null'),
      sort_order: z.number().optional().describe('New group order index'),
    },
    async ({ group_id, name, parent_group_id, sort_order }) => {
      try {
        const result = await updateTypeGroup(group_id, {
          name,
          parent_group_id,
          sort_order,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Type group not found: ${group_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'typeGroup', action: 'update', id: group_id });
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
    'delete_type_group',
    { group_id: z.string().describe('The type group ID to delete') },
    async ({ group_id }) => {
      try {
        const deleted = await deleteTypeGroup(group_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Type group not found: ${group_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'typeGroup', action: 'delete', id: group_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: group_id }) }],
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
