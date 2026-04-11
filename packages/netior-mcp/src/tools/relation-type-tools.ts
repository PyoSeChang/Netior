import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  listRelationTypes,
  createRelationType,
  updateRelationType,
  deleteRelationType,
} from '../netior-service-client.js';
import type { LineStyle } from '@netior/shared/types';
import { emitChange } from '../events.js';

export function registerRelationTypeTools(server: McpServer): void {
  server.tool(
    'list_relation_types',
    'List all relation types for a project',
    { project_id: z.string().describe('The project ID') },
    async ({ project_id }) => {
      try {
        const result = await listRelationTypes(project_id);
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

  server.tool(
    'create_relation_type',
    'Create a new relation type for a project',
    {
      project_id: z.string().describe('The project ID'),
      name: z.string().describe('Relation type name'),
      directed: z.boolean().optional().describe('Whether the relation is directed (has arrow)'),
      line_style: z.enum(['solid', 'dashed', 'dotted']).optional().describe('Line style: solid, dashed, or dotted'),
      color: z.string().optional().describe('Color value'),
      description: z.string().optional().describe('Relation type description'),
    },
    async ({ project_id, name, directed, line_style, color, description }) => {
      try {
        const result = await createRelationType({
          project_id,
          name,
          directed,
          line_style,
          color,
          description,
        });
        emitChange({ type: 'relationType', action: 'create', id: result.id });
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

  server.tool(
    'update_relation_type',
    'Update an existing relation type',
    {
      relation_type_id: z.string().describe('The relation type ID to update'),
      name: z.string().optional().describe('New name'),
      directed: z.boolean().optional().describe('New directed value'),
      line_style: z.enum(['solid', 'dashed', 'dotted']).optional().describe('New line style'),
      color: z.string().optional().describe('New color value'),
      description: z.string().optional().describe('New description'),
    },
    async ({ relation_type_id, name, directed, line_style, color, description }) => {
      try {
        const result = await updateRelationType(relation_type_id, {
          name,
          directed,
          line_style,
          color,
          description,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Relation type not found: ${relation_type_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'relationType', action: 'update', id: relation_type_id });
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

  server.tool(
    'delete_relation_type',
    'Delete a relation type',
    { relation_type_id: z.string().describe('The relation type ID to delete') },
    async ({ relation_type_id }) => {
      try {
        const deleted = await deleteRelationType(relation_type_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Relation type not found: ${relation_type_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'relationType', action: 'delete', id: relation_type_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: relation_type_id }) }],
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
