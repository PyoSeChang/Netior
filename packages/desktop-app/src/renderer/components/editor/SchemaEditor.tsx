import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SchemaMeaning,
  SchemaMeaningSlotBinding,
  EditorTab,
  SemanticCategoryRefKey,
  SemanticMeaningKey,
  ModelKey,
  ModelRefKey,
  MeaningSlotKey,
  TypeGroup,
} from '@netior/shared/types';
import {
  MODEL_DEFINITIONS,
  getModelDescriptionKey,
  getModelLabelKey,
  getMeaningSlotDefinition,
  getMeaningSlotLabelKey,
  fieldMeaningToMeaningBindings,
} from '@netior/shared/constants';
import type { TranslationKey } from '@netior/shared/i18n';
import { useSchemaStore } from '../../stores/schema-store';
import { useEditorStore } from '../../stores/editor-store';
import { useModelStore } from '../../stores/model-store';
import { useTypeGroupStore } from '../../stores/type-group-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { IconSelector } from '../ui/IconSelector';
import { ColorPicker } from '../ui/ColorPicker';
import { Select } from '../ui/Select';
import { ScrollArea } from '../ui/ScrollArea';
import { SchemaSlotDesigner, type ModelOptionDefinition } from './SchemaSlotDesigner';
import { useSettingsStore } from '../../stores/settings-store';
import { useUIStore } from '../../stores/ui-store';
import { stringifySchemaFieldOptions } from '../../lib/schema-field-options';
import { getFieldMeaningSlot } from '../../lib/field-meaning-bindings';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';

interface SchemaEditorProps {
  tab: EditorTab;
}

interface SchemaState {
  group_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  node_shape: string | null;
  file_template: string | null;
  models: ModelRefKey[];
}

const EMPTY_SCHEMA_STATE: SchemaState = {
  group_id: null,
  name: '',
  description: null,
  icon: null,
  color: null,
  node_shape: null,
  file_template: null,
  models: [],
};

function normalizeModelRefs(value: unknown): ModelRefKey[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is ModelRefKey => typeof item === 'string');
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

function getDefaultFieldOptionsForSlot(slot: MeaningSlotKey): string | null {
  switch (slot) {
    case 'recurrence_frequency':
      return stringifySchemaFieldOptions({ choices: ['daily', 'weekly', 'monthly'] });
    case 'recurrence_weekdays':
      return stringifySchemaFieldOptions({ choices: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] });
    default:
      return null;
  }
}

function getAutoCreateBindingsForMeaning(meaning: SchemaMeaning): SchemaMeaningSlotBinding[] {
  if (meaning.meaning_key === 'recurrence') return meaning.slots;
  return meaning.slots.filter((slot) => slot.required);
}

export function SchemaEditor({ tab }: SchemaEditorProps): JSX.Element {
  const { t } = useI18n();
  const schemaId = tab.targetId;
  const schemas = useSchemaStore((s) => s.schemas);
  const fields = useSchemaStore((s) => s.fields[schemaId] ?? []);
  const meanings = useSchemaStore((s) => s.meanings[schemaId] ?? []);
  const projectModels = useModelStore((s) => s.models);
  const loadModels = useModelStore((s) => s.loadByProject);
  const groups = useTypeGroupStore((s) => s.groupsByKind.schema);
  const {
    loadFields,
    loadMeanings,
    createField,
    updateField,
    deleteField,
    ensureMeaning,
    updateMeaningSlot,
  } = useSchemaStore();
  const updateSchema = useSchemaStore((s) => s.updateSchema);
  const fieldComplexityLevel = useSettingsStore((s) => s.fieldComplexityLevel);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const [activeSemanticCategory, setActiveSemanticCategory] = useState<SemanticCategoryRefKey>('time');

  const schema = schemas.find((a) => a.id === schemaId);

  useEffect(() => {
    loadFields(schemaId);
    loadMeanings(schemaId);
  }, [schemaId, loadFields, loadMeanings]);

  useEffect(() => {
    if (schema?.project_id) {
      void loadModels(schema.project_id);
    }
  }, [schema?.project_id, loadModels]);

  const session = useEditorSession<SchemaState>({
    tabId: tab.id,
    load: () => {
      const a = useSchemaStore.getState().schemas.find((ar) => ar.id === schemaId);
      if (!a) return EMPTY_SCHEMA_STATE;
      return {
        group_id: a.group_id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        color: a.color,
        node_shape: a.node_shape,
        file_template: a.file_template,
        models: normalizeModelRefs(a.models),
      };
    },
    save: async (state) => {
      await updateSchema(schemaId, {
        ...state,
        models: normalizeModelRefs(state.models),
      });
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [schemaId],
  });
  const editorState = session.state ?? EMPTY_SCHEMA_STATE;
  const selectedModels = useMemo(
    () => normalizeModelRefs(editorState.models),
    [editorState.models],
  );
  const modelDefinitions = useMemo<readonly ModelOptionDefinition[]>(() => {
    if (projectModels.length > 0) {
      return projectModels.map((model) => ({
        key: model.key,
        category: model.category,
        label: model.built_in ? t(getModelLabelKey(model.key as ModelKey) as never) : model.name,
        description: model.built_in ? t(getModelDescriptionKey(model.key as ModelKey) as never) : model.description,
        meanings: model.meaning_keys,
        coreSlots: model.core_slots,
        optionalSlots: model.optional_slots,
        builtIn: model.built_in,
      }));
    }

    return MODEL_DEFINITIONS.map((definition) => ({
      key: definition.key,
      category: definition.category,
      label: t(getModelLabelKey(definition.key) as never),
      description: t(getModelDescriptionKey(definition.key) as never),
      meanings: definition.meanings,
      coreSlots: definition.coreSlots,
      optionalSlots: definition.optionalSlots,
      builtIn: true,
    }));
  }, [projectModels, t]);
  const modelDefinitionByKey = useMemo(
    () => new Map(modelDefinitions.map((definition) => [definition.key, definition])),
    [modelDefinitions],
  );
  const modelSignature = useMemo(
    () => [...selectedModels].sort().join('|'),
    [selectedModels],
  );
  const modelFieldSyncSignatureRef = useRef('');

  const update = (patch: Partial<SchemaState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const handleEnsureMeaning = useCallback(async (
    meaning: SemanticMeaningKey,
    options: { sourceModel?: ModelRefKey | null } = {},
  ) => {
    useEditorStore.getState().setDirty(tab.id, true);
    await ensureMeaning({
      schema_id: schemaId,
      meaning_key: meaning,
      source: options.sourceModel ? 'model' : 'manual',
      source_model: options.sourceModel ?? null,
    });
  }, [schemaId, ensureMeaning, tab.id]);

  const handleCreateFieldForSlot = useCallback(async (
    binding: SchemaMeaningSlotBinding,
    meaning: { source: string; source_model?: ModelRefKey | null },
    options: { markEditorDirty?: boolean } = {},
  ) => {
    const slot = binding.slot_key;
    const currentFields = useSchemaStore.getState().fields[schemaId] ?? [];
    const existingField = currentFields.find((field) => getFieldMeaningSlot(field) === slot);
    if (existingField) {
      await updateMeaningSlot(binding.id, schemaId, {
        target_kind: 'field',
        field_id: existingField.id,
      });
      return;
    }

    const slotDefinition = getMeaningSlotDefinition(slot);
    if (!slotDefinition) return;

    if (options.markEditorDirty !== false) {
      useEditorStore.getState().setDirty(tab.id, true);
    }
    const field = await createField({
      schema_id: schemaId,
      name: t(getMeaningSlotLabelKey(slot) as never),
      field_type: slotDefinition.allowedFieldTypes[0],
      options: getDefaultFieldOptionsForSlot(slot) ?? undefined,
      sort_order: currentFields.length,
      required: binding.required,
      meaning_bindings: fieldMeaningToMeaningBindings(slotDefinition.fieldMeaning),
      slot_binding_locked: true,
      generated_by_model: meaning.source === 'model' || Boolean(meaning.source_model),
    });
    await updateMeaningSlot(binding.id, schemaId, {
      target_kind: 'field',
      field_id: field.id,
    });
  }, [schemaId, createField, t, tab.id, updateMeaningSlot]);

  useEffect(() => {
    modelFieldSyncSignatureRef.current = '';
  }, [schemaId]);

  useEffect(() => {
    if (!modelSignature) return;

    const signature = `${schemaId}:${modelSignature}`;
    if (modelFieldSyncSignatureRef.current === signature) return;

    let cancelled = false;
    void (async () => {
      await loadFields(schemaId);
      if (cancelled) return;

      for (const model of selectedModels) {
        const modelDefinition = modelDefinitionByKey.get(model);
        if (!modelDefinition) continue;

        for (const meaningKey of modelDefinition.meanings) {
          const meaning = await ensureMeaning({
            schema_id: schemaId,
            meaning_key: meaningKey,
            source: 'model',
            source_model: model,
          });
          if (cancelled) return;

          for (const binding of getAutoCreateBindingsForMeaning(meaning)) {
            await handleCreateFieldForSlot(binding, meaning, { markEditorDirty: false });
            if (cancelled) return;
          }
        }
      }

      modelFieldSyncSignatureRef.current = signature;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    schemaId,
    ensureMeaning,
    handleCreateFieldForSlot,
    loadFields,
    modelDefinitionByKey,
    modelSignature,
    selectedModels,
  ]);

  const handleUpdateField = useCallback(
    (id: string, data: Parameters<typeof updateField>[2]) => {
      useEditorStore.getState().setDirty(tab.id, true);
      updateField(id, schemaId, data);
    },
    [schemaId, tab.id, updateField],
  );

  const handleDeleteField = useCallback(
    (id: string) => {
      useEditorStore.getState().setDirty(tab.id, true);
      deleteField(id, schemaId);
    },
    [schemaId, tab.id, deleteField],
  );

  const handleToggleModel = useCallback(async (model: ModelRefKey, checked: boolean) => {
    const nextModels = checked
      ? [...new Set([...selectedModels, model])]
      : selectedModels.filter((item) => item !== model);

    useEditorStore.getState().setDirty(tab.id, true);
    session.setState((prev) => ({ ...prev, models: nextModels }));

    if (!checked) return;

    const modelDefinition = modelDefinitionByKey.get(model);
    if (!modelDefinition) return;

    for (const meaningKey of modelDefinition.meanings) {
      const meaning = await ensureMeaning({
        schema_id: schemaId,
        meaning_key: meaningKey,
        source: 'model',
        source_model: model,
      });
      for (const binding of getAutoCreateBindingsForMeaning(meaning)) {
        await handleCreateFieldForSlot(binding, meaning);
      }
    }
  }, [schemaId, ensureMeaning, handleCreateFieldForSlot, modelDefinitionByKey, selectedModels, session, tab.id]);

  const nodeShapeOptions = [
    { value: 'rectangle', label: t('schema.rectangle') },
    { value: 'rounded', label: t('schema.rounded') },
    { value: 'circle', label: t('schema.circle') },
    { value: 'diamond', label: t('schema.diamond') },
    { value: 'hexagon', label: t('schema.hexagon') },
    { value: 'parallelogram', label: t('schema.parallelogram') },
    { value: 'cylinder', label: t('schema.cylinder') },
    { value: 'stadium', label: t('schema.stadium') },
  ];

  const buildGroupOptions = useCallback((items: TypeGroup[], parentGroupId: string | null = null, depth = 0): Array<{ value: string; label: string }> => {
    return items
      .filter((item) => (item.parent_group_id ?? null) === parentGroupId)
      .flatMap((item) => ([
        { value: item.id, label: `${'  '.repeat(depth)}${item.name}` },
        ...buildGroupOptions(items, item.id, depth + 1),
      ]));
  }, []);

  const groupOptions = useMemo(() => [
    { value: '', label: t('typeGroup.ungrouped') },
    ...buildGroupOptions(groups),
  ], [groups, buildGroupOptions, t]);

  if (!schema) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('schema.notFound')}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  return (
    <ScrollArea className="h-full min-h-0">
      <NetworkObjectEditorShell
        badge={t('schema.title')}
        title={editorState.name || schema.name}
        subtitle={t('editorShell.networkObject' as never)}
        description={t('schema.descriptionPlaceholder')}
      >
        <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('typeGroup.group' as TranslationKey)}</label>
            <Select
              options={groupOptions}
              value={editorState.group_id ?? ''}
              onChange={(e) => update({ group_id: e.target.value || null })}
              selectSize="sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('schema.name')}</label>
            <Input
              value={editorState.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('schema.description')}</label>
            <TextArea
              value={editorState.description ?? ''}
              onChange={(e) => update({ description: e.target.value || null })}
              rows={4}
              placeholder={t('schema.descriptionPlaceholder')}
            />
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('schema.visualDefaults')}>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-secondary">{t('schema.icon')}</span>
            <IconSelector
              value={editorState.icon ?? undefined}
              onChange={(icon) => update({ icon })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-secondary">{t('schema.color')}</span>
            <ColorPicker
              value={editorState.color ?? undefined}
              onChange={(color) => update({ color })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-secondary">{t('schema.nodeShape')}</span>
            <Select
              options={nodeShapeOptions}
              value={editorState.node_shape ?? ''}
              onChange={(e) => update({ node_shape: e.target.value || null })}
              placeholder={t('schema.nodeShapePlaceholder')}
              selectSize="sm"
            />
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('schema.fileTemplate')} defaultOpen={false}>
          <TextArea
            value={editorState.file_template ?? ''}
            onChange={(e) => update({ file_template: e.target.value || null })}
            rows={6}
            placeholder={t('schema.fileTemplatePlaceholder')}
            className="font-mono text-xs"
          />
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('schema.propertySchema')}>
          <SchemaSlotDesigner
            tabId={tab.id}
            fields={fields}
            meanings={meanings}
            selectedModels={selectedModels}
            modelDefinitions={modelDefinitions}
            activeCategory={activeSemanticCategory}
            fieldComplexityLevel={fieldComplexityLevel}
            onActiveCategoryChange={setActiveSemanticCategory}
            onToggleModel={handleToggleModel}
            onEnsureMeaning={handleEnsureMeaning}
            onCreateFieldForSlot={handleCreateFieldForSlot}
            onUpdateField={handleUpdateField}
            onDeleteField={handleDeleteField}
            onOpenSettings={() => setShowSettings(true)}
          />
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
          <NetworkObjectMetadataList
            items={[
              { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{schema.id}</code> },
            ]}
          />
        </NetworkObjectEditorSection>
      </NetworkObjectEditorShell>
    </ScrollArea>
  );
}
