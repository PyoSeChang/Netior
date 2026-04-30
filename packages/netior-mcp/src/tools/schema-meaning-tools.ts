import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SEMANTIC_MEANING_DEFINITIONS } from '@netior/shared/constants';
import type { MeaningSourceKind, SemanticMeaningKey, ModelRefKey, SlotBindingTargetKind } from '@netior/shared/types';
import {
  deleteSchemaMeaning,
  ensureSchemaMeaning,
  listSchemaMeanings,
  updateSchemaMeaning,
  updateSchemaMeaningSlotBinding,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { registerNetiorTool } from './shared-tool-registry.js';
import { toAgentSchemaMeaning, toAgentMeaningSlot } from './schema-surface.js';

const meaningKeySet = new Set(SEMANTIC_MEANING_DEFINITIONS.map((definition) => definition.key));
const meaningKeySchema = z.string().refine(
  (value) => meaningKeySet.has(value as never),
  'Unknown built-in meaning key',
);
const meaningSourceSchema = z.enum(['manual', 'model', 'migration', 'system']);
const targetKindSchema = z.enum(['field', 'edge', 'derived']);

export function registerSchemaMeaningTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_schema_meanings',
    { schema_id: z.string().describe('The schema ID') },
    async ({ schema_id }) => {
      try {
        const result = (await listSchemaMeanings(schema_id)).map(toAgentSchemaMeaning);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
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
    'ensure_schema_meaning',
    {
      schema_id: z.string().describe('The schema ID'),
      meaning_key: meaningKeySchema.describe('Meaning to attach to the schema'),
      label: z.string().nullable().optional().describe('Optional project-local label for the meaning'),
      source: meaningSourceSchema.optional().describe('Where this meaning came from'),
      source_model: z.string().nullable().optional().describe('Model key that contributed this meaning'),
      sort_order: z.number().optional().describe('Meaning order within the schema'),
    },
    async ({ schema_id, meaning_key, label, source, source_model, sort_order }) => {
      try {
        const result = await ensureSchemaMeaning({
          schema_id: schema_id,
          meaning_key: meaning_key as SemanticMeaningKey,
          label,
          source: source as MeaningSourceKind | undefined,
          source_model: source_model as ModelRefKey | null | undefined,
          sort_order,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Could not attach meaning: ${meaning_key}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schemaMeaning', action: 'ensure', id: result.id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(toAgentSchemaMeaning(result), null, 2) }] };
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
    'update_schema_meaning',
    {
      meaning_id: z.string().describe('The schema meaning ID'),
      label: z.string().nullable().optional().describe('New project-local label'),
      sort_order: z.number().optional().describe('New meaning order'),
    },
    async ({ meaning_id, label, sort_order }) => {
      try {
        const result = await updateSchemaMeaning(meaning_id, { label, sort_order });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Schema meaning not found: ${meaning_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schemaMeaning', action: 'update', id: meaning_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(toAgentSchemaMeaning(result), null, 2) }] };
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
    'delete_schema_meaning',
    { meaning_id: z.string().describe('The schema meaning ID to delete') },
    async ({ meaning_id }) => {
      try {
        const deleted = await deleteSchemaMeaning(meaning_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Schema meaning not found: ${meaning_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schemaMeaning', action: 'delete', id: meaning_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: meaning_id }) }] };
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
    'update_schema_meaning_slot',
    {
      binding_id: z.string().describe('The meaning slot binding ID'),
      target_kind: targetKindSchema.optional().describe('Whether this slot is represented by a field, edge, or derived value'),
      field_id: z.string().nullable().optional().describe('Field ID when target_kind is field, or null to detach'),
    },
    async ({ binding_id, target_kind, field_id }) => {
      try {
        const result = await updateSchemaMeaningSlotBinding(binding_id, {
          target_kind: target_kind as SlotBindingTargetKind | undefined,
          field_id,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Meaning slot binding not found: ${binding_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'schemaMeaningSlot', action: 'update', id: binding_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(toAgentMeaningSlot(result), null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
