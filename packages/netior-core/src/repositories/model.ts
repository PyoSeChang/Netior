import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createObject, deleteObjectByRef, getObjectByRef } from './objects';
import { syncProjectOntologyForDb } from './system-networks';
import {
  SEMANTIC_MEANING_DEFINITIONS,
  MODEL_DEFINITIONS,
  getMeaningSlotDefinition,
} from '@netior/shared/constants';
import type {
  FieldType,
  EdgeLineStyle,
  SemanticCategoryRefKey,
  SemanticMeaningKey,
  Model,
  ModelCreate,
  ModelFieldRecipe,
  ModelMeaningRecipe,
  ModelRecipe,
  ModelRepresentationKind,
  ModelRuleRecipe,
  ModelRefKey,
  ModelTargetKind,
  ModelUpdate,
  MeaningSlotKey,
} from '@netior/shared/types';

type Db = ReturnType<typeof getDatabase>;

type ModelRow = Omit<
  Model,
  'meaning_keys' | 'core_slots' | 'optional_slots' | 'recipe' | 'built_in' | 'directed'
> & {
  meaning_keys: string | null;
  core_slots: string | null;
  optional_slots: string | null;
  recipe_json?: string | null;
  built_in: number;
  directed: number | null;
};

const EMPTY_MODEL_RECIPE: ModelRecipe = {
  meanings: [],
  rules: [],
};

const FIELD_TYPES: readonly FieldType[] = [
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
];

const REPRESENTATION_KINDS: readonly ModelRepresentationKind[] = [
  'single_field',
  'field_group',
  'relation',
  'computed',
];

function parseStringArray<T extends string>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is T => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function serializeStringArray(values: readonly string[] | undefined): string {
  return JSON.stringify(values ?? []);
}

function normalizeRecipeField(raw: unknown, fallbackIndex: number): ModelFieldRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<ModelFieldRecipe>;
  const legacyItem = raw as { field_type?: unknown };
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '';
  if (!name) return null;
  const key = typeof item.key === 'string' && item.key.trim()
    ? normalizeModelKey(item.key)
    : normalizeModelKey(name);
  const fieldTypes: FieldType[] = Array.isArray(item.field_types)
    ? item.field_types.filter((type): type is FieldType => FIELD_TYPES.includes(type as FieldType))
    : FIELD_TYPES.includes(legacyItem.field_type as FieldType)
      ? [legacyItem.field_type as FieldType]
      : ['text'];
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `field-${fallbackIndex + 1}`,
    key,
    name,
    field_types: fieldTypes.length > 0 ? fieldTypes : ['text'],
    required: Boolean(item.required),
    description: typeof item.description === 'string' && item.description.trim() ? item.description : null,
    options: typeof item.options === 'string' && item.options.trim() ? item.options : null,
  };
}

function normalizeRecipeMeaning(raw: unknown, fallbackIndex: number): ModelMeaningRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<ModelMeaningRecipe>;
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '';
  if (!name) return null;
  const key = typeof item.key === 'string' && item.key.trim()
    ? normalizeModelKey(item.key)
    : normalizeModelKey(name);
  const fields = Array.isArray(item.fields)
    ? item.fields.map(normalizeRecipeField).filter((field): field is ModelFieldRecipe => Boolean(field))
    : [];
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `role-${fallbackIndex + 1}`,
    key,
    name,
    description: typeof item.description === 'string' && item.description.trim() ? item.description : null,
    representation: REPRESENTATION_KINDS.includes(item.representation as ModelRepresentationKind)
      ? item.representation as ModelRepresentationKind
      : fields.length > 1
        ? 'field_group'
        : 'single_field',
    fields,
  };
}

function normalizeRecipeRule(raw: unknown, fallbackIndex: number): ModelRuleRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<ModelRuleRecipe>;
  const description = typeof item.description === 'string' && item.description.trim()
    ? item.description.trim()
    : '';
  if (!description) return null;
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `rule-${fallbackIndex + 1}`,
    description,
  };
}

function normalizeModelRecipe(raw: unknown): ModelRecipe {
  if (!raw || typeof raw !== 'object') return EMPTY_MODEL_RECIPE;
  const recipe = raw as Partial<ModelRecipe>;
  const legacyRecipe = raw as { roles?: unknown };
  const rawMeanings = Array.isArray(recipe.meanings) ? recipe.meanings : legacyRecipe.roles;
  return {
    meanings: Array.isArray(rawMeanings)
      ? rawMeanings.map(normalizeRecipeMeaning).filter((meaning): meaning is ModelMeaningRecipe => Boolean(meaning))
      : [],
    rules: Array.isArray(recipe.rules)
      ? recipe.rules.map(normalizeRecipeRule).filter((rule): rule is ModelRuleRecipe => Boolean(rule))
      : [],
  };
}

function parseModelRecipe(raw: string | null | undefined): ModelRecipe {
  if (!raw) return EMPTY_MODEL_RECIPE;
  try {
    return normalizeModelRecipe(JSON.parse(raw));
  } catch {
    return EMPTY_MODEL_RECIPE;
  }
}

function serializeModelRecipe(recipe: ModelRecipe | undefined): string {
  return JSON.stringify(normalizeModelRecipe(recipe));
}

function buildRecipeForBuiltInModel(
  definition: (typeof MODEL_DEFINITIONS)[number],
): ModelRecipe {
  if ((definition.targetKind ?? 'object') === 'edge') {
    return {
      meanings: [{
        id: definition.key,
        key: definition.key,
        name: definition.label,
        description: definition.description ?? null,
        representation: 'relation',
        fields: [],
      }],
      rules: [],
    };
  }

  return {
    meanings: definition.meanings.map((meaningKey) => {
      const meaningDefinition = SEMANTIC_MEANING_DEFINITIONS.find((entry) => entry.key === meaningKey);
      const coreSlots = meaningDefinition?.coreSlots ?? [];
      const optionalSlots = meaningDefinition?.optionalSlots ?? [];
      const fields = [...coreSlots, ...optionalSlots].map((slot) => {
        const slotDefinition = getMeaningSlotDefinition(slot);
        return {
          id: slot,
          key: slot,
          name: slotDefinition?.label ?? slot,
          field_types: [...(slotDefinition?.allowedFieldTypes ?? ['text'])],
          required: coreSlots.includes(slot),
          description: null,
          options: null,
        };
      });

      return {
        id: meaningKey,
        key: meaningKey,
        name: meaningDefinition?.label ?? meaningKey,
        description: meaningDefinition?.description ?? null,
        representation: fields.length > 1 ? 'field_group' : 'single_field',
        fields,
      };
    }),
    rules: [],
  };
}

function isEmptyRecipe(raw: string | null | undefined): boolean {
  const recipe = parseModelRecipe(raw);
  return recipe.meanings.length === 0 && recipe.rules.length === 0;
}

function getBuiltInModelRecipe(key: string): ModelRecipe | null {
  const definition = MODEL_DEFINITIONS.find((entry) => entry.key === key);
  return definition ? buildRecipeForBuiltInModel(definition) : null;
}

function normalizeModelKey(value: string): ModelRefKey {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (normalized || 'model') as ModelRefKey;
}

function getUniqueModelKey(
  db: Db,
  projectId: string,
  baseKey: ModelRefKey,
  excludeId?: string,
): ModelRefKey {
  const normalized = normalizeModelKey(baseKey);
  let candidate = normalized;
  let suffix = 2;
  while (true) {
    const existing = db.prepare(
      'SELECT id FROM models WHERE project_id = ? AND key = ?',
    ).get(projectId, candidate) as { id: string } | undefined;
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${normalized}_${suffix}` as ModelRefKey;
    suffix += 1;
  }
}

function deriveSlotsForMeanings(meaningKeys: readonly SemanticMeaningKey[]): {
  coreSlots: MeaningSlotKey[];
  optionalSlots: MeaningSlotKey[];
} {
  const coreSlots = new Set<MeaningSlotKey>();
  const optionalSlots = new Set<MeaningSlotKey>();
  for (const key of meaningKeys) {
    const definition = SEMANTIC_MEANING_DEFINITIONS.find((entry) => entry.key === key);
    if (!definition) continue;
    definition.coreSlots.forEach((slot) => coreSlots.add(slot));
    definition.optionalSlots.forEach((slot) => optionalSlots.add(slot));
  }
  return { coreSlots: [...coreSlots], optionalSlots: [...optionalSlots] };
}

function toModel(row: ModelRow): Model {
  return {
    ...row,
    key: row.key as ModelRefKey,
    category: row.category as SemanticCategoryRefKey,
    target_kind: (row.target_kind ?? 'object') as ModelTargetKind,
    meaning_keys: parseStringArray<SemanticMeaningKey>(row.meaning_keys),
    core_slots: parseStringArray<MeaningSlotKey>(row.core_slots),
    optional_slots: parseStringArray<MeaningSlotKey>(row.optional_slots),
    recipe: parseModelRecipe(row.recipe_json),
    line_style: (row.line_style ?? null) as EdgeLineStyle | null,
    directed: row.directed == null ? null : !!row.directed,
    built_in: !!row.built_in,
  };
}

function ensureObjectForModel(db: Db, model: Pick<ModelRow, 'id' | 'project_id' | 'created_at'>): void {
  const existing = getObjectByRef('model', model.id);
  if (existing) return;
  createObject('model', 'project', model.project_id, model.id);
}

export function seedBuiltInModelsForProjectDb(db: Db, projectId: string): void {
  const now = new Date().toISOString();
  const insertModel = db.prepare(`
    INSERT OR IGNORE INTO models (
      id, project_id, key, name, description, category,
      target_kind, meaning_keys, core_slots, optional_slots, recipe_json,
      line_style, directed, built_in, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const updateMissingDescription = db.prepare(`
    UPDATE models
       SET description = ?, updated_at = ?
     WHERE project_id = ?
       AND key = ?
       AND built_in = 1
       AND (description IS NULL OR trim(description) = '')
  `);
  const updateMissingRecipe = db.prepare(`
    UPDATE models
       SET recipe_json = ?, updated_at = ?
     WHERE project_id = ?
       AND key = ?
       AND built_in = 1
       AND (recipe_json IS NULL OR trim(recipe_json) = '' OR recipe_json = '{"roles":[],"rules":[]}' OR recipe_json = '{"meanings":[],"rules":[]}')
  `);

  for (const definition of MODEL_DEFINITIONS) {
    const id = `model-${projectId}-${definition.key}`;
    const description = definition.description ?? null;
    const recipeJson = serializeModelRecipe(buildRecipeForBuiltInModel(definition));
    insertModel.run(
      id,
      projectId,
      definition.key,
      definition.label,
      description,
      definition.category,
      definition.targetKind ?? 'object',
      serializeStringArray(definition.meanings),
      serializeStringArray(definition.coreSlots),
      serializeStringArray(definition.optionalSlots),
      recipeJson,
      definition.lineStyle ?? null,
      definition.directed == null ? null : (definition.directed ? 1 : 0),
      now,
      now,
    );
    if (description) {
      updateMissingDescription.run(description, now, projectId, definition.key);
    }
    updateMissingRecipe.run(recipeJson, now, projectId, definition.key);
    ensureObjectForModel(db, { id, project_id: projectId, created_at: now });
  }
}

function removeModelKeyFromSchemas(db: Db, projectId: string, modelKey: string): void {
  const rows = db.prepare(
    'SELECT id, models FROM schemas WHERE project_id = ?',
  ).all(projectId) as Array<{
    id: string;
    models: string | null;
  }>;

  for (const row of rows) {
    const nextModels = parseStringArray<string>(row.models).filter((key) => key !== modelKey);
    db.prepare(
      `UPDATE schemas
          SET models = ?, updated_at = ?
        WHERE id = ?`,
    ).run(
      serializeStringArray(nextModels),
      new Date().toISOString(),
      row.id,
    );
  }
}

function removeModelFromEdges(db: Db, modelId: string): void {
  db.prepare('UPDATE edges SET model_id = NULL WHERE model_id = ?').run(modelId);
}

function replaceModelKeyInSchemas(db: Db, projectId: string, oldKey: string, newKey: string): void {
  if (oldKey === newKey) return;

  const rows = db.prepare(
    'SELECT id, models FROM schemas WHERE project_id = ?',
  ).all(projectId) as Array<{
    id: string;
    models: string | null;
  }>;

  const replaceKeys = (raw: string | null): string[] => {
    const next: string[] = [];
    for (const key of parseStringArray<string>(raw)) {
      const value = key === oldKey ? newKey : key;
      if (!next.includes(value)) next.push(value);
    }
    return next;
  };

  const now = new Date().toISOString();
  for (const row of rows) {
    db.prepare(
      `UPDATE schemas
          SET models = ?, updated_at = ?
        WHERE id = ?`,
    ).run(
      serializeStringArray(replaceKeys(row.models)),
      now,
      row.id,
    );
  }
}

export function createModel(data: ModelCreate): Model {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const meaningKeys = data.meaning_keys ?? [];
  const derivedSlots = deriveSlotsForMeanings(meaningKeys);
  const key = getUniqueModelKey(db, data.project_id, data.key ?? normalizeModelKey(data.name));

  db.prepare(
    `INSERT INTO models (
      id, project_id, key, name, description, category,
      target_kind, meaning_keys, core_slots, optional_slots, recipe_json,
      color, icon, line_style, directed, built_in, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.project_id,
    key,
    data.name,
    data.description ?? null,
    data.category ?? 'knowledge',
    data.target_kind ?? 'object',
    serializeStringArray(meaningKeys),
    serializeStringArray(data.core_slots ?? derivedSlots.coreSlots),
    serializeStringArray(data.optional_slots ?? derivedSlots.optionalSlots),
    serializeModelRecipe(data.recipe),
    data.color ?? null,
    data.icon ?? null,
    data.line_style ?? null,
    data.directed == null ? null : (data.directed ? 1 : 0),
    data.built_in ? 1 : 0,
    now,
    now,
  );

  createObject('model', 'project', data.project_id, id);
  syncProjectOntologyForDb(db, data.project_id);

  const row = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow;
  return toModel(row);
}

export function listModels(projectId: string): Model[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM models WHERE project_id = ? ORDER BY built_in DESC, category, name')
    .all(projectId) as ModelRow[];
  const updateRecipe = db.prepare('UPDATE models SET recipe_json = ?, updated_at = ? WHERE id = ?');
  for (const row of rows) {
    ensureObjectForModel(db, row);
    if (row.built_in && isEmptyRecipe(row.recipe_json)) {
      const builtInRecipe = getBuiltInModelRecipe(row.key);
      if (builtInRecipe) {
        row.recipe_json = serializeModelRecipe(builtInRecipe);
        updateRecipe.run(row.recipe_json, new Date().toISOString(), row.id);
      }
    }
  }
  return rows.map(toModel);
}

export function getModel(id: string): Model | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow | undefined;
  if (row?.built_in && isEmptyRecipe(row.recipe_json)) {
    const builtInRecipe = getBuiltInModelRecipe(row.key);
    if (builtInRecipe) {
      row.recipe_json = serializeModelRecipe(builtInRecipe);
      db.prepare('UPDATE models SET recipe_json = ?, updated_at = ? WHERE id = ?')
        .run(row.recipe_json, new Date().toISOString(), row.id);
    }
  }
  return row ? toModel(row) : undefined;
}

export function updateModel(id: string, data: ModelUpdate): Model | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow | undefined;
  if (!existing) return undefined;

  const meaningKeysChanged = data.meaning_keys !== undefined;
  const nextMeaningKeys = data.meaning_keys ?? parseStringArray<SemanticMeaningKey>(existing.meaning_keys);
  const derivedSlots = deriveSlotsForMeanings(nextMeaningKeys);
  const nextKey = data.key !== undefined
    ? getUniqueModelKey(db, existing.project_id, data.key, id)
    : existing.key as ModelRefKey;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE models
        SET key = ?, name = ?, description = ?, category = ?, target_kind = ?, meaning_keys = ?,
            core_slots = ?, optional_slots = ?, recipe_json = ?, color = ?, icon = ?,
            line_style = ?, directed = ?, built_in = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    nextKey,
    data.name !== undefined ? data.name : existing.name,
    data.description !== undefined ? data.description : existing.description,
    data.category !== undefined ? data.category : existing.category,
    data.target_kind !== undefined ? data.target_kind : existing.target_kind,
    serializeStringArray(nextMeaningKeys),
    serializeStringArray(data.core_slots ?? (meaningKeysChanged ? derivedSlots.coreSlots : parseStringArray<MeaningSlotKey>(existing.core_slots))),
    serializeStringArray(data.optional_slots ?? (meaningKeysChanged ? derivedSlots.optionalSlots : parseStringArray<MeaningSlotKey>(existing.optional_slots))),
    data.recipe !== undefined ? serializeModelRecipe(data.recipe) : existing.recipe_json ?? serializeModelRecipe(undefined),
    data.color !== undefined ? data.color : existing.color,
    data.icon !== undefined ? data.icon : existing.icon,
    data.line_style !== undefined ? data.line_style : existing.line_style,
    data.directed !== undefined ? (data.directed == null ? null : (data.directed ? 1 : 0)) : existing.directed,
    data.built_in !== undefined ? (data.built_in ? 1 : 0) : existing.built_in,
    now,
    id,
  );

  replaceModelKeyInSchemas(db, existing.project_id, existing.key, nextKey);

  const row = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow;
  return toModel(row);
}

export function deleteModel(id: string): boolean {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow | undefined;
  if (!existing) return false;

  const result = db.prepare('DELETE FROM models WHERE id = ?').run(id);
  if (result.changes === 0) return false;

  deleteObjectByRef('model', id);
  removeModelKeyFromSchemas(db, existing.project_id, existing.key);
  removeModelFromEdges(db, id);
  return true;
}
