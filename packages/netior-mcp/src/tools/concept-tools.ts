import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getConceptsByProject,
  searchConcepts,
  createConcept,
  updateConcept,
  deleteConcept,
  getConceptProperties,
  listArchetypeFields,
} from '../netior-service-client.js';
import type { Concept, ConceptProperty, ArchetypeField } from '@netior/shared/types';
import { emitChange } from '../events.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';

const conceptPropertyFilterSchema = z.object({
  field_id: z.string().optional().describe('Exact field ID to filter by'),
  field_name: z.string().optional().describe('Field name to resolve within the target archetype'),
  system_slot: z.string().optional().describe('System slot key to resolve within the target archetype'),
  value: z.string().describe('Expected serialized value, concept ID, or option value'),
  match: z.enum(['equals', 'contains']).optional().describe('Whether to require exact match or substring/array containment'),
});

type ConceptPropertyFilterInput = z.infer<typeof conceptPropertyFilterSchema>;
type ResolvedConceptPropertyFilter = {
  field_id: string;
  value: string;
  match: 'equals' | 'contains';
};

function tryParseSerializedValue(value: string | null): unknown {
  if (value == null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function matchesNestedValue(actual: unknown, expectedLower: string, match: 'equals' | 'contains'): boolean {
  if (actual == null) {
    return false;
  }

  if (typeof actual === 'string') {
    const normalized = actual.toLowerCase();
    return match === 'equals' ? normalized === expectedLower : normalized.includes(expectedLower);
  }

  if (typeof actual === 'number' || typeof actual === 'boolean') {
    const normalized = String(actual).toLowerCase();
    return match === 'equals' ? normalized === expectedLower : normalized.includes(expectedLower);
  }

  if (Array.isArray(actual)) {
    return actual.some((item) => matchesNestedValue(item, expectedLower, match));
  }

  if (typeof actual === 'object') {
    return Object.values(actual as Record<string, unknown>).some((item) => matchesNestedValue(item, expectedLower, match));
  }

  return false;
}

function matchesPropertyValue(
  property: ConceptProperty | undefined,
  expected: string,
  match: 'equals' | 'contains',
): boolean {
  if (!property) {
    return false;
  }

  return matchesNestedValue(tryParseSerializedValue(property.value), expected.toLowerCase(), match);
}

async function resolvePropertyFilters(
  archetypeId: string | undefined,
  propertyFilters: ConceptPropertyFilterInput[] | undefined,
): Promise<ResolvedConceptPropertyFilter[]> {
  if (!propertyFilters || propertyFilters.length === 0) {
    return [];
  }

  const requiresArchetypeResolution = propertyFilters.some((filter) => !filter.field_id);
  if (requiresArchetypeResolution && !archetypeId) {
    throw new Error('archetype_id is required when filtering concepts by field_name or system_slot');
  }

  const fieldMapById = new Map<string, ArchetypeField>();
  const fieldMapByName = new Map<string, ArchetypeField>();
  const fieldMapBySlot = new Map<string, ArchetypeField>();

  if (archetypeId) {
    const fields = await listArchetypeFields(archetypeId);
    for (const field of fields) {
      fieldMapById.set(field.id, field);
      fieldMapByName.set(field.name, field);
      if (field.system_slot) {
        fieldMapBySlot.set(field.system_slot, field);
      }
    }
  }

  return propertyFilters.map((filter) => {
    const resolvedField = filter.field_id
      ? fieldMapById.get(filter.field_id) ?? ({ id: filter.field_id } as ArchetypeField)
      : filter.field_name
        ? fieldMapByName.get(filter.field_name)
        : filter.system_slot
          ? fieldMapBySlot.get(filter.system_slot)
          : undefined;

    if (!resolvedField?.id) {
      const label = filter.field_name ?? filter.system_slot ?? filter.field_id ?? '(unknown filter)';
      throw new Error(`Could not resolve concept property filter: ${label}`);
    }

    return {
      field_id: resolvedField.id,
      value: filter.value,
      match: filter.match ?? 'equals',
    };
  });
}

async function filterConceptsByProperties(
  concepts: Concept[],
  propertyFilters: ResolvedConceptPropertyFilter[],
): Promise<Concept[]> {
  if (propertyFilters.length === 0) {
    return concepts;
  }

  const conceptPropertiesById = new Map<string, ConceptProperty[]>(
    await Promise.all(
      concepts.map(async (concept) => [concept.id, await getConceptProperties(concept.id)] as const),
    ),
  );

  return concepts.filter((concept) => {
    const properties = conceptPropertiesById.get(concept.id) ?? [];
    const propertyMap = new Map(properties.map((property) => [property.field_id, property]));
    return propertyFilters.every((filter) =>
      matchesPropertyValue(propertyMap.get(filter.field_id), filter.value, filter.match),
    );
  });
}

export function registerConceptTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_concepts',
    {
      project_id: projectIdSchema(),
      query: z.string().optional().describe('Search query to filter concepts by title'),
      archetype_id: z.string().optional().describe('Optional archetype ID to narrow the concept set'),
      property_filters: z.array(conceptPropertyFilterSchema).optional().describe('Optional property filters resolved against the archetype schema'),
    },
    async ({ project_id, query, archetype_id, property_filters }) => {
      try {
        const targetProjectId = resolveProjectId(project_id);
        const baseConcepts = query
          ? await searchConcepts(targetProjectId, query)
          : await getConceptsByProject(targetProjectId);
        const archetypeConcepts = archetype_id
          ? baseConcepts.filter((concept) => concept.archetype_id === archetype_id)
          : baseConcepts;
        const resolvedFilters = await resolvePropertyFilters(archetype_id, property_filters);
        const result = await filterConceptsByProperties(archetypeConcepts, resolvedFilters);
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
    'create_concept',
    {
      project_id: projectIdSchema(),
      title: z.string().describe('Concept title'),
      archetype_id: z.string().optional().describe('Archetype ID to assign'),
      color: z.string().optional().describe('Color value'),
      icon: z.string().optional().describe('Icon identifier'),
    },
    async ({ project_id, title, archetype_id, color, icon }) => {
      try {
        const result = await createConcept({
          project_id: resolveProjectId(project_id),
          title,
          archetype_id,
          color,
          icon,
        });
        emitChange({ type: 'concept', action: 'create', id: result.id });
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
    'update_concept',
    {
      concept_id: z.string().describe('The concept ID to update'),
      title: z.string().optional().describe('New title'),
      archetype_id: z.string().optional().describe('New archetype ID'),
      color: z.string().optional().describe('New color value'),
      icon: z.string().optional().describe('New icon identifier'),
    },
    async ({ concept_id, title, archetype_id, color, icon }) => {
      try {
        const result = await updateConcept(concept_id, {
          title,
          archetype_id,
          color,
          icon,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Concept not found: ${concept_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'concept', action: 'update', id: concept_id });
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
    'delete_concept',
    { concept_id: z.string().describe('The concept ID to delete') },
    async ({ concept_id }) => {
      try {
        const deleted = await deleteConcept(concept_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Concept not found: ${concept_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'concept', action: 'delete', id: concept_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: concept_id }) }],
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
