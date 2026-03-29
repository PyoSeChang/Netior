import React, { useEffect, useCallback } from 'react';
import type { EditorTab, ArchetypeUpdate } from '@moc/shared/types';
import { Plus } from 'lucide-react';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { IconSelector } from '../ui/IconSelector';
import { ColorPicker } from '../ui/ColorPicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/ScrollArea';
import { ArchetypeFieldRow } from './ArchetypeFieldRow';

interface ArchetypeEditorProps {
  tab: EditorTab;
}

export function ArchetypeEditor({ tab }: ArchetypeEditorProps): JSX.Element {
  const { t } = useI18n();
  const archetypeId = tab.targetId;
  const archetypes = useArchetypeStore((s) => s.archetypes);
  const fields = useArchetypeStore((s) => s.fields[archetypeId] ?? []);
  const { updateArchetype, loadFields, createField, updateField, deleteField } = useArchetypeStore();

  const archetype = archetypes.find((a) => a.id === archetypeId);

  useEffect(() => {
    loadFields(archetypeId);
  }, [archetypeId, loadFields]);

  const handleUpdate = useCallback(
    (data: ArchetypeUpdate) => {
      updateArchetype(archetypeId, data);
      if (data.name) {
        useEditorStore.getState().updateTitle(tab.id, data.name);
      }
    },
    [archetypeId, tab.id, updateArchetype],
  );

  const handleAddField = async () => {
    await createField({
      archetype_id: archetypeId,
      name: '',
      field_type: 'text',
      sort_order: fields.length,
    });
  };

  const handleUpdateField = useCallback(
    (id: string, data: Parameters<typeof updateField>[2]) => {
      updateField(id, archetypeId, data);
    },
    [archetypeId, updateField],
  );

  const handleDeleteField = useCallback(
    (id: string) => {
      deleteField(id, archetypeId);
    },
    [archetypeId, deleteField],
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

  if (!archetype) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('archetype.notFound')}
      </div>
    );
  }

  return (
    <ScrollArea>
      <div className="flex h-full items-start justify-center">
        <div className="flex flex-col gap-6 p-6 w-full max-w-[600px]">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('archetype.name')}</label>
            <Input
              value={archetype.name}
              onChange={(e) => handleUpdate({ name: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('archetype.description')}</label>
            <TextArea
              value={archetype.description ?? ''}
              onChange={(e) => handleUpdate({ description: e.target.value || null })}
              rows={4}
              placeholder={t('archetype.descriptionPlaceholder')}
            />
          </div>

          {/* Visual Defaults */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-muted">{t('archetype.visualDefaults')}</label>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">{t('archetype.icon')}</span>
              <IconSelector
                value={archetype.icon ?? undefined}
                onChange={(icon) => handleUpdate({ icon })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">{t('archetype.color')}</span>
              <ColorPicker
                value={archetype.color ?? undefined}
                onChange={(color) => handleUpdate({ color })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">{t('archetype.nodeShape')}</span>
              <Select
                options={nodeShapeOptions}
                value={archetype.node_shape ?? ''}
                onChange={(e) => handleUpdate({ node_shape: e.target.value || null })}
                placeholder={t('archetype.nodeShapePlaceholder')}
                selectSize="sm"
              />
            </div>
          </div>

          {/* File Template */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('archetype.fileTemplate')}</label>
            <TextArea
              value={archetype.file_template ?? ''}
              onChange={(e) => handleUpdate({ file_template: e.target.value || null })}
              rows={6}
              placeholder={t('archetype.fileTemplatePlaceholder')}
              className="font-mono text-xs"
            />
          </div>

          {/* Fields Schema */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted">{t('archetype.propertySchema')}</label>
              <Button size="sm" variant="ghost" onClick={handleAddField}>
                <Plus size={14} className="mr-1" />
                {t('archetype.addField')}
              </Button>
            </div>

            {fields.length === 0 && (
              <div className="text-xs text-muted py-4 text-center">
                {t('archetype.noFields')}
              </div>
            )}

            <div className="flex flex-col">
              {fields.map((field) => (
                <ArchetypeFieldRow
                  key={field.id}
                  field={field}
                  onUpdate={handleUpdateField}
                  onDelete={handleDeleteField}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
