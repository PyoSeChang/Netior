import React, { useEffect } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { useCanvasTypeStore } from '../../stores/canvas-type-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { IconSelector } from '../ui/IconSelector';
import { ColorPicker } from '../ui/ColorPicker';
import { Checkbox } from '../ui/Checkbox';
import { ScrollArea } from '../ui/ScrollArea';

interface CanvasTypeEditorProps {
  tab: EditorTab;
}

interface CanvasTypeState {
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}

export function CanvasTypeEditor({ tab }: CanvasTypeEditorProps): JSX.Element {
  const { t } = useI18n();
  const canvasTypeId = tab.targetId;
  const canvasTypes = useCanvasTypeStore((s) => s.canvasTypes);
  const allowedRelations = useCanvasTypeStore((s) => s.allowedRelations[canvasTypeId] ?? []);
  const { updateCanvasType, loadAllowedRelations, addAllowedRelation, removeAllowedRelation } = useCanvasTypeStore();
  const relationTypes = useRelationTypeStore((s) => s.relationTypes);

  const canvasType = canvasTypes.find((ct) => ct.id === canvasTypeId);

  useEffect(() => {
    loadAllowedRelations(canvasTypeId);
  }, [canvasTypeId, loadAllowedRelations]);

  const session = useEditorSession<CanvasTypeState>({
    tabId: tab.id,
    load: () => {
      const ct = useCanvasTypeStore.getState().canvasTypes.find((c) => c.id === canvasTypeId);
      if (!ct) return { name: '', description: null, icon: null, color: null };
      return { name: ct.name, description: ct.description, icon: ct.icon, color: ct.color };
    },
    save: async (state) => {
      await updateCanvasType(canvasTypeId, state);
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [canvasTypeId],
  });

  if (!canvasType) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('canvasType.notFound')}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  const update = (patch: Partial<CanvasTypeState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const allowedIds = new Set(allowedRelations.map((r) => r.id));

  return (
    <ScrollArea>
      <div className="flex h-full items-start justify-center">
        <div className="flex flex-col gap-6 p-6 w-full max-w-[600px]">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('canvasType.name')}</label>
            <Input
              value={session.state.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('canvasType.description')}</label>
            <TextArea
              value={session.state.description ?? ''}
              onChange={(e) => update({ description: e.target.value || null })}
              rows={4}
              placeholder={t('canvasType.descriptionPlaceholder')}
            />
          </div>

          {/* Visual */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-secondary">{t('canvasType.visual')}</label>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('canvasType.icon')}</span>
              <IconSelector
                value={session.state.icon ?? undefined}
                onChange={(icon) => update({ icon })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('canvasType.color')}</span>
              <ColorPicker
                value={session.state.color ?? undefined}
                onChange={(color) => update({ color })}
              />
            </div>
          </div>

          {/* Allowed Relation Types — immediate action, not part of session */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-secondary">{t('canvasType.allowedRelations')}</label>
            {relationTypes.length === 0 ? (
              <div className="text-xs text-muted py-4 text-center">
                {t('relationType.noRelationTypes')}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {relationTypes.map((rt) => {
                  const isAllowed = allowedIds.has(rt.id);
                  return (
                    <label key={rt.id} className="flex items-center gap-2 py-1 px-1 text-sm cursor-pointer hover:bg-surface-hover rounded">
                      <Checkbox
                        checked={isAllowed}
                        onChange={async () => {
                          if (isAllowed) {
                            await removeAllowedRelation(canvasTypeId, rt.id);
                          } else {
                            await addAllowedRelation(canvasTypeId, rt.id);
                          }
                        }}
                      />
                      {rt.color && (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rt.color }} />
                      )}
                      <span className="text-default">{rt.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
