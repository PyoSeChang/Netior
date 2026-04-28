import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SchemaField } from '@netior/shared/types';
import { z } from 'zod';
import {
  getConceptsByProject,
  listSchemaFields,
  searchConcepts,
} from '../netior-service-client.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';
import { toAgentFieldType } from './schema-surface.js';

function parseInlineOptions(options: string | null): string[] {
  if (!options) {
    return [];
  }

  return options
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function findField(fields: SchemaField[], fieldId: string): SchemaField | undefined {
  return fields.find((field) => field.id === fieldId);
}

export function registerCandidateSourceTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'get_field_candidates',
    {
      project_id: projectIdSchema(),
      schema_id: z.string().describe('The schema that owns the field'),
      field_id: z.string().describe('The field ID'),
      query: z.string().optional().describe('Optional search query for candidate concepts'),
      max_results: z.number().optional().describe('Optional maximum number of candidates to return'),
    },
    async ({ project_id, schema_id, field_id, query, max_results }) => {
      try {
        const targetProjectId = resolveProjectId(project_id);
        const fields = await listSchemaFields(schema_id);
        const field = findField(fields, field_id);

        if (!field) {
          return {
            content: [{ type: 'text' as const, text: `Error: Field not found: ${field_id}` }],
            isError: true,
          };
        }

        const limit = Math.max(1, max_results ?? 50);

        if (field.ref_schema_id) {
          const concepts = query
            ? await searchConcepts(targetProjectId, query)
            : await getConceptsByProject(targetProjectId);
          const filtered = concepts
            .filter((concept) => concept.schema_id === field.ref_schema_id)
            .slice(0, limit)
            .map((concept) => ({
              id: concept.id,
              title: concept.title,
              schema_id: concept.schema_id,
            }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                field: {
                  id: field.id,
                  name: field.name,
                  field_type: toAgentFieldType(field.field_type),
                  required: field.required,
                  ref_schema_id: field.ref_schema_id,
                },
                candidate_mode: 'concepts_by_schema',
                candidates: filtered,
              }, null, 2),
            }],
          };
        }

        const inlineOptions = parseInlineOptions(field.options).slice(0, limit);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              field: {
                id: field.id,
                name: field.name,
                field_type: toAgentFieldType(field.field_type),
                required: field.required,
              },
              candidate_mode: 'inline_options',
              candidates: inlineOptions,
            }, null, 2),
          }],
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
