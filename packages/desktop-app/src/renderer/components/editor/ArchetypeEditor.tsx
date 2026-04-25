import React, { useEffect, useCallback, useMemo, useState } from 'react';
import type { EditorTab, SemanticCategoryKey, SemanticTraitKey, TypeGroup } from '@netior/shared/types';
import {
  SEMANTIC_CATEGORY_LABELS,
  SEMANTIC_TRAIT_DEFINITIONS,
  getSemanticCategoryDescriptionKey,
  getSemanticCategoryLabelKey,
  getSemanticTraitDefinition,
  getSemanticTraitDescriptionKey,
  getSemanticTraitLabelKey,
  getSystemSlotDescriptionKey,
  getSystemSlotDefinition,
  getSystemSlotLabelKey,
} from '@netior/shared/constants';
import type { TranslationKey } from '@netior/shared/i18n';
import { Plus } from 'lucide-react';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import { useTypeGroupStore } from '../../stores/type-group-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { IconSelector } from '../ui/IconSelector';
import { ColorPicker } from '../ui/ColorPicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/ScrollArea';
import { Checkbox } from '../ui/Checkbox';
import { ArchetypeFieldRow } from './ArchetypeFieldRow';
import { useSettingsStore } from '../../stores/settings-store';
import { useUIStore } from '../../stores/ui-store';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';

interface ArchetypeEditorProps {
  tab: EditorTab;
}

interface ArchetypeState {
  group_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  node_shape: string | null;
  file_template: string | null;
  semantic_traits: SemanticTraitKey[];
}

const EMPTY_ARCHETYPE_STATE: ArchetypeState = {
  group_id: null,
  name: '',
  description: null,
  icon: null,
  color: null,
  node_shape: null,
  file_template: null,
  semantic_traits: [],
};

function normalizeSemanticTraits(value: unknown): SemanticTraitKey[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is SemanticTraitKey => typeof item === 'string');
  }

  if (typeof value === 'string') {
    try {
      return normalizeSemanticTraits(JSON.parse(value));
    } catch {
      return value.trim() ? [value as SemanticTraitKey] : [];
    }
  }

  return [];
}

export function ArchetypeEditor({ tab }: ArchetypeEditorProps): JSX.Element {
  const { t } = useI18n();
  const archetypeId = tab.targetId;
  const archetypes = useArchetypeStore((s) => s.archetypes);
  const fields = useArchetypeStore((s) => s.fields[archetypeId] ?? []);
  const groups = useTypeGroupStore((s) => s.groupsByKind.archetype);
  const { loadFields, createField, updateField, deleteField } = useArchetypeStore();
  const updateArchetype = useArchetypeStore((s) => s.updateArchetype);
  const fieldComplexityLevel = useSettingsStore((s) => s.fieldComplexityLevel);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const [activeSemanticCategory, setActiveSemanticCategory] = useState<SemanticCategoryKey>('time');

  const archetype = archetypes.find((a) => a.id === archetypeId);

  useEffect(() => {
    loadFields(archetypeId);
  }, [archetypeId, loadFields]);

  const session = useEditorSession<ArchetypeState>({
    tabId: tab.id,
    load: () => {
      const a = useArchetypeStore.getState().archetypes.find((ar) => ar.id === archetypeId);
      if (!a) {
        return {
          group_id: null,
          name: '',
          description: null,
          icon: null,
          color: null,
          node_shape: null,
          file_template: null,
          semantic_traits: [],
        };
      }
      return {
        group_id: a.group_id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        color: a.color,
        node_shape: a.node_shape,
        file_template: a.file_template,
        semantic_traits: normalizeSemanticTraits(a.semantic_traits),
      };
    },
    save: async (state) => {
      await updateArchetype(archetypeId, {
        ...state,
        semantic_traits: normalizeSemanticTraits(state.semantic_traits),
      });
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [archetypeId],
  });
  const editorState = session.state ?? EMPTY_ARCHETYPE_STATE;
  const semanticTraits = useMemo(
    () => normalizeSemanticTraits(editorState.semantic_traits),
    [editorState.semantic_traits],
  );

  const handleAddField = async () => {
    useEditorStore.getState().setDirty(tab.id, true);
    await createField({
      archetype_id: archetypeId,
      name: '',
      field_type: 'text',
      sort_order: fields.length,
    });
  };

  const handleUpdateField = useCallback(
    (id: string, data: Parameters<typeof updateField>[2]) => {
      useEditorStore.getState().setDirty(tab.id, true);
      updateField(id, archetypeId, data);
    },
    [archetypeId, tab.id, updateField],
  );

  const handleDeleteField = useCallback(
    (id: string) => {
      useEditorStore.getState().setDirty(tab.id, true);
      deleteField(id, archetypeId);
    },
    [archetypeId, tab.id, deleteField],
  );

  const nodeShapeOptions = [
    { value: 'rectangle', label: t('archetype.rectangle') },
    { value: 'rounded', label: t('archetype.rounded') },
    { value: 'circle', label: t('archetype.circle') },
    { value: 'diamond', label: t('archetype.diamond') },
    { value: 'hexagon', label: t('archetype.hexagon') },
    { value: 'parallelogram', label: t('archetype.parallelogram') },
    { value: 'cylinder', label: t('archetype.cylinder') },
    { value: 'stadium', label: t('archetype.stadium') },
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

  const traitDefinitionsByCategory = useMemo(() => {
    const categories = Object.keys(SEMANTIC_CATEGORY_LABELS) as SemanticCategoryKey[];
    return categories.map((categoryKey) => ({
      categoryKey,
      categoryLabel: t(getSemanticCategoryLabelKey(categoryKey) as never),
      categoryDescription: t(getSemanticCategoryDescriptionKey(categoryKey) as never),
      traits: SEMANTIC_TRAIT_DEFINITIONS.filter((definition) => definition.category === categoryKey),
    }));
  }, [t]);
  const activeCategoryDefinition = traitDefinitionsByCategory.find((category) => category.categoryKey === activeSemanticCategory)
    ?? traitDefinitionsByCategory[0];

  const boundSlots = useMemo(() => {
    const counts = new Map<string, number>();
    for (const field of fields) {
      if (!field.system_slot) continue;
      counts.set(field.system_slot, (counts.get(field.system_slot) ?? 0) + 1);
    }
    return counts;
  }, [fields]);
  const activeTraitSlots = useMemo(() => new Set(
    semanticTraits.flatMap((trait) => {
      const definition = getSemanticTraitDefinition(trait);
      if (!definition) return [];
      return [...definition.coreSlots, ...definition.optionalSlots];
    }),
  ), [semanticTraits]);
  const detachedSlotFields = useMemo(() => (
    fields.filter((field) => field.system_slot && !activeTraitSlots.has(field.system_slot))
  ), [activeTraitSlots, fields]);
  const semanticFields = useMemo(() => (
    fields.filter((field) => !!field.system_slot)
  ), [fields]);
  const customFields = useMemo(() => (
    fields.filter((field) => !field.system_slot)
  ), [fields]);

  const update = (patch: Partial<ArchetypeState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const handleToggleTrait = useCallback(async (trait: SemanticTraitKey, checked: boolean) => {
    const currentTraits = semanticTraits;
    const nextTraits = checked
      ? [...new Set([...currentTraits, trait])]
      : currentTraits.filter((item) => item !== trait);

    if (!checked) {
      useEditorStore.getState().setDirty(tab.id, true);
      session.setState((prev) => ({ ...prev, semantic_traits: nextTraits }));
      return;
    }

    useEditorStore.getState().setDirty(tab.id, true);
    session.setState((prev) => ({ ...prev, semantic_traits: nextTraits }));

    const traitDefinition = SEMANTIC_TRAIT_DEFINITIONS.find((definition) => definition.key === trait);
    if (!traitDefinition) return;

    const currentFields = useArchetypeStore.getState().fields[archetypeId] ?? [];
    let sortOrder = currentFields.length;
    for (const slot of traitDefinition.coreSlots) {
      if (currentFields.some((field) => field.system_slot === slot)) continue;
      const slotDefinition = getSystemSlotDefinition(slot);
      if (!slotDefinition) continue;

      await createField({
        archetype_id: archetypeId,
        name: t(getSystemSlotLabelKey(slot) as never),
        field_type: slotDefinition.allowedFieldTypes[0],
        sort_order: sortOrder,
        required: true,
        system_slot: slot,
        slot_binding_locked: true,
        generated_by_trait: true,
      });
      sortOrder += 1;
    }
  }, [archetypeId, createField, semanticTraits, session, tab.id]);

  if (!archetype) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('archetype.notFound')}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  return (
    <ScrollArea className="h-full min-h-0">
      <>
        <NetworkObjectEditorShell
          badge={t('archetype.title')}
          title={editorState.name || archetype.name}
          subtitle={t('editorShell.networkObject' as never)}
          description={t('archetype.descriptionPlaceholder')}
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
            <label className="text-xs font-medium text-secondary">{t('archetype.name')}</label>
            <Input
              value={editorState.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('archetype.description')}</label>
            <TextArea
              value={editorState.description ?? ''}
              onChange={(e) => update({ description: e.target.value || null })}
              rows={4}
              placeholder={t('archetype.descriptionPlaceholder')}
            />
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('archetype.visualDefaults')}>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-secondary">{t('archetype.icon')}</span>
            <IconSelector
              value={editorState.icon ?? undefined}
              onChange={(icon) => update({ icon })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-secondary">{t('archetype.color')}</span>
            <ColorPicker
              value={editorState.color ?? undefined}
              onChange={(color) => update({ color })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-secondary">{t('archetype.nodeShape')}</span>
            <Select
              options={nodeShapeOptions}
              value={editorState.node_shape ?? ''}
              onChange={(e) => update({ node_shape: e.target.value || null })}
              placeholder={t('archetype.nodeShapePlaceholder')}
              selectSize="sm"
            />
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('archetype.fileTemplate')} defaultOpen={false}>
          <TextArea
            value={editorState.file_template ?? ''}
            onChange={(e) => update({ file_template: e.target.value || null })}
            rows={6}
            placeholder={t('archetype.fileTemplatePlaceholder')}
            className="font-mono text-xs"
          />
        </NetworkObjectEditorSection>

        {false && (
        <NetworkObjectEditorSection title={t('semantic.ui.sectionTitle' as never)}>
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-3 text-[11px] text-secondary">
                {t('semantic.ui.sectionDescription' as never)}
              </div>
              <div className="flex flex-wrap gap-2">
                {traitDefinitionsByCategory.map(({ categoryKey, categoryLabel, traits }) => {
                  const activeCount = traits.filter((traitDefinition) => semanticTraits.includes(traitDefinition.key)).length;
                  const isActive = activeCategoryDefinition?.categoryKey === categoryKey;
                  return (
                    <button
                      key={categoryKey}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-left transition-colors ${
                        isActive
                          ? 'border-accent bg-accent-muted text-default'
                          : 'border-subtle bg-surface-base text-secondary hover:border-default hover:text-default'
                      }`}
                      onClick={() => setActiveSemanticCategory(categoryKey)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{categoryLabel}</span>
                        <span className="text-[11px] text-muted">
                          {`${activeCount}/${traits.length}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {detachedSlotFields.length > 0 && (
              <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2">
                <div className="text-xs font-medium text-status-warning">
                  {t('archetype.detachedSlotsWarningTitle' as never)}
                </div>
                <div className="mt-1 text-[11px] text-secondary">
                  {t('archetype.detachedSlotsWarningBody' as never)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {detachedSlotFields.map((field) => (
                    <span
                      key={field.id}
                      className="rounded bg-surface-card px-2 py-0.5 text-[11px] text-secondary"
                    >
                      {`${field.name} · ${t(getSystemSlotLabelKey(field.system_slot!) as never)}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {activeCategoryDefinition && (
              <div>
                <div className="mb-4">
                  <div className="text-sm font-semibold text-default">{activeCategoryDefinition.categoryLabel}</div>
                  <div className="mt-1 text-xs leading-relaxed text-secondary">
                    {activeCategoryDefinition.categoryDescription}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {activeCategoryDefinition.traits.map((traitDefinition) => {
                    const checked = semanticTraits.includes(traitDefinition.key);
                    return (
                      <div
                        key={traitDefinition.key}
                        className={`rounded-xl border p-3 transition-colors ${
                          checked
                            ? 'border-accent/40 bg-accent-muted/40'
                            : 'border-subtle bg-surface-card'
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onChange={(nextChecked) => { void handleToggleTrait(traitDefinition.key, nextChecked); }}
                          label={t(getSemanticTraitLabelKey(traitDefinition.key) as never)}
                        />
                        <div className="mt-2 text-xs leading-relaxed text-secondary">
                          {t(getSemanticTraitDescriptionKey(traitDefinition.key) as never)}
                        </div>

                        <div className="mt-3 flex flex-col gap-2">
                          <div>
                            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                              {t('semantic.ui.coreSlots' as never)}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {traitDefinition.coreSlots.map((slot) => {
                                const isBound = boundSlots.has(slot);
                                return (
                                  <span
                                    key={slot}
                                    className={`rounded px-2 py-0.5 text-[11px] ${
                                      isBound
                                        ? 'bg-accent-muted text-accent'
                                        : 'bg-surface-base text-secondary'
                                    }`}
                                  >
                                    {t(getSystemSlotLabelKey(slot) as never)}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                              {t('semantic.ui.optionalSlots' as never)}
                            </div>
                            {traitDefinition.optionalSlots.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {traitDefinition.optionalSlots.map((slot) => {
                                  const isBound = boundSlots.has(slot);
                                  return (
                                    <span
                                      key={slot}
                                      className={`rounded px-2 py-0.5 text-[11px] ${
                                        isBound
                                          ? 'bg-accent-muted text-accent'
                                          : 'bg-surface-base text-secondary'
                                      }`}
                                    >
                                      {t(getSystemSlotLabelKey(slot) as never)}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-muted">
                                {t('semantic.ui.noOptionalSlots' as never)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </NetworkObjectEditorSection>
        )}

        <NetworkObjectEditorSection
          title={t('archetype.propertySchema')}
          actions={(
            <Button size="sm" variant="ghost" onClick={handleAddField}>
              <Plus size={14} className="mr-1" />
              {t('archetype.addField')}
            </Button>
          )}
        >
          <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-subtle bg-surface-base px-3 py-2">
              <div className="text-xs font-medium text-default">
                {t('semantic.ui.propertiesFlowTitle' as never)}
              </div>
              <div className="mt-1 text-xs text-secondary">
                {t('semantic.ui.propertiesFlowDescription' as never)}
              </div>
            </div>

            <div className="rounded-lg border border-subtle bg-surface-base px-3 py-3">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-medium text-default">
                    {t('semantic.ui.sectionTitle' as never)}
                  </div>
                  <div className="text-[11px] text-secondary">
                    {t('semantic.ui.sectionDescription' as never)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {traitDefinitionsByCategory.map(({ categoryKey, categoryLabel, traits }) => {
                    const activeCount = traits.filter((traitDefinition) => semanticTraits.includes(traitDefinition.key)).length;
                    const isActive = activeCategoryDefinition?.categoryKey === categoryKey;
                    return (
                      <button
                        key={categoryKey}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-left transition-colors ${
                          isActive
                            ? 'border-accent bg-accent-muted text-default'
                            : 'border-subtle bg-surface-card text-secondary hover:border-default hover:text-default'
                        }`}
                        onClick={() => setActiveSemanticCategory(categoryKey)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{categoryLabel}</span>
                          <span className="text-[11px] text-muted">
                            {`${activeCount}/${traits.length}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {detachedSlotFields.length > 0 && (
                  <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2">
                    <div className="text-xs font-medium text-status-warning">
                      {t('archetype.detachedSlotsWarningTitle' as never)}
                    </div>
                    <div className="mt-1 text-[11px] text-secondary">
                      {t('archetype.detachedSlotsWarningBody' as never)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {detachedSlotFields.map((field) => (
                        <span
                          key={field.id}
                          className="rounded bg-surface-card px-2 py-0.5 text-[11px] text-secondary"
                        >
                          {`${field.name} · ${t(getSystemSlotLabelKey(field.system_slot!) as never)}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeCategoryDefinition && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="text-sm font-semibold text-default">{activeCategoryDefinition.categoryLabel}</div>
                      <div className="mt-1 text-xs leading-relaxed text-secondary">
                        {activeCategoryDefinition.categoryDescription}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {activeCategoryDefinition.traits.map((traitDefinition) => {
                        const checked = semanticTraits.includes(traitDefinition.key);
                        return (
                          <div
                            key={traitDefinition.key}
                            className={`rounded-lg border px-3 py-3 transition-colors ${
                              checked
                                ? 'border-accent/40 bg-accent-muted/30'
                                : 'border-subtle bg-surface-card'
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              onChange={(nextChecked) => { void handleToggleTrait(traitDefinition.key, nextChecked); }}
                              label={t(getSemanticTraitLabelKey(traitDefinition.key) as never)}
                            />
                            <div className="mt-2 text-xs leading-relaxed text-secondary">
                              {t(getSemanticTraitDescriptionKey(traitDefinition.key) as never)}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {traitDefinition.coreSlots.map((slot) => {
                                const isBound = boundSlots.has(slot);
                                return (
                                  <span
                                    key={slot}
                                    className={`rounded px-2 py-0.5 text-[11px] ${
                                      isBound
                                        ? 'bg-accent-muted text-accent'
                                        : 'bg-surface-base text-secondary'
                                    }`}
                                  >
                                    {`${t('semantic.ui.coreSlots' as never)}: ${t(getSystemSlotLabelKey(slot) as never)}`}
                                  </span>
                                );
                              })}
                              {traitDefinition.optionalSlots.map((slot) => {
                                const isBound = boundSlots.has(slot);
                                return (
                                  <span
                                    key={slot}
                                    className={`rounded px-2 py-0.5 text-[11px] ${
                                      isBound
                                        ? 'bg-accent-muted text-accent'
                                        : 'bg-surface-base text-secondary'
                                    }`}
                                  >
                                    {`${t('semantic.ui.optionalSlots' as never)}: ${t(getSystemSlotLabelKey(slot) as never)}`}
                                  </span>
                                );
                              })}
                              {traitDefinition.optionalSlots.length === 0 && (
                                <span className="rounded bg-surface-base px-2 py-0.5 text-[11px] text-muted">
                                  {t('semantic.ui.noOptionalSlots' as never)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-subtle bg-surface-base px-3 py-2">
              <div className="text-xs font-medium text-default">
                {t('settings.fieldComplexity' as never)}
                {': '}
                {t(`settings.fieldComplexity${fieldComplexityLevel[0].toUpperCase()}${fieldComplexityLevel.slice(1)}` as TranslationKey)}
              </div>
              <div className="mt-1 text-xs text-secondary">
                {t(`settings.fieldComplexity${fieldComplexityLevel[0].toUpperCase()}${fieldComplexityLevel.slice(1)}Desc` as TranslationKey)}
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-accent transition-colors hover:text-accent-hover"
                onClick={() => setShowSettings(true)}
              >
                {t('typeSelector.openSettings' as TranslationKey)}
              </button>
            </div>

            {fields.length === 0 && (
              <div className="py-4 text-center text-xs text-muted">
                {t('archetype.noFields')}
              </div>
            )}

            {semanticFields.length > 0 && (
              <div>
                <div className="mb-2">
                  <div className="text-xs font-medium text-default">
                    {t('semantic.ui.semanticFieldsTitle' as never)}
                  </div>
                  <div className="mt-1 text-[11px] text-secondary">
                    {t('semantic.ui.semanticFieldsDescription' as never)}
                  </div>
                </div>
                <div className="flex flex-col">
                  {semanticFields.map((field) => (
                    <ArchetypeFieldRow
                      key={field.id}
                      tabId={tab.id}
                      field={field}
                      onUpdate={handleUpdateField}
                      onDelete={handleDeleteField}
                    />
                  ))}
                </div>
              </div>
            )}

            {customFields.length > 0 && (
              <div>
                <div className="mb-2">
                  <div className="text-xs font-medium text-default">
                    {t('semantic.ui.customFieldsTitle' as never)}
                  </div>
                  <div className="mt-1 text-[11px] text-secondary">
                    {t('semantic.ui.customFieldsDescription' as never)}
                  </div>
                </div>
                <div className="flex flex-col">
                  {customFields.map((field) => (
                    <ArchetypeFieldRow
                      key={field.id}
                      tabId={tab.id}
                      field={field}
                      onUpdate={handleUpdateField}
                      onDelete={handleDeleteField}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </NetworkObjectEditorSection>

          <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
            <NetworkObjectMetadataList
              items={[
                { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{archetype.id}</code> },
              ]}
            />
          </NetworkObjectEditorSection>
        </NetworkObjectEditorShell>
      </>
    </ScrollArea>
  );
}
