import React, { useCallback } from 'react';
import type { EditorTab, LineStyle } from '@netior/shared/types';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { ColorPicker } from '../ui/ColorPicker';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { ScrollArea } from '../ui/ScrollArea';

interface RelationTypeEditorProps {
  tab: EditorTab;
}

interface RelationTypeState {
  name: string;
  description: string | null;
  color: string | null;
  line_style: LineStyle;
  directed: boolean;
}

export function RelationTypeEditor({ tab }: RelationTypeEditorProps): JSX.Element {
  const { t } = useI18n();
  const relationTypeId = tab.targetId;
  const relationTypes = useRelationTypeStore((s) => s.relationTypes);
  const { updateRelationType } = useRelationTypeStore();

  const session = useEditorSession<RelationTypeState>({
    tabId: tab.id,
    load: () => {
      const rt = useRelationTypeStore.getState().relationTypes.find((r) => r.id === relationTypeId);
      if (!rt) return { name: '', description: null, color: null, line_style: 'solid', directed: false };
      return {
        name: rt.name,
        description: rt.description,
        color: rt.color,
        line_style: rt.line_style,
        directed: rt.directed,
      };
    },
    save: async (state) => {
      await updateRelationType(relationTypeId, state);
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [relationTypeId],
  });

  const lineStyleOptions = [
    { value: 'solid', label: t('relationType.solid') },
    { value: 'dashed', label: t('relationType.dashed') },
    { value: 'dotted', label: t('relationType.dotted') },
  ];

  const relationType = relationTypes.find((rt) => rt.id === relationTypeId);
  if (!relationType) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('relationType.notFound')}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  const update = (patch: Partial<RelationTypeState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  return (
    <ScrollArea>
      <div className="flex h-full items-start justify-center">
        <div className="flex flex-col gap-6 p-6 w-full max-w-[600px]">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('relationType.name')}</label>
            <Input
              value={session.state.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('relationType.description')}</label>
            <TextArea
              value={session.state.description ?? ''}
              onChange={(e) => update({ description: e.target.value || null })}
              rows={4}
              placeholder={t('relationType.descriptionPlaceholder')}
            />
          </div>

          {/* Visual */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-secondary">{t('relationType.visual')}</label>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('relationType.color')}</span>
              <ColorPicker
                value={session.state.color ?? undefined}
                onChange={(color) => update({ color })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('relationType.lineStyle')}</span>
              <Select
                options={lineStyleOptions}
                value={session.state.line_style}
                onChange={(e) => update({ line_style: e.target.value as 'solid' | 'dashed' | 'dotted' })}
                selectSize="sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Toggle
                checked={session.state.directed}
                onChange={(checked) => update({ directed: checked })}
              />
              <span className="text-xs text-secondary">{t('relationType.directed')}</span>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
