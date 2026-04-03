import React, { useState } from 'react';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';
import { useCanvasTypeStore } from '../../stores/canvas-type-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { getIconComponent } from '../ui/lucide-utils';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { useI18n } from '../../hooks/useI18n';

interface CtxState { x: number; y: number; id: string; name: string }

export function CanvasTypeList(): JSX.Element {
  const { t } = useI18n();
  const canvasTypes = useCanvasTypeStore((s) => s.canvasTypes);
  const createCanvasType = useCanvasTypeStore((s) => s.createCanvasType);
  const deleteCanvasType = useCanvasTypeStore((s) => s.deleteCanvasType);
  const currentProject = useProjectStore((s) => s.currentProject);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  const handleCreate = async () => {
    if (!currentProject) return;
    const ct = await createCanvasType({
      project_id: currentProject.id,
      name: t('canvasType.newDefault'),
    });
    useEditorStore.getState().openTab({
      type: 'canvasType',
      targetId: ct.id,
      title: ct.name,
    });
  };

  const handleClick = (id: string, name: string) => {
    useEditorStore.getState().openTab({
      type: 'canvasType',
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
        useEditorStore.getState().closeTab(`canvasType:${ctx.id}`);
        deleteCanvasType(ctx.id);
      }},
    ];
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-secondary uppercase tracking-wider">
          {t('canvasType.title')}
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
        {canvasTypes.map((ct) => {
          const Icon = ct.icon ? getIconComponent(ct.icon) : null;
          return (
            <button
              key={ct.id}
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-default hover:bg-surface-hover transition-colors text-left"
              onClick={() => handleClick(ct.id, ct.name)}
              onContextMenu={(e) => handleContextMenu(e, ct.id, ct.name)}
            >
              {ct.color && (
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ct.color }} />
              )}
              {Icon && <Icon size={14} className="shrink-0 text-secondary" />}
              <span className="truncate">{ct.name}</span>
            </button>
          );
        })}
        {canvasTypes.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">
            {t('canvasType.noCanvasTypes')}
          </div>
        )}
      </div>
      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={buildMenuItems()} onClose={() => setCtx(null)} />}
    </div>
  );
}
