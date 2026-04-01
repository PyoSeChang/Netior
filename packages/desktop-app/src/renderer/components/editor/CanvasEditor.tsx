import React, { useCallback, useEffect, useMemo } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { useCanvasStore } from '../../stores/canvas-store';
import { useCanvasTypeStore } from '../../stores/canvas-type-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/ScrollArea';
import { listLayouts, getLayout } from '../workspace/layout-plugins/registry';

interface CanvasEditorProps {
  tab: EditorTab;
}

interface CanvasState {
  name: string;
  canvas_type_id: string | null;
  layout: string;
  layout_config: Record<string, unknown>;
}

export function CanvasEditor({ tab }: CanvasEditorProps): JSX.Element {
  const { t } = useI18n();
  const canvasId = tab.targetId;
  const { canvases, updateCanvas, deleteCanvas } = useCanvasStore();
  const canvasTypes = useCanvasTypeStore((s) => s.canvasTypes);

  const archetypes = useArchetypeStore((s) => s.archetypes);
  const fields = useArchetypeStore((s) => s.fields);
  const loadFields = useArchetypeStore((s) => s.loadFields);

  useEffect(() => {
    for (const a of archetypes) {
      if (!fields[a.id]) loadFields(a.id);
    }
  }, [archetypes, fields, loadFields]);

  const canvas = canvases.find((c) => c.id === canvasId);

  const session = useEditorSession<CanvasState>({
    tabId: tab.id,
    load: () => {
      const c = useCanvasStore.getState().canvases.find((cv) => cv.id === canvasId);
      if (!c) return { name: '', canvas_type_id: null, layout: 'freeform', layout_config: {} };
      return {
        name: c.name,
        canvas_type_id: c.canvas_type_id,
        layout: c.layout,
        layout_config: c.layout_config ?? {},
      };
    },
    save: async (state) => {
      await updateCanvas(canvasId, state);
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [canvasId],
  });

  const canvasTypeOptions = useMemo(() => [
    { value: '', label: t('canvasType.noType') ?? 'None' },
    ...canvasTypes.map((ct) => ({ value: ct.id, label: ct.name })),
  ], [canvasTypes, t]);

  const handleDelete = useCallback(async () => {
    await deleteCanvas(canvasId);
    useEditorStore.getState().closeTab(tab.id);
  }, [canvasId, deleteCanvas, tab.id]);

  const layoutOptions = useMemo(() =>
    listLayouts().map((p) => ({ value: p.key, label: p.displayName })),
  []);

  const activePlugin = useMemo(() => getLayout(session.state?.layout), [session.state?.layout]);
  const layoutConfig = session.state?.layout_config ?? {};
  const fieldMappings = (layoutConfig.field_mappings ?? {}) as Record<string, Record<string, string>>;

  const update = (patch: Partial<CanvasState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const updateLayoutConfig = (patch: Record<string, unknown>) => {
    session.setState((prev) => ({
      ...prev,
      layout_config: { ...prev.layout_config, ...patch },
    }));
  };

  const updateFieldMapping = (archetypeId: string, key: string, value: string) => {
    const currentMappings = { ...fieldMappings };
    if (!currentMappings[archetypeId]) currentMappings[archetypeId] = {};
    currentMappings[archetypeId] = { ...currentMappings[archetypeId], [key]: value };
    updateLayoutConfig({ field_mappings: currentMappings });
  };

  if (!canvas) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('canvas.notFound') ?? 'Canvas not found'}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  return (
    <ScrollArea className="h-full">
      <div className="flex items-start justify-center">
        <div className="flex flex-col gap-6 p-6 w-full max-w-[600px]">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('canvas.name') ?? 'Name'}</label>
            <Input
              value={session.state.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          {/* Canvas Type */}
          {canvasTypes.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">{t('canvasType.title')}</label>
              <Select
                options={canvasTypeOptions}
                value={session.state.canvas_type_id ?? ''}
                onChange={(e) => update({ canvas_type_id: e.target.value || null })}
                selectSize="sm"
              />
            </div>
          )}

          {/* Layout */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('canvas.layout') ?? 'Layout'}</label>
            <Select
              options={layoutOptions}
              value={session.state.layout}
              onChange={(e) => {
                const newLayout = e.target.value;
                const plugin = getLayout(newLayout);
                update({ layout: newLayout, layout_config: plugin.getDefaultConfig() });
              }}
              selectSize="sm"
            />
          </div>

          {/* Layout Config */}
          {activePlugin.key !== 'freeform' && (
            <div className="flex flex-col gap-3 p-3 bg-surface-card rounded-md border border-subtle">
              <div className="text-xs font-medium text-muted">{t('canvas.layoutSettings') ?? 'Layout Settings'}</div>

              {activePlugin.configSchema.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <label className="text-xs text-secondary">{t(field.label as never) ?? field.label}</label>
                  {field.type === 'number' ? (
                    <NumberInput
                      value={(layoutConfig[field.key] as number) ?? (field.default as number)}
                      onChange={(val) => updateLayoutConfig({ [field.key]: val })}
                      inputSize="sm"
                      min={0}
                    />
                  ) : field.type === 'enum' ? (
                    <Select
                      options={(field.options ?? []).map((o) => ({ value: o, label: t(`layout.timeline.${o}` as never) ?? o }))}
                      value={(layoutConfig[field.key] as string) ?? (field.default as string)}
                      onChange={(e) => updateLayoutConfig({ [field.key]: e.target.value })}
                      selectSize="sm"
                    />
                  ) : (
                    <Input
                      value={(layoutConfig[field.key] as string) ?? (field.default as string)}
                      onChange={(e) => updateLayoutConfig({ [field.key]: e.target.value })}
                      inputSize="sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Field Mappings */}
          {activePlugin.requiredFields.length > 0 && archetypes.length > 0 && (
            <div className="flex flex-col gap-3 p-3 bg-surface-card rounded-md border border-subtle">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted">{t('canvas.fieldMappings') ?? 'Field Mappings'}</div>
                <Select
                  options={[
                    { value: '', label: t('canvas.addArchetype') ?? 'Add Archetype...' },
                    ...archetypes
                      .filter((a) => !fieldMappings[a.id])
                      .map((a) => ({ value: a.id, label: a.name })),
                  ]}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      updateFieldMapping(e.target.value, 'role', 'occurrence');
                    }
                  }}
                  selectSize="sm"
                />
              </div>

              {Object.keys(fieldMappings).map((archId) => {
                const arch = archetypes.find((a) => a.id === archId);
                if (!arch) return null;
                const archFields = fields[archId] ?? [];
                const archMapping = fieldMappings[archId] ?? {};

                return (
                  <div key={archId} className="flex flex-col gap-2 p-2 bg-surface-base rounded border border-subtle">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-default">{arch.name}</div>
                      <button
                        type="button"
                        className="text-xs text-secondary hover:text-status-error"
                        onClick={() => {
                          const newMappings = { ...fieldMappings };
                          delete newMappings[archId];
                          updateLayoutConfig({ field_mappings: newMappings });
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                    {activePlugin.requiredFields.map((req) => {
                      if (req.type === 'enum') {
                        return (
                          <div key={req.key} className="flex items-center gap-2 pl-2">
                            <span className="text-xs text-secondary w-28 shrink-0">{t(req.label as never) ?? req.label}</span>
                            <Select
                              options={(req.options ?? []).map((o) => ({ value: o, label: t(`layout.timeline.${o}` as never) ?? o }))}
                              value={archMapping[req.key] ?? (req.default as string) ?? ''}
                              onChange={(e) => updateFieldMapping(archId, req.key, e.target.value)}
                              selectSize="sm"
                            />
                          </div>
                        );
                      }
                      const reqLabel = t(req.label as never) ?? req.label;
                      const fieldOptions = [
                        { value: '', label: req.required ? `-- ${reqLabel} --` : `(${t('common.none') ?? 'None'})` },
                        ...archFields
                          .filter((f) => ['date', 'datetime'].includes(f.field_type))
                          .map((f) => ({ value: f.id, label: f.name })),
                      ];
                      return (
                        <div key={req.key} className="flex items-center gap-2 pl-2">
                          <span className="text-xs text-secondary w-28 shrink-0">{t(req.label as never) ?? req.label}</span>
                          <Select
                            options={fieldOptions}
                            value={archMapping[req.key] ?? ''}
                            onChange={(e) => updateFieldMapping(archId, req.key, e.target.value)}
                            selectSize="sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Info */}
          {canvas.concept_id && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">{t('canvas.parentConcept') ?? 'Parent Concept'}</label>
              <div className="px-3 py-2 text-sm bg-surface-base border border-subtle rounded-md text-secondary">
                {canvas.concept_id}
              </div>
            </div>
          )}

          {/* Delete */}
          <div className="pt-4 border-t border-subtle">
            <Button
              size="sm"
              variant="ghost"
              className="text-status-error hover:text-status-error"
              onClick={handleDelete}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
