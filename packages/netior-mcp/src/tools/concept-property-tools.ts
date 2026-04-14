import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  deleteConceptProperty,
  getConceptProperties,
  upsertConceptProperty,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';

export function registerConceptPropertyTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'get_concept_properties',
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

  registerNetiorTool(
    server,
    'upsert_concept_property',
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

  registerNetiorTool(
    server,
    'delete_concept_property',
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
