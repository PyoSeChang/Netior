import React, { useState } from 'react';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { useI18n } from '../../hooks/useI18n';

interface CtxState { x: number; y: number; id: string; name: string }

export function RelationTypeList(): JSX.Element {
  const { t } = useI18n();
  const relationTypes = useRelationTypeStore((s) => s.relationTypes);
  const createRelationType = useRelationTypeStore((s) => s.createRelationType);
  const deleteRelationType = useRelationTypeStore((s) => s.deleteRelationType);
  const currentProject = useProjectStore((s) => s.currentProject);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  const handleCreate = async () => {
    if (!currentProject) return;
    const rt = await createRelationType({
      project_id: currentProject.id,
      name: t('relationType.newDefault'),
    });
    useEditorStore.getState().openTab({
      type: 'relationType',
      targetId: rt.id,
      title: rt.name,
    });
  };

  const handleClick = (id: string, name: string) => {
    useEditorStore.getState().openTab({
      type: 'relationType',
      targetId: id,
      title: name,
    });
  };

  const handleContextMenu = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, id, name });
  };

  const buildMenuItems = (): ContextMenuEntry[] => {
    if (!ctx) return [];
    return [
      { label: t('editor.openInEditor'), icon: <ExternalLink size={14} />, onClick: () => handleClick(ctx.id, ctx.name) },
      { type: 'divider' as const },
      { label: t('common.delete'), icon: <Trash2 size={14} />, danger: true, onClick: () => {
        useEditorStore.getState().closeTab(`relationType:${ctx.id}`);
        deleteRelationType(ctx.id);
      }},
    ];
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-secondary uppercase tracking-wider">
          {t('relationType.title')}
        </span>
        <button
          type="button"
          onClick={handleCreate}
          className="p-1 text-muted hover:text-default transition-colors rounded hover:bg-surface-hover"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex flex-col">
        {relationTypes.map((rt) => (
          <button
            key={rt.id}
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-default hover:bg-surface-hover transition-colors text-left"
            onClick={() => handleClick(rt.id, rt.name)}
            onContextMenu={(e) => handleContextMenu(e, rt.id, rt.name)}
          >
            {rt.color && (
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: rt.color }} />
            )}
            <span className="truncate">{rt.name}</span>
          </button>
        ))}
        {relationTypes.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">
            {t('relationType.noRelationTypes')}
          </div>
        )}
      </div>
      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={buildMenuItems()} onClose={() => setCtx(null)} />}
    </div>
  );
}
