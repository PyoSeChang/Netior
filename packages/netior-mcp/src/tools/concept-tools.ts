import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getConceptsByProject,
  searchConcepts,
  createConcept,
  updateConcept,
  deleteConcept,
  getConceptProperties,
  listSchemaFields,
} from '../netior-service-client.js';
import type { Concept, ConceptProperty, SchemaField } from '@netior/shared/types';
import { emitChange } from '../events.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';
import { toAgentConcept } from './schema-surface.js';

const conceptPropertyFilterSchema = z.object({
  field_id: z.string().optional().describe('Exact field ID to filter by'),
  field_name: z.string().optional().describe('Field name to resolve within the target schema'),
  meaning_binding: z.string().optional().describe('Meaning binding key to resolve within the target schema'),
  value: z.string().describe('Expected serialized value, concept ID, or option value'),
  match: z.enum(['equals', 'contains']).optional().describe('Whether to require exact match or substring/array containment'),
});

type ConceptPropertyFilterInput = z.infer<typeof conceptPropertyFilterSchema>;
type ResolvedConceptPropertyFilter = {
  field_id: string;
  value: string;
  match: 'equals' | 'contains';
};

function normalizeOptionalVisualValue(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveConceptVisualValue(input: {
  icon?: string | null;
  profile_image?: string | null;
}): string | null | undefined {
  const icon = normalizeOptionalVisualValue(input.icon);
  const profileImage = normalizeOptionalVisualValue(input.profile_image);

  if (icon !== undefined && profileImage !== undefined) {
    if (icon && profileImage) {
      throw new Error('Provide either icon or profile_image, not both');
    }

    return profileImage ?? icon ?? null;
  }

  return profileImage !== undefined ? profileImage : icon;
}

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
  schemaId: string | undefined,
  propertyFilters: ConceptPropertyFilterInput[] | undefined,
): Promise<ResolvedConceptPropertyFilter[]> {
  if (!propertyFilters || propertyFilters.length === 0) {
    return [];
  }

  const requiresSchemaResolution = propertyFilters.some((filter) => !filter.field_id);
  if (requiresSchemaResolution && !schemaId) {
    throw new Error('schema_id is required when filtering concepts by field_name or meaning_binding');
  }

  const fieldMapById = new Map<string, SchemaField>();
  const fieldMapByName = new Map<string, SchemaField>();
  const fieldMapByMeaning = new Map<string, SchemaField>();

  if (schemaId) {
    const fields = await listSchemaFields(schemaId);
    for (const field of fields) {
      fieldMapById.set(field.id, field);
      fieldMapByName.set(field.name, field);
      for (const meaning of field.meaning_bindings ?? []) {
        if (!fieldMapByMeaning.has(meaning)) {
          fieldMapByMeaning.set(meaning, field);
        }
      }
    }
  }

  return propertyFilters.map((filter) => {
    const resolvedField = filter.field_id
      ? fieldMapById.get(filter.field_id) ?? ({ id: filter.field_id } as SchemaField)
      : filter.field_name
        ? fieldMapByName.get(filter.field_name)
        : filter.meaning_binding
          ? fieldMapByMeaning.get(filter.meaning_binding)
          : undefined;

    if (!resolvedField?.id) {
      const label = filter.field_name ?? filter.meaning_binding ?? filter.field_id ?? '(unknown filter)';
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
      schema_id: z.string().optional().describe('Optional schema ID to narrow the concept set'),
      property_filters: z.array(conceptPropertyFilterSchema).optional().describe('Optional property filters resolved against the schema'),
    },
    async ({ project_id, query, schema_id, property_filters }) => {
      try {
        const targetProjectId = resolveProjectId(project_id);
        const baseConcepts = query
          ? await searchConcepts(targetProjectId, query)
          : await getConceptsByProject(targetProjectId);
        const schemaConcepts = schema_id
          ? baseConcepts.filter((concept) => concept.schema_id === schema_id)
          : baseConcepts;
        const resolvedFilters = await resolvePropertyFilters(schema_id, property_filters);
        const result = (await filterConceptsByProperties(schemaConcepts, resolvedFilters)).map(toAgentConcept);
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
      schema_id: z.string().optional().describe('Schema ID to assign'),
      color: z.string().optional().describe('Color value'),
      icon: z.string().nullable().optional().describe('Icon identifier or emoji text. Use this when not setting profile_image.'),
      profile_image: z.string().nullable().optional().describe('Profile image source. Can be an image URL, data URL, file URL, or local file path. Stored in the concept icon field.'),
    },
    async ({ project_id, title, schema_id, color, icon, profile_image }) => {
      try {
        const visual = resolveConceptVisualValue({ icon, profile_image });
        const result = await createConcept({
          project_id: resolveProjectId(project_id),
          title,
          schema_id: schema_id,
          color,
          ...(visual !== undefined && visual !== null ? { icon: visual } : {}),
        });
        emitChange({ type: 'concept', action: 'create', id: result.id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentConcept(result), null, 2) }],
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
      schema_id: z.string().optional().describe('New schema ID'),
      color: z.string().optional().describe('New color value'),
      icon: z.string().nullable().optional().describe('New icon identifier or emoji text. Use this when not setting profile_image.'),
      profile_image: z.string().nullable().optional().describe('New profile image source. Can be an image URL, data URL, file URL, or local file path. Stored in the concept icon field.'),
    },
    async ({ concept_id, title, schema_id, color, icon, profile_image }) => {
      try {
        const visual = resolveConceptVisualValue({ icon, profile_image });
        const result = await updateConcept(concept_id, {
          title,
          schema_id: schema_id,
          color,
          ...(visual !== undefined ? { icon: visual } : {}),
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Concept not found: ${concept_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'concept', action: 'update', id: concept_id });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(toAgentConcept(result), null, 2) }],
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
