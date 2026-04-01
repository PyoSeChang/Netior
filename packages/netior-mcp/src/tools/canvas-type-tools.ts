import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  listCanvasTypes,
  createCanvasType,
  updateCanvasType,
  deleteCanvasType,
  addAllowedRelation,
  listAllowedRelations,
  removeAllowedRelationByPair,
} from '@netior/core';
import { emitChange } from '../events.js';

export function registerCanvasTypeTools(server: McpServer): void {
  server.tool(
    'list_canvas_types',
    'List all canvas types for a project',
    { project_id: z.string().describe('The project ID') },
    async ({ project_id }) => {
      try {
        const canvasTypes = listCanvasTypes(project_id);
        // Enrich each canvas type with its allowed relation types
        const result = canvasTypes.map((ct) => ({
          ...ct,
          allowed_relation_types: listAllowedRelations(ct.id),
        }));
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
    'create_canvas_type',
    'Create a new canvas type for a project',
    {
      project_id: z.string().describe('The project ID'),
      name: z.string().describe('Canvas type name'),
      icon: z.string().optional().describe('Icon identifier'),
      color: z.string().optional().describe('Color value'),
      description: z.string().optional().describe('Canvas type description'),
      allowed_relation_type_ids: z.array(z.string()).optional().describe('IDs of relation types allowed on this canvas type'),
    },
    async ({ project_id, name, icon, color, description, allowed_relation_type_ids }) => {
      try {
        const canvasType = createCanvasType({
          project_id,
          name,
          icon,
          color,
          description,
        });

        if (allowed_relation_type_ids && allowed_relation_type_ids.length > 0) {
          for (const rtId of allowed_relation_type_ids) {
            addAllowedRelation(canvasType.id, rtId);
          }
        }

        const allowedRelations = listAllowedRelations(canvasType.id);
        const result = { ...canvasType, allowed_relation_types: allowedRelations };

        emitChange({ type: 'canvasType', action: 'create', id: canvasType.id });
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
    'update_canvas_type',
    'Update an existing canvas type',
    {
      canvas_type_id: z.string().describe('The canvas type ID to update'),
      name: z.string().optional().describe('New name'),
      icon: z.string().optional().describe('New icon identifier'),
      color: z.string().optional().describe('New color value'),
      description: z.string().optional().describe('New description'),
      allowed_relation_type_ids: z.array(z.string()).optional().describe('New list of allowed relation type IDs (replaces existing)'),
    },
    async ({ canvas_type_id, name, icon, color, description, allowed_relation_type_ids }) => {
      try {
        const result = updateCanvasType(canvas_type_id, {
          name,
          icon,
          color,
          description,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Canvas type not found: ${canvas_type_id}` }],
            isError: true,
          };
        }

        // Replace allowed relations if provided
        if (allowed_relation_type_ids !== undefined) {
          // Remove existing
          const existing = listAllowedRelations(canvas_type_id);
          for (const rel of existing) {
            removeAllowedRelationByPair(canvas_type_id, rel.id);
          }
          // Add new
          for (const rtId of allowed_relation_type_ids) {
            addAllowedRelation(canvas_type_id, rtId);
          }
        }

        const allowedRelations = listAllowedRelations(canvas_type_id);
        const enriched = { ...result, allowed_relation_types: allowedRelations };

        emitChange({ type: 'canvasType', action: 'update', id: canvas_type_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(enriched, null, 2) }],
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
    'delete_canvas_type',
    'Delete a canvas type',
    { canvas_type_id: z.string().describe('The canvas type ID to delete') },
    async ({ canvas_type_id }) => {
      try {
        const deleted = deleteCanvasType(canvas_type_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Canvas type not found: ${canvas_type_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'canvasType', action: 'delete', id: canvas_type_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: canvas_type_id }) }],
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
