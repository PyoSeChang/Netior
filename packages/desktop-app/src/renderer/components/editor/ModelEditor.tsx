import React, { useEffect, useMemo } from 'react';
import type {
  Schema,
  SchemaField,
  EditorTab,
  FieldType,
  SemanticCategoryRefKey,
  SemanticMeaningKey,
  ModelKey,
  ModelFieldRecipe,
  ModelMeaningRecipe,
  ModelRecipe,
  ModelRefKey,
  ModelRepresentationKind,
  ModelRuleRecipe,
  MeaningSlotKey,
} from '@netior/shared/types';
import {
  getModelDescriptionKey,
  getModelLabelKey,
  getSemanticMeaningLabelKey,
  getMeaningSlotLabelKey,
} from '@netior/shared/constants';
import { Plus, Trash2 } from 'lucide-react';
import { useModelStore } from '../../stores/model-store';
import { useSchemaStore } from '../../stores/schema-store';
import { useProjectStore } from '../../stores/project-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Select } from '../ui/Select';
import { ColorPicker } from '../ui/ColorPicker';
import { IconSelector } from '../ui/IconSelector';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { ScrollArea } from '../ui/ScrollArea';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';
import { getFieldMeaningSlot } from '../../lib/field-meaning-bindings';

interface ModelEditorProps {
  tab: EditorTab;
}

interface ModelEditorState {
  key: ModelRefKey;
  name: string;
  description: string | null;
  category: SemanticCategoryRefKey;
  meaning_keys: SemanticMeaningKey[];
  core_slots: MeaningSlotKey[];
  optional_slots: MeaningSlotKey[];
  recipe: ModelRecipe;
  color: string | null;
  icon: string | null;
  built_in: boolean;
}

interface ModelConsumer {
  schema: Schema;
  linkedToSchema: boolean;
  meaningKeys: SemanticMeaningKey[];
  fields: SchemaField[];
}

const EMPTY_MODEL_STATE: ModelEditorState = {
  key: 'model',
  name: '',
  description: null,
  category: 'knowledge',
  meaning_keys: [],
  core_slots: [],
  optional_slots: [],
  recipe: { meanings: [], rules: [] },
  color: null,
  icon: null,
  built_in: false,
};

const REPRESENTATION_OPTIONS: Array<{ value: ModelRepresentationKind; labelKey: string }> = [
  { value: 'single_field', labelKey: 'model.representation.singleField' },
  { value: 'field_group', labelKey: 'model.representation.fieldGroup' },
  { value: 'relation', labelKey: 'model.representation.relation' },
  { value: 'computed', labelKey: 'model.representation.computed' },
];

const FIELD_TYPE_OPTIONS: Array<{ value: FieldType; labelKey: string }> = [
  { value: 'text', labelKey: 'typeSelector.text' },
  { value: 'textarea', labelKey: 'typeSelector.textarea' },
  { value: 'number', labelKey: 'typeSelector.number' },
  { value: 'boolean', labelKey: 'typeSelector.boolean' },
  { value: 'date', labelKey: 'typeSelector.dateType' },
  { value: 'datetime', labelKey: 'typeSelector.datetime' },
  { value: 'select', labelKey: 'typeSelector.select' },
  { value: 'multi-select', labelKey: 'typeSelector.multi-select' },
  { value: 'radio', labelKey: 'typeSelector.radio' },
  { value: 'relation', labelKey: 'typeSelector.relation' },
  { value: 'file', labelKey: 'typeSelector.file' },
  { value: 'url', labelKey: 'typeSelector.url' },
  { value: 'color', labelKey: 'typeSelector.color' },
  { value: 'rating', labelKey: 'typeSelector.rating' },
  { value: 'tags', labelKey: 'typeSelector.tags' },
  { value: 'schema_ref', labelKey: 'typeSelector.schema_ref' },
];

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

function createLocalId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatKeyInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
}

function normalizeKey(value: string, fallback: string): string {
  const normalized = formatKeyInput(value).replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function isValidQueryKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

function getNextKey(prefix: string, existingKeys: readonly string[]): string {
  const used = new Set(existingKeys);
  let index = 1;
  let candidate = `${prefix}_${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }
  return candidate;
}

function shouldSyncKeyFromName(currentKey: string, previousName: string, fallbackKey: string): boolean {
  return !currentKey || currentKey === fallbackKey || currentKey === normalizeKey(previousName, fallbackKey);
}

function countKeys(keys: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function hasInvalidRecipeKeys(recipe: ModelRecipe): boolean {
  const activeMeanings = recipe.meanings.filter((meaning) => meaning.name.trim().length > 0);
  const meaningKeyCounts = countKeys(activeMeanings.map((meaning) => meaning.key));
  return activeMeanings.some((meaning) => {
    const activeFields = meaning.fields.filter((field) => field.name.trim().length > 0);
    const fieldKeyCounts = countKeys(activeFields.map((field) => field.key));
    return (
    !isValidQueryKey(meaning.key)
    || (meaningKeyCounts.get(meaning.key) ?? 0) > 1
    || activeFields.some((field) => (
      !isValidQueryKey(field.key) || (fieldKeyCounts.get(field.key) ?? 0) > 1
    ))
    );
  });
}

function normalizeRecipe(recipe: ModelRecipe): ModelRecipe {
  return {
    meanings: recipe.meanings
      .map((meaning, meaningIndex) => ({
        ...meaning,
        id: meaning.id || createLocalId('meaning'),
        key: normalizeKey(meaning.key || meaning.name, `meaning_${meaningIndex + 1}`),
        name: meaning.name.trim(),
        description: meaning.description?.trim() || null,
        fields: meaning.fields
          .map((field, fieldIndex) => ({
            ...field,
            id: field.id || createLocalId('field'),
            key: normalizeKey(field.key || field.name, `field_${fieldIndex + 1}`),
            name: field.name.trim(),
            field_types: (field.field_types?.length ?? 0) > 0 ? field.field_types : ['text' as FieldType],
            description: field.description?.trim() || null,
            options: field.options?.trim() || null,
          }))
          .filter((field) => field.name.length > 0),
      }))
      .filter((meaning) => meaning.name.length > 0),
    rules: recipe.rules
      .map((rule) => ({
        ...rule,
        id: rule.id || createLocalId('rule'),
        description: rule.description.trim(),
      }))
      .filter((rule) => rule.description.length > 0),
  };
}

function makeEmptyMeaning(existingKeys: readonly string[] = []): ModelMeaningRecipe {
  return {
    id: createLocalId('meaning'),
    key: getNextKey('meaning', existingKeys),
    name: '',
    description: null,
    representation: 'field_group',
    fields: [],
  };
}

function makeEmptyField(existingKeys: readonly string[] = []): ModelFieldRecipe {
  return {
    id: createLocalId('field'),
    key: getNextKey('field', existingKeys),
    name: '',
    field_types: ['text'],
    required: false,
    description: null,
    options: null,
  };
}

function makeEmptyRule(): ModelRuleRecipe {
  return {
    id: createLocalId('rule'),
    description: '',
  };
}

function normalizeModelRefs(value: unknown): ModelRefKey[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is ModelRefKey => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string') {
    try {
      return normalizeModelRefs(JSON.parse(value));
    } catch {
      return value.trim() ? [value as ModelRefKey] : [];
    }
  }

  return [];
}

export function ModelEditor({ tab }: ModelEditorProps): JSX.Element {
  const { t } = useI18n();
  const modelId = tab.targetId;
  const models = useModelStore((s) => s.models);
  const loadModels = useModelStore((s) => s.loadByProject);
  const updateModel = useModelStore((s) => s.updateModel);
  const currentProject = useProjectStore((s) => s.currentProject);
  const schemas = useSchemaStore((s) => s.schemas);
  const fieldsBySchema = useSchemaStore((s) => s.fields);
  const meaningsBySchema = useSchemaStore((s) => s.meanings);
  const loadSchemas = useSchemaStore((s) => s.loadByProject);
  const loadSchemaFields = useSchemaStore((s) => s.loadFields);
  const loadSchemaMeanings = useSchemaStore((s) => s.loadMeanings);
  const model = models.find((item) => item.id === modelId);
  const projectId = model?.project_id ?? tab.projectId ?? currentProject?.id ?? null;

  useEffect(() => {
    if (projectId) {
      void loadModels(projectId);
      void loadSchemas(projectId);
    }
  }, [loadModels, loadSchemas, projectId]);

  const projectSchemas = useMemo(
    () => schemas.filter((schema) => !projectId || schema.project_id === projectId),
    [projectId, schemas],
  );
  const projectSchemaIdsKey = useMemo(
    () => projectSchemas.map((schema) => schema.id).sort().join('|'),
    [projectSchemas],
  );

  useEffect(() => {
    if (!projectSchemaIdsKey) return;

    let cancelled = false;
    void (async () => {
      for (const schema of projectSchemas) {
        if (cancelled) return;
        await Promise.all([
          loadSchemaFields(schema.id),
          loadSchemaMeanings(schema.id),
        ]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSchemaFields, loadSchemaMeanings, projectSchemaIdsKey, projectSchemas]);

  const session = useEditorSession<ModelEditorState>({
    tabId: tab.id,
    load: () => {
      const current = useModelStore.getState().models.find((item) => item.id === modelId);
      if (!current) return EMPTY_MODEL_STATE;
      return {
        key: current.key,
        name: current.name,
        description: current.description,
        category: current.category,
        meaning_keys: current.meaning_keys,
        core_slots: current.core_slots,
        optional_slots: current.optional_slots,
        recipe: current.recipe ?? { meanings: [], rules: [] },
        color: current.color,
        icon: current.icon,
        built_in: current.built_in,
      };
    },
    save: async (state) => {
      const normalizedRecipe = normalizeRecipe(state.recipe);
      const modelKey = String(state.key) as ModelRefKey;
      const duplicateModelKey = models.some((item) => item.id !== modelId && item.key === modelKey);
      if (!isValidQueryKey(modelKey) || duplicateModelKey || hasInvalidRecipeKeys(state.recipe)) {
        throw new Error('Invalid model query keys');
      }
      await updateModel(modelId, {
        key: modelKey,
        name: state.name,
        description: state.description,
        category: normalizeKey(String(state.category), 'general') as SemanticCategoryRefKey,
        meaning_keys: state.meaning_keys,
        core_slots: state.core_slots,
        optional_slots: state.optional_slots,
        recipe: normalizedRecipe,
        color: state.color,
        icon: state.icon,
        built_in: state.built_in,
      });
      useEditorStore.getState().updateTitle(tab.id, state.name || t('model.title' as never));
    },
    deps: [modelId],
  });

  const modelConsumers = useMemo<ModelConsumer[]>(() => {
    if (!model) return [];

    const modelKey = model.key;
    const modelSlotKeys = new Set<MeaningSlotKey>([
      ...model.core_slots,
      ...model.optional_slots,
    ]);

    return projectSchemas.flatMap((schema) => {
      const schemaModelRefs = [
        ...normalizeModelRefs(schema.models),
      ];
      const linkedToSchema = schemaModelRefs.includes(modelKey);
      const schemaMeanings = meaningsBySchema[schema.id] ?? [];
      const modelMeanings = schemaMeanings.filter((meaning) => (
        meaning.source_model === modelKey || meaning.source_model === modelKey
      ));
      const meaningKeys = [...new Set(modelMeanings.map((meaning) => meaning.meaning_key))];
      const boundFieldIds = new Set(
        modelMeanings.flatMap((meaning) => (
          meaning.slots.map((slot) => slot.field_id).filter((fieldId): fieldId is string => Boolean(fieldId))
        )),
      );
      const schemaFields = fieldsBySchema[schema.id] ?? [];
      const fieldById = new Map(schemaFields.map((field) => [field.id, field]));
      const fields = [
        ...[...boundFieldIds].map((fieldId) => fieldById.get(fieldId)).filter((field): field is SchemaField => Boolean(field)),
        ...schemaFields.filter((field) => (
          linkedToSchema
          && Boolean(getFieldMeaningSlot(field) && modelSlotKeys.has(getFieldMeaningSlot(field)!))
          && !boundFieldIds.has(field.id)
        )),
      ].sort((a, b) => a.sort_order - b.sort_order);

      if (!linkedToSchema && meaningKeys.length === 0 && fields.length === 0) return [];

      return [{
        schema,
        linkedToSchema,
        meaningKeys,
        fields,
      }];
    });
  }, [fieldsBySchema, meaningsBySchema, model, projectSchemas]);

  if (!model) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('model.notFound' as never)}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  const isBuiltInModel = session.state.built_in;
  const displayName = isBuiltInModel
    ? t(getModelLabelKey(session.state.key as ModelKey) as never)
    : session.state.name;
  const displayDescription = isBuiltInModel
    ? t(getModelDescriptionKey(session.state.key as ModelKey) as never)
    : session.state.description ?? '';
  const duplicateModelKey = models.some((item) => item.id !== modelId && item.key === session.state.key);
  const getKeyError = (key: string, duplicate: boolean): string | null => {
    if (!isValidQueryKey(key)) return t('model.keyInvalid' as never);
    if (duplicate) return t('model.keyDuplicate' as never);
    return null;
  };
  const modelKeyError = isBuiltInModel
    ? null
    : getKeyError(session.state.key, duplicateModelKey);
  const meaningKeyCounts = countKeys(session.state.recipe.meanings.map((meaning) => meaning.key));
  const meaningKeyErrors = new Map(session.state.recipe.meanings.map((meaning) => [
    meaning.id,
    getKeyError(meaning.key, (meaningKeyCounts.get(meaning.key) ?? 0) > 1),
  ]));
  const fieldKeyErrors = new Map<string, string | null>();
  for (const meaning of session.state.recipe.meanings) {
    const fieldKeyCounts = countKeys(meaning.fields.map((field) => field.key));
    for (const field of meaning.fields) {
      fieldKeyErrors.set(
        field.id,
        getKeyError(field.key, (fieldKeyCounts.get(field.key) ?? 0) > 1),
      );
    }
  }
  const hasKeyValidationError = Boolean(modelKeyError)
    || [...meaningKeyErrors.values()].some(Boolean)
    || [...fieldKeyErrors.values()].some(Boolean);

  const update = (patch: Partial<ModelEditorState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const updateRecipe = (recipe: ModelRecipe) => {
    update({ recipe });
  };

  const updateMeaning = (meaningId: string, patch: Partial<ModelMeaningRecipe>) => {
    updateRecipe({
      ...session.state.recipe,
      meanings: session.state.recipe.meanings.map((meaning) => (
        meaning.id === meaningId ? { ...meaning, ...patch } : meaning
      )),
    });
  };

  const updateField = (
    meaningId: string,
    fieldId: string,
    patch: Partial<ModelFieldRecipe>,
  ) => {
    updateRecipe({
      ...session.state.recipe,
      meanings: session.state.recipe.meanings.map((meaning) => (
        meaning.id === meaningId
          ? {
            ...meaning,
            fields: meaning.fields.map((field) => (
              field.id === fieldId ? { ...field, ...patch } : field
            )),
          }
          : meaning
      )),
    });
  };

  const toggleFieldType = (meaningId: string, field: ModelFieldRecipe, fieldType: FieldType) => {
    const current = new Set(field.field_types ?? []);
    if (current.has(fieldType)) {
      current.delete(fieldType);
    } else {
      current.add(fieldType);
    }
    updateField(meaningId, field.id, {
      field_types: current.size > 0 ? [...current] : ['text'],
    });
  };

  const previewFields = session.state.recipe.meanings.flatMap((meaning) => (
    meaning.fields.map((field) => ({ meaning, field }))
  ));
  const fieldTypeLabelByValue = useMemo(
    () => new Map(FIELD_TYPE_OPTIONS.map((option) => [option.value, t(option.labelKey as never)])),
    [t],
  );
  const formatFieldTypes = (fieldTypes: FieldType[] | undefined): string => {
    const normalizedFieldTypes = fieldTypes && fieldTypes.length > 0 ? fieldTypes : ['text' as FieldType];
    return normalizedFieldTypes
      .map((fieldType) => fieldTypeLabelByValue.get(fieldType) ?? fieldType)
      .join(', ');
  };

  return (
    <ScrollArea className="h-full min-h-0">
      <NetworkObjectEditorShell
        badge={t('model.title' as never)}
        title={displayName || model.name}
        subtitle={t('editorShell.networkObject' as never)}
        description={displayDescription || t('model.descriptionPlaceholder' as never)}
      >
        <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">{t('model.name' as never)}</label>
              <Input
                value={displayName}
                onChange={(event) => update({ name: event.target.value })}
                disabled={isBuiltInModel}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">{t('model.key' as never)}</label>
              <Input
                value={session.state.key}
                onChange={(event) => update({ key: formatKeyInput(event.target.value) as ModelRefKey })}
                inputSize="sm"
                disabled={isBuiltInModel}
                error={Boolean(modelKeyError)}
              />
              <div className={`text-[11px] ${modelKeyError ? 'text-status-error' : 'text-muted'}`}>
                {modelKeyError ?? t('model.keyHint' as never)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('model.description' as never)}</label>
            <TextArea
              value={displayDescription}
              onChange={(event) => update({ description: event.target.value || null })}
              rows={3}
              placeholder={t('model.descriptionPlaceholder' as never)}
              disabled={isBuiltInModel}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">{t('model.category' as never)}</label>
              <Input
                value={session.state.category}
                onChange={(event) => update({ category: normalizeKey(event.target.value, 'general') as SemanticCategoryRefKey })}
                placeholder={t('model.categoryPlaceholder' as never)}
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Badge variant={session.state.built_in ? 'accent' : 'default'}>
                {session.state.built_in ? t('model.builtIn' as never) : t('model.custom' as never)}
              </Badge>
            </div>
          </div>

          {hasKeyValidationError && (
            <div className="rounded-lg border border-status-error/40 bg-status-error/10 px-3 py-2 text-xs text-status-error">
              {t('model.keyValidationSummary' as never)}
            </div>
          )}
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('model.meanings' as never)}>
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => updateRecipe({
                  ...session.state.recipe,
                  meanings: [
                    ...session.state.recipe.meanings,
                    makeEmptyMeaning(session.state.recipe.meanings.map((meaning) => meaning.key)),
                  ],
                })}
              >
                <Plus size={14} />
                {t('model.addMeaning' as never)}
              </Button>
            </div>

            {session.state.recipe.meanings.length === 0 && (
              <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-xs text-muted">
                {t('model.noMeanings' as never)}
              </div>
            )}

            {session.state.recipe.meanings.map((meaning, meaningIndex) => {
              const meaningKeyError = meaningKeyErrors.get(meaning.id) ?? null;
              return (
              <div key={meaning.id} className="rounded-lg border border-subtle bg-surface-editor p-3">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_190px_auto] md:items-start">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-secondary">{t('model.meaningName' as never)}</label>
                    <Input
                      inputSize="sm"
                      value={meaning.name}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        const fallbackKey = `meaning_${meaningIndex + 1}`;
                        updateMeaning(meaning.id, {
                          name: nextName,
                          ...(shouldSyncKeyFromName(meaning.key, meaning.name, fallbackKey)
                            ? { key: normalizeKey(nextName, fallbackKey) }
                            : {}),
                        });
                      }}
                      placeholder={t('model.meaningNamePlaceholder' as never)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-secondary">{t('model.meaningKey' as never)}</label>
                    <Input
                      inputSize="sm"
                      value={meaning.key}
                      onChange={(event) => updateMeaning(meaning.id, { key: formatKeyInput(event.target.value) })}
                      error={Boolean(meaningKeyError)}
                    />
                    <div className={`text-[11px] ${meaningKeyError ? 'text-status-error' : 'text-muted'}`}>
                      {meaningKeyError ?? t('model.keyHintShort' as never)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-secondary">{t('model.representation.label' as never)}</label>
                    <Select
                      selectSize="sm"
                      value={meaning.representation}
                      options={REPRESENTATION_OPTIONS.map((option) => ({
                        value: option.value,
                        label: t(option.labelKey as never),
                      }))}
                      onChange={(event) => updateMeaning(meaning.id, {
                        representation: event.target.value as ModelRepresentationKind,
                      })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-5"
                    onClick={() => updateRecipe({
                      ...session.state.recipe,
                      meanings: session.state.recipe.meanings.filter((item) => item.id !== meaning.id),
                    })}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>

                <div className="mt-2">
                  <TextArea
                    value={meaning.description ?? ''}
                    onChange={(event) => updateMeaning(meaning.id, { description: event.target.value || null })}
                    rows={2}
                    placeholder={t('model.meaningDescriptionPlaceholder' as never)}
                  />
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-secondary">{t('model.fields' as never)}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => updateMeaning(meaning.id, {
                        fields: [
                          ...meaning.fields,
                          makeEmptyField(meaning.fields.map((field) => field.key)),
                        ],
                      })}
                    >
                      <Plus size={14} />
                      {t('model.addField' as never)}
                    </Button>
                  </div>

                  {meaning.fields.length === 0 && (
                    <div className="rounded border border-subtle bg-surface-card px-3 py-2 text-xs text-muted">
                      {t('model.noFields' as never)}
                    </div>
                  )}

                  {meaning.fields.map((field, fieldIndex) => {
                    const fieldKeyError = fieldKeyErrors.get(field.id) ?? null;
                    return (
                    <div key={field.id} className="rounded border border-subtle bg-surface-card px-2.5 py-2">
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_auto_auto] md:items-start">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-secondary">{t('model.fieldName' as never)}</label>
                          <Input
                            inputSize="sm"
                            value={field.name}
                            onChange={(event) => {
                              const nextName = event.target.value;
                              const fallbackKey = `field_${fieldIndex + 1}`;
                              updateField(meaning.id, field.id, {
                                name: nextName,
                                ...(shouldSyncKeyFromName(field.key, field.name, fallbackKey)
                                  ? { key: normalizeKey(nextName, fallbackKey) }
                                  : {}),
                              });
                            }}
                            placeholder={t('model.fieldName' as never)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-secondary">{t('model.fieldKey' as never)}</label>
                          <Input
                            inputSize="sm"
                            value={field.key}
                            onChange={(event) => updateField(meaning.id, field.id, { key: formatKeyInput(event.target.value) })}
                            error={Boolean(fieldKeyError)}
                          />
                          <div className={`text-[11px] ${fieldKeyError ? 'text-status-error' : 'text-muted'}`}>
                            {fieldKeyError ?? t('model.keyHintShort' as never)}
                          </div>
                        </div>
                        <div className="pt-5">
                          <Toggle
                            checked={field.required}
                            onChange={(checked) => updateField(meaning.id, field.id, { required: checked })}
                            label={t('schema.required')}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-5"
                          onClick={() => updateMeaning(meaning.id, {
                            fields: meaning.fields.filter((item) => item.id !== field.id),
                          })}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="mt-2">
                        <div className="mb-1.5 text-[11px] font-medium text-secondary">
                          {t('model.fieldTypes' as never)}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {FIELD_TYPE_OPTIONS.map((typeOption) => {
                            const selected = (field.field_types ?? []).includes(typeOption.value);
                            return (
                              <button
                                key={typeOption.value}
                                type="button"
                                className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                                  selected
                                    ? 'border-accent bg-accent-muted text-accent'
                                    : 'border-subtle bg-surface-editor text-secondary hover:border-default hover:text-default'
                                }`}
                                onClick={() => toggleFieldType(meaning.id, field, typeOption.value)}
                              >
                                {t(typeOption.labelKey as never)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <Input
                          inputSize="sm"
                          value={field.description ?? ''}
                          onChange={(event) => updateField(meaning.id, field.id, { description: event.target.value || null })}
                          placeholder={t('model.fieldDescriptionPlaceholder' as never)}
                        />
                        <Input
                          inputSize="sm"
                          value={field.options ?? ''}
                          onChange={(event) => updateField(meaning.id, field.id, { options: event.target.value || null })}
                          placeholder={t('model.fieldOptionsPlaceholder' as never)}
                        />
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('model.rules' as never)}>
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => updateRecipe({
                  ...session.state.recipe,
                  rules: [...session.state.recipe.rules, makeEmptyRule()],
                })}
              >
                <Plus size={14} />
                {t('model.addRule' as never)}
              </Button>
            </div>
            {session.state.recipe.rules.length === 0 && (
              <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-xs text-muted">
                {t('model.noRules' as never)}
              </div>
            )}
            {session.state.recipe.rules.map((rule) => (
              <div key={rule.id} className="grid gap-2 rounded-lg border border-subtle bg-surface-editor px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  inputSize="sm"
                  value={rule.description}
                  onChange={(event) => updateRecipe({
                    ...session.state.recipe,
                    rules: session.state.recipe.rules.map((item) => (
                      item.id === rule.id ? { ...item, description: event.target.value } : item
                    )),
                  })}
                  placeholder={t('model.rulePlaceholder' as never)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => updateRecipe({
                    ...session.state.recipe,
                    rules: session.state.recipe.rules.filter((item) => item.id !== rule.id),
                  })}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('model.preview' as never)} defaultOpen={false}>
          <div className="flex flex-col gap-2">
            {previewFields.length === 0 && (
              <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-xs text-muted">
                {t('model.noPreview' as never)}
              </div>
            )}
            {previewFields.map(({ meaning, field }) => (
              <div key={`${meaning.id}:${field.id}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-editor px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-default">{field.name || t('model.fieldName' as never)}</div>
                  <div className="truncate text-[11px] text-secondary">{meaning.name || t('model.meaningName' as never)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-secondary">
                  <span className="rounded bg-state-hover px-2 py-0.5">{formatFieldTypes(field.field_types)}</span>
                  {field.required && <span className="rounded bg-accent-muted px-2 py-0.5 text-accent">{t('schema.required')}</span>}
                </div>
              </div>
            ))}
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('model.consumers' as never)} defaultOpen={false}>
          <div className="flex flex-col gap-2">
            {modelConsumers.length === 0 && (
              <div className="rounded-lg border border-subtle bg-surface-editor px-3 py-3 text-xs text-muted">
                {t('model.noConsumers' as never)}
              </div>
            )}
            {modelConsumers.map((consumer) => (
              <div key={consumer.schema.id} className="rounded-lg border border-subtle bg-surface-editor px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-default">{consumer.schema.name}</div>
                    <div className="mt-0.5 text-[11px] text-secondary">{t('schema.title')}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {consumer.linkedToSchema && (
                      <span className="rounded bg-accent-muted px-2 py-0.5 text-[11px] text-accent">
                        {t('model.consumerSchemaLink' as never)}
                      </span>
                    )}
                    <span className="rounded bg-state-hover px-2 py-0.5 text-[11px] text-secondary">
                      {t('model.consumerMeaningCount' as never).replace('{count}', String(consumer.meaningKeys.length))}
                    </span>
                    <span className="rounded bg-state-hover px-2 py-0.5 text-[11px] text-secondary">
                      {t('model.consumerFieldCount' as never).replace('{count}', String(consumer.fields.length))}
                    </span>
                  </div>
                </div>

                {consumer.meaningKeys.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {consumer.meaningKeys.map((meaningKey) => (
                      <span key={meaningKey} className="rounded bg-surface-card px-2 py-0.5 text-[11px] text-secondary">
                        {t(getSemanticMeaningLabelKey(meaningKey) as never)}
                      </span>
                    ))}
                  </div>
                )}

                {consumer.fields.length > 0 && (
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {consumer.fields.map((field) => (
                      <div key={field.id} className="flex min-w-0 items-center justify-between gap-2 rounded border border-subtle bg-surface-card px-2 py-1.5">
                        <span className="truncate text-xs text-default">{field.name}</span>
                        <span className="shrink-0 text-[11px] text-muted">
                          {getFieldMeaningSlot(field) ? t(getMeaningSlotLabelKey(getFieldMeaningSlot(field)!) as never) : field.field_type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('schema.visualDefaults')} defaultOpen={false}>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('schema.icon')}</span>
              <IconSelector
                value={session.state.icon ?? undefined}
                onChange={(icon) => update({ icon })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('schema.color')}</span>
              <ColorPicker
                value={session.state.color ?? undefined}
                onChange={(color) => update({ color })}
              />
            </div>
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
          <NetworkObjectMetadataList
            items={[
              { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{model.id}</code> },
              { label: t('model.meanings' as never), value: `${session.state.recipe.meanings.length}` },
              { label: t('model.fields' as never), value: `${previewFields.length}` },
            ]}
          />
        </NetworkObjectEditorSection>
      </NetworkObjectEditorShell>
    </ScrollArea>
  );
}
