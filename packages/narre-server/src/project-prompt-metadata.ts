import type { SchemaField, SchemaMeaning, NetworkTreeNode, SemanticModel, TypeGroup } from '@netior/shared/types';
import type { SystemPromptParams, SystemPromptTypeGroupSummary } from './system-prompt.js';
import {
  getProjectOntologyNetwork,
  getNetworkTree,
  getProjectById,
  getUniverseNetwork,
  listSchemaFields,
  listSchemaMeanings,
  listSchemas,
  listRelationTypes,
  listSemanticModels,
  listTypeGroups,
} from './netior-service-client.js';

function buildTypeGroupPathMap(groups: TypeGroup[]): Map<string, string> {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const cache = new Map<string, string>();

  const resolvePath = (group: TypeGroup): string => {
    const cached = cache.get(group.id);
    if (cached) {
      return cached;
    }

    const parent = group.parent_group_id ? byId.get(group.parent_group_id) : null;
    const path = parent ? `${resolvePath(parent)}/${group.name}` : group.name;
    cache.set(group.id, path);
    return path;
  };

  for (const group of groups) {
    resolvePath(group);
  }

  return cache;
}

function mapTypeGroups(groups: TypeGroup[]): SystemPromptTypeGroupSummary[] {
  const pathMap = buildTypeGroupPathMap(groups);
  return groups.map((group) => ({
    id: group.id,
    kind: group.kind,
    path: pathMap.get(group.id) ?? group.name,
  }));
}

function mapNetworkTree(nodes: NetworkTreeNode[]): NonNullable<SystemPromptParams['networkTree']> {
  return nodes.map((node) => ({
    id: node.network.id,
    name: node.network.name,
    kind: node.network.kind,
    children: mapNetworkTree(node.children),
  }));
}

function buildOptionsPreview(options: string | null): string[] | undefined {
  if (!options) {
    return undefined;
  }

  const values = options
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return undefined;
  }

  return values.slice(0, 5);
}

function mapSchemaFields(
  fields: SchemaField[],
  schemaNames: Map<string, string>,
): NonNullable<SystemPromptParams['schemas'][number]['fields']> {
  return fields.map((field) => {
    const optionsPreview = buildOptionsPreview(field.options);

    return {
      name: field.name,
      field_type: field.field_type,
      required: field.required,
      ...(field.meaning_bindings.length > 0 ? { meaning_bindings: field.meaning_bindings } : {}),
      ...(field.generated_by_model ? { generated_by_model: true } : {}),
      ...(field.ref_schema_id
        ? { ref_schema_name: schemaNames.get(field.ref_schema_id) ?? field.ref_schema_id }
        : {}),
      ...(optionsPreview ? { options_preview: optionsPreview } : {}),
    };
  });
}

function mapSchemaMeanings(
  meanings: SchemaMeaning[],
): NonNullable<SystemPromptParams['schemas'][number]['meanings']> {
  return meanings.map((meaning) => ({
    key: meaning.meaning_key,
    label: meaning.label,
    source: meaning.source,
    source_model: meaning.source_model,
    fields: meaning.slots
      .filter((slot) => slot.target_kind === 'field' && slot.field_id)
      .map((slot) => ({
        binding_id: slot.id,
        field_id: slot.field_id as string,
        required: slot.required,
      })),
  }));
}

function mapModels(models: SemanticModel[]): SystemPromptParams['models'] {
  return models.map((model) => ({
    id: model.id,
    key: model.key,
    name: model.name,
    description: model.description,
    category: model.category,
    meaning_keys: model.meaning_keys,
    built_in: model.built_in,
    recipe_meanings: model.recipe.meanings.map((meaning) => ({
      key: meaning.key,
      name: meaning.name,
      representation: meaning.representation,
      fields: meaning.fields.map((field) => ({
        key: field.key,
        name: field.name,
        field_types: field.field_types,
        required: field.required,
      })),
    })),
  }));
}

export async function buildProjectPromptMetadata(projectId: string): Promise<SystemPromptParams> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const [
    schemas,
    models,
    relationTypes,
    schemaGroups,
    relationTypeGroups,
    universeNetwork,
    ontologyNetwork,
    networkTree,
  ] = await Promise.all([
    listSchemas(projectId),
    listSemanticModels(projectId),
    listRelationTypes(projectId),
    listTypeGroups(projectId, 'schema'),
    listTypeGroups(projectId, 'relation_type'),
    getUniverseNetwork(),
    getProjectOntologyNetwork(projectId),
    getNetworkTree(projectId),
  ]);

  const schemaNameMap = new Map<string, string>(schemas.map((schema) => [schema.id, schema.name]));
  const schemaFieldsById = new Map<string, SchemaField[]>(
    await Promise.all(
      schemas.map(async (schema) => [schema.id, await listSchemaFields(schema.id)] as const),
    ),
  );
  const schemaMeaningsById = new Map<string, SchemaMeaning[]>(
    await Promise.all(
      schemas.map(async (schema) => [schema.id, await listSchemaMeanings(schema.id)] as const),
    ),
  );
  const typeGroups = mapTypeGroups([...schemaGroups, ...relationTypeGroups]);

  return {
    projectId,
    projectName: project.name,
    projectRootDir: project.root_dir,
    models: mapModels(models),
    schemas: schemas.map((schema) => ({
      id: schema.id,
      name: schema.name,
      icon: schema.icon,
      color: schema.color,
      node_shape: schema.node_shape,
      description: schema.description,
      models: schema.semantic_models ?? schema.models ?? schema.semantic_models,
      semantic_models: schema.semantic_models,
      meanings: mapSchemaMeanings(schemaMeaningsById.get(schema.id) ?? []),
      fields: mapSchemaFields(schemaFieldsById.get(schema.id) ?? [], schemaNameMap),
    })),
    relationTypes: relationTypes.map((relationType) => ({
      id: relationType.id,
      name: relationType.name,
      directed: relationType.directed,
      line_style: relationType.line_style,
      color: relationType.color,
      description: relationType.description,
    })),
    typeGroups,
    universeNetwork: universeNetwork
      ? { id: universeNetwork.id, name: universeNetwork.name }
      : null,
    ontologyNetwork: ontologyNetwork
      ? { id: ontologyNetwork.id, name: ontologyNetwork.name }
      : null,
    networkTree: mapNetworkTree(networkTree),
  };
}
