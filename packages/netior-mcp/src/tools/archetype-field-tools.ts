import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createArchetypeField,
  deleteArchetypeField,
  listArchetypeFields,
  reorderArchetypeFields,
  updateArchetypeField,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';

const fieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multi-select',
  'radio',
  'relation',
  'file',
  'url',
  'color',
  'rating',
  'tags',
  'archetype_ref',
]);

export function registerArchetypeFieldTools(server: McpServer): void {
  server.tool(
    'list_archetype_fields',
    'List field contracts for a specific archetype',
    { archetype_id: z.string().describe('The archetype ID') },
    async ({ archetype_id }) => {
      try {
        const result = await listArchetypeFields(archetype_id);
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
    'create_archetype_field',
    'Create a field contract on an archetype. Use this for scalar fields, typed archetype references, and choice-like fields.',
    {
      archetype_id: z.string().describe('The archetype ID'),
      name: z.string().describe('Field name'),
      field_type: fieldTypeSchema.describe('Field type'),
      sort_order: z.number().describe('Field order index'),
      required: z.boolean().optional().describe('Whether the field is required'),
      default_value: z.string().optional().describe('Default value'),
      options: z.string().optional().describe('Comma-separated inline options for select-like fields'),
      ref_archetype_id: z.string().optional().describe('Referenced archetype ID for archetype_ref fields'),
    },
    async ({ archetype_id, name, field_type, sort_order, required, default_value, options, ref_archetype_id }) => {
      try {
        const result = await createArchetypeField({
          archetype_id,
          name,
          field_type,
          sort_order,
          required,
          default_value,
          options,
          ref_archetype_id,
        });
        emitChange({ type: 'archetypeField', action: 'create', id: result.id });
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
    'update_archetype_field',
    'Update an archetype field contract',
    {
      field_id: z.string().describe('The field ID to update'),
      name: z.string().optional().describe('New field name'),
      field_type: fieldTypeSchema.optional().describe('New field type'),
      sort_order: z.number().optional().describe('New field order index'),
      required: z.boolean().optional().describe('Whether the field is required'),
      default_value: z.string().nullable().optional().describe('New default value'),
      options: z.string().nullable().optional().describe('New comma-separated inline options'),
      ref_archetype_id: z.string().nullable().optional().describe('Referenced archetype ID or null'),
    },
    async ({ field_id, name, field_type, sort_order, required, default_value, options, ref_archetype_id }) => {
      try {
        const result = await updateArchetypeField(field_id, {
          name,
          field_type,
          sort_order,
          required,
          default_value,
          options,
          ref_archetype_id,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Archetype field not found: ${field_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'archetypeField', action: 'update', id: field_id });
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
    'delete_archetype_field',
    'Delete an archetype field contract',
    { field_id: z.string().describe('The field ID to delete') },
    async ({ field_id }) => {
      try {
        const deleted = await deleteArchetypeField(field_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Archetype field not found: ${field_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'archetypeField', action: 'delete', id: field_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: field_id }) }],
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
    'reorder_archetype_fields',
    'Reorder field contracts within an archetype',
    {
      archetype_id: z.string().describe('The archetype ID'),
      ordered_ids: z.array(z.string()).describe('Field IDs in the desired order'),
    },
    async ({ archetype_id, ordered_ids }) => {
      try {
        const success = await reorderArchetypeFields(archetype_id, ordered_ids);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success, archetype_id, ordered_ids }, null, 2) }],
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
