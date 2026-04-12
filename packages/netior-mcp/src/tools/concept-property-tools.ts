import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  deleteConceptProperty,
  getConceptProperties,
  upsertConceptProperty,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';

export function registerConceptPropertyTools(server: McpServer): void {
  server.tool(
    'get_concept_properties',
    'Get the stored field values for a specific concept',
    { concept_id: z.string().describe('The concept ID') },
    async ({ concept_id }) => {
      try {
        const result = await getConceptProperties(concept_id);
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
    'upsert_concept_property',
    'Set or replace a concept property value for a specific field contract',
    {
      concept_id: z.string().describe('The concept ID'),
      field_id: z.string().describe('The field ID'),
      value: z.string().nullable().describe('Serialized value for the field, or null'),
    },
    async ({ concept_id, field_id, value }) => {
      try {
        const result = await upsertConceptProperty({
          concept_id,
          field_id,
          value,
        });
        emitChange({ type: 'conceptProperty', action: 'upsert', id: result.id });
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
    'delete_concept_property',
    'Delete a stored concept property value',
    { concept_property_id: z.string().describe('The concept property ID to delete') },
    async ({ concept_property_id }) => {
      try {
        const deleted = await deleteConceptProperty(concept_property_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Concept property not found: ${concept_property_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'conceptProperty', action: 'delete', id: concept_property_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: concept_property_id }) }],
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
