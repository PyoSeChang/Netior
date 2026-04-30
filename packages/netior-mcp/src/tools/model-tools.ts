import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SEMANTIC_MEANING_DEFINITIONS } from '@netior/shared/constants';
import type {
  FieldType,
  ModelFieldRecipe,
  ModelMeaningRecipe,
  ModelRecipe,
  ModelRefKey,
} from '@netior/shared/types';
import {
  createModel,
  deleteModel,
  getModel,
  listModels,
  updateModel,
} from '../netior-service-client.js';
import { emitChange } from '../events.js';
import { projectIdSchema, registerNetiorTool, resolveProjectId } from './shared-tool-registry.js';
import { fromAgentFieldType, toAgentModel, type AgentFieldType } from './schema-surface.js';

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
  'schema_ref',
]);

const modelKeySchema = z.string().regex(
  /^[a-z][a-z0-9_]*$/,
  'Model keys must be lowercase snake_case, such as task_flow',
);
const categorySchema = z.string().regex(
  /^[a-z][a-z0-9_]*$/,
  'Model categories must be lowercase snake_case',
);
const meaningKeySet = new Set(SEMANTIC_MEANING_DEFINITIONS.map((definition) => definition.key));
const builtInMeaningKeySchema = z.string().refine(
  (value) => meaningKeySet.has(value as never),
  'Unknown built-in meaning key',
);
const representationSchema = z.enum(['single_field', 'field_group', 'relation', 'computed']);
const targetKindSchema = z.enum(['object', 'edge', 'both']);
const lineStyleSchema = z.enum(['solid', 'dashed', 'dotted']);

const modelFieldRecipeSchema = z.object({
  id: z.string().optional().describe('Stable field recipe ID. Omit to derive from key.'),
  key: z.string().regex(/^[a-z][a-z0-9_]*$/).describe('Lowercase field recipe key'),
  name: z.string().describe('Human-readable field name'),
  field_types: z.array(fieldTypeSchema).min(1).optional().describe('Allowed field value types'),
  required: z.boolean().optional().describe('Whether this field is required for the meaning'),
  description: z.string().nullable().optional().describe('Optional field description'),
  options: z.string().nullable().optional().describe('Optional comma-separated options for choice-like fields'),
});

const modelMeaningRecipeSchema = z.object({
  id: z.string().optional().describe('Stable meaning recipe ID. Omit to derive from key.'),
  key: z.string().regex(/^[a-z][a-z0-9_]*$/).describe('Lowercase meaning recipe key'),
  name: z.string().describe('Human-readable meaning name'),
  description: z.string().nullable().optional().describe('Optional meaning description'),
  representation: representationSchema.optional().describe('How the meaning is represented'),
  fields: z.array(modelFieldRecipeSchema).optional().describe('One or more field recipes that express this meaning'),
});

const modelRecipeSchema = z.object({
  meanings: z.array(modelMeaningRecipeSchema).optional().describe('Meanings this model contributes'),
  rules: z.array(z.object({
    id: z.string().optional().describe('Stable rule ID. Omit to derive from index.'),
    description: z.string().describe('Natural-language modeling rule'),
  })).optional().describe('Modeling rules or constraints'),
});

type ModelRecipeInput = z.infer<typeof modelRecipeSchema>;
type ModelMeaningRecipeInput = z.infer<typeof modelMeaningRecipeSchema>;
type ModelFieldRecipeInput = z.infer<typeof modelFieldRecipeSchema>;

function normalizeRecipeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
}

function normalizeFieldRecipe(input: ModelFieldRecipeInput, index: number): ModelFieldRecipe {
  const key = normalizeRecipeKey(input.key || input.name);
  return {
    id: input.id?.trim() || key || `field-${index + 1}`,
    key,
    name: input.name.trim(),
    field_types: ((input.field_types && input.field_types.length > 0)
      ? input.field_types.map((fieldType) => fromAgentFieldType(fieldType as AgentFieldType))
      : ['text']) as FieldType[],
    required: input.required ?? false,
    description: input.description ?? null,
    options: input.options ?? null,
  };
}

function normalizeMeaningRecipe(input: ModelMeaningRecipeInput, index: number): ModelMeaningRecipe {
  const key = normalizeRecipeKey(input.key || input.name);
  const fields = (input.fields ?? []).map(normalizeFieldRecipe);
  return {
    id: input.id?.trim() || key || `meaning-${index + 1}`,
    key,
    name: input.name.trim(),
    description: input.description ?? null,
    representation: input.representation ?? (fields.length > 1 ? 'field_group' : 'single_field'),
    fields,
  };
}

function normalizeRecipe(input: ModelRecipeInput | undefined): ModelRecipe | undefined {
  if (!input) return undefined;
  return {
    meanings: (input.meanings ?? []).map(normalizeMeaningRecipe),
    rules: (input.rules ?? []).map((rule, index) => ({
      id: rule.id?.trim() || `rule-${index + 1}`,
      description: rule.description.trim(),
    })),
  };
}

export function registerModelTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_models',
    { project_id: projectIdSchema() },
    async ({ project_id }) => {
      try {
        const result = (await listModels(resolveProjectId(project_id))).map(toAgentModel);
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
    'get_model',
    { model_id: z.string().describe('The model ID') },
    async ({ model_id }) => {
      try {
        const result = await getModel(model_id);
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Model not found: ${model_id}` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(toAgentModel(result), null, 2) }] };
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
    'create_model',
    {
      project_id: projectIdSchema(),
      key: modelKeySchema.optional().describe('Optional stable model key. Omit to derive from name.'),
      name: z.string().describe('Model name'),
      description: z.string().nullable().optional().describe('What this model means and when to use it'),
      category: categorySchema.optional().describe('Model category'),
      target_kind: targetKindSchema.optional().describe('Whether this model describes objects, edges, or both'),
      meaning_keys: z.array(builtInMeaningKeySchema).optional().describe('Built-in meanings this model includes'),
      recipe: modelRecipeSchema.optional().describe('Custom meaning and field recipe for this model'),
      color: z.string().nullable().optional().describe('Optional color value'),
      icon: z.string().nullable().optional().describe('Optional icon identifier'),
      line_style: lineStyleSchema.nullable().optional().describe('Default edge line style when target_kind includes edge'),
      directed: z.boolean().nullable().optional().describe('Default edge direction when target_kind includes edge'),
    },
    async ({ project_id, key, name, description, category, target_kind, meaning_keys, recipe, color, icon, line_style, directed }) => {
      try {
        const result = await createModel({
          project_id: resolveProjectId(project_id),
          key: key as ModelRefKey | undefined,
          name,
          description,
          category,
          target_kind,
          meaning_keys: meaning_keys as never,
          recipe: normalizeRecipe(recipe),
          color,
          icon,
          line_style,
          directed,
        });
        emitChange({ type: 'model', action: 'create', id: result.id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(toAgentModel(result), null, 2) }] };
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
    'update_model',
    {
      model_id: z.string().describe('The model ID to update'),
      key: modelKeySchema.optional().describe('New stable model key'),
      name: z.string().optional().describe('New model name'),
      description: z.string().nullable().optional().describe('New model description'),
      category: categorySchema.optional().describe('New model category'),
      target_kind: targetKindSchema.optional().describe('Whether this model describes objects, edges, or both'),
      meaning_keys: z.array(builtInMeaningKeySchema).optional().describe('Built-in meanings this model includes'),
      recipe: modelRecipeSchema.optional().describe('Custom meaning and field recipe for this model'),
      color: z.string().nullable().optional().describe('New color value'),
      icon: z.string().nullable().optional().describe('New icon identifier'),
      line_style: lineStyleSchema.nullable().optional().describe('Default edge line style when target_kind includes edge'),
      directed: z.boolean().nullable().optional().describe('Default edge direction when target_kind includes edge'),
    },
    async ({ model_id, key, name, description, category, target_kind, meaning_keys, recipe, color, icon, line_style, directed }) => {
      try {
        const result = await updateModel(model_id, {
          key: key as ModelRefKey | undefined,
          name,
          description,
          category,
          target_kind,
          meaning_keys: meaning_keys as never,
          recipe: normalizeRecipe(recipe),
          color,
          icon,
          line_style,
          directed,
        });
        if (!result) {
          return {
            content: [{ type: 'text' as const, text: `Error: Model not found: ${model_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'model', action: 'update', id: model_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(toAgentModel(result), null, 2) }] };
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
    'delete_model',
    { model_id: z.string().describe('The model ID to delete') },
    async ({ model_id }) => {
      try {
        const deleted = await deleteModel(model_id);
        if (!deleted) {
          return {
            content: [{ type: 'text' as const, text: `Error: Model not found: ${model_id}` }],
            isError: true,
          };
        }
        emitChange({ type: 'model', action: 'delete', id: model_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, id: model_id }) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
