import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ArchetypeField } from '@netior/shared/types';
import { z } from 'zod';
import {
  getConceptsByProject,
  listArchetypeFields,
  searchConcepts,
} from '../netior-service-client.js';
import { registerNetiorTool } from './shared-tool-registry.js';

function parseInlineOptions(options: string | null): string[] {
  if (!options) {
    return [];
  }

  return options
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function findField(fields: ArchetypeField[], fieldId: string): ArchetypeField | undefined {
  return fields.find((field) => field.id === fieldId);
}

export function registerCandidateSourceTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'get_field_candidates',
    {
      project_id: z.string().describe('The project ID'),
      archetype_id: z.string().describe('The archetype that owns the field'),
      field_id: z.string().describe('The field contract ID'),
      query: z.string().optional().describe('Optional search query for candidate concepts'),
      max_results: z.number().optional().describe('Optional maximum number of candidates to return'),
    },
    async ({ project_id, archetype_id, field_id, query, max_results }) => {
      try {
        const fields = await listArchetypeFields(archetype_id);
        const field = findField(fields, field_id);

        if (!field) {
          return {
            content: [{ type: 'text' as const, text: `Error: Field not found: ${field_id}` }],
            isError: true,
          };
        }

        const limit = Math.max(1, max_results ?? 50);

        if (field.ref_archetype_id) {
          const concepts = query
            ? await searchConcepts(project_id, query)
            : await getConceptsByProject(project_id);
          const filtered = concepts
            .filter((concept) => concept.archetype_id === field.ref_archetype_id)
            .slice(0, limit)
            .map((concept) => ({
              id: concept.id,
              title: concept.title,
              archetype_id: concept.archetype_id,
            }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                field: {
                  id: field.id,
                  name: field.name,
                  field_type: field.field_type,
                  required: field.required,
                  ref_archetype_id: field.ref_archetype_id,
                },
                candidate_mode: 'concepts_by_archetype',
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
                field_type: field.field_type,
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
