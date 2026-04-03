import React, { useState } from 'react';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { getIconComponent } from '../ui/lucide-utils';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { useI18n } from '../../hooks/useI18n';

interface CtxState { x: number; y: number; id: string; name: string }

export function ArchetypeList(): JSX.Element {
  const { t } = useI18n();
  const archetypes = useArchetypeStore((s) => s.archetypes);
  const createArchetype = useArchetypeStore((s) => s.createArchetype);
  const deleteArchetype = useArchetypeStore((s) => s.deleteArchetype);
  const currentProject = useProjectStore((s) => s.currentProject);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  const handleCreate = async () => {
    if (!currentProject) return;
    const archetype = await createArchetype({
      project_id: currentProject.id,
      name: 'New Archetype',
    });
    useEditorStore.getState().openTab({
      type: 'archetype',
      targetId: archetype.id,
      title: archetype.name,
    });
  };

  const handleClick = (id: string, name: string) => {
    useEditorStore.getState().openTab({
      type: 'archetype',
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
        useEditorStore.getState().closeTab(`archetype:${ctx.id}`);
        deleteArchetype(ctx.id);
      }},
    ];
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-secondary uppercase tracking-wider">
          {t('archetype.title')}
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
        {archetypes.map((a) => {
          const Icon = a.icon ? getIconComponent(a.icon) : null;
          return (
            <button
              key={a.id}
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-default hover:bg-surface-hover transition-colors text-left"
              onClick={() => handleClick(a.id, a.name)}
              onContextMenu={(e) => handleContextMenu(e, a.id, a.name)}
            >
              {a.color && (
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
              )}
              {Icon && <Icon size={14} className="shrink-0 text-secondary" />}
              <span className="truncate">{a.name}</span>
            </button>
          );
        })}
        {archetypes.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">
            {t('archetype.noArchetypes')}
          </div>
        )}
      </div>
      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={buildMenuItems()} onClose={() => setCtx(null)} />}
    </div>
  );
}
