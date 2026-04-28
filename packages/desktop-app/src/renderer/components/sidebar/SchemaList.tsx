import React, { useMemo, useState } from 'react';
import { ExternalLink, FolderPlus, FolderTree, Plus, Pencil, Trash2 } from 'lucide-react';
import type { TypeGroup } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import { useSchemaStore } from '../../stores/schema-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useTypeGroupStore } from '../../stores/type-group-store';
import { getIconComponent } from '../ui/lucide-utils';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { TypeGroupModal } from './TypeGroupModal';
import { useI18n } from '../../hooks/useI18n';

type ContextState =
  | { x: number; y: number; kind: 'schema'; id: string; name: string }
  | { x: number; y: number; kind: 'group'; group: TypeGroup };

type GroupDialogState =
  | { mode: 'create'; parentGroupId: string | null }
  | { mode: 'rename'; group: TypeGroup };

const UNGROUPED_KEY = '__ungrouped__';

export function SchemaList(): JSX.Element {
  const { t } = useI18n();
  const tk = (key: string) => t(key as TranslationKey);
  const schemas = useSchemaStore((state) => state.schemas);
  const createSchema = useSchemaStore((state) => state.createSchema);
  const deleteSchema = useSchemaStore((state) => state.deleteSchema);
  const groups = useTypeGroupStore((state) => state.groupsByKind.schema);
  const createGroup = useTypeGroupStore((state) => state.createGroup);
  const updateGroup = useTypeGroupStore((state) => state.updateGroup);
  const deleteGroup = useTypeGroupStore((state) => state.deleteGroup);
  const currentProject = useProjectStore((state) => state.currentProject);
  const [ctx, setCtx] = useState<ContextState | null>(null);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState | null>(null);

  const schemasByGroup = useMemo(() => {
    const map = new Map<string, typeof schemas>();
    for (const schema of schemas) {
      const key = schema.group_id ?? UNGROUPED_KEY;
      const current = map.get(key) ?? [];
      map.set(key, [...current, schema]);
    }
    return map;
  }, [schemas]);

  const childGroupsByParent = useMemo(() => {
    const map = new Map<string | null, TypeGroup[]>();
    for (const group of groups) {
      const key = group.parent_group_id ?? null;
      const current = map.get(key) ?? [];
      map.set(key, [...current, group]);
    }
    return map;
  }, [groups]);

  const handleCreateSchema = async (groupId: string | null = null) => {
    if (!currentProject) return;
    const schema = await createSchema({
      project_id: currentProject.id,
      group_id: groupId,
      name: tk('schema.newDefault'),
    });
    useEditorStore.getState().openTab({
      type: 'schema',
      targetId: schema.id,
      title: schema.name,
      isDirty: true,
    });
  };

  const handleOpenSchema = (id: string, name: string) => {
    useEditorStore.getState().openTab({
      type: 'schema',
      targetId: id,
      title: name,
    });
  };

  const handleContextMenu = (event: React.MouseEvent, nextCtx: ContextState) => {
    event.preventDefault();
    event.stopPropagation();
    setCtx(nextCtx);
  };

  const buildMenuItems = (): ContextMenuEntry[] => {
    if (!ctx) return [];

    if (ctx.kind === 'schema') {
      return [
        {
          label: t('editor.openInEditor'),
          icon: <ExternalLink size={14} />,
          onClick: () => handleOpenSchema(ctx.id, ctx.name),
        },
        { type: 'divider' as const },
        {
          label: t('common.delete'),
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => {
            useEditorStore.getState().closeTab(`schema:${ctx.id}`);
            void deleteSchema(ctx.id);
          },
        },
      ];
    }

    return [
      {
          label: tk('schema.createInGroup'),
        icon: <Plus size={14} />,
        onClick: () => void handleCreateSchema(ctx.group.id),
      },
      {
        label: tk('typeGroup.createSubgroup'),
        icon: <FolderPlus size={14} />,
        onClick: () => setGroupDialog({ mode: 'create', parentGroupId: ctx.group.id }),
      },
      {
        label: tk('typeGroup.rename'),
        icon: <Pencil size={14} />,
        onClick: () => setGroupDialog({ mode: 'rename', group: ctx.group }),
      },
      { type: 'divider' as const },
      {
        label: t('common.delete'),
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => void deleteGroup(ctx.group.id),
      },
    ];
  };

  const submitGroupDialog = async (name: string) => {
    if (!currentProject || !groupDialog) return;

    if (groupDialog.mode === 'create') {
      const siblingCount = groups.filter((group) => (
        (group.parent_group_id ?? null) === groupDialog.parentGroupId
      )).length;
      await createGroup({
        project_id: currentProject.id,
        kind: 'schema',
        name,
        parent_group_id: groupDialog.parentGroupId ?? undefined,
        sort_order: siblingCount,
      });
      return;
    }

    await updateGroup(groupDialog.group.id, { name });
  };

  const renderSchemaRow = (id: string, name: string, color: string | null, icon: string | null, depth: number) => {
    const Icon = icon ? getIconComponent(icon) : null;
    return (
      <button
        key={id}
        type="button"
        className="flex items-center gap-2 py-1.5 pr-3 text-sm text-default hover:bg-state-hover transition-colors text-left"
        style={{ paddingLeft: 16 + (depth * 16) }}
        onClick={() => handleOpenSchema(id, name)}
        onContextMenu={(event) => handleContextMenu(event, {
          x: event.clientX,
          y: event.clientY,
          kind: 'schema',
          id,
          name,
        })}
      >
        {color && <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
        {Icon && <Icon size={14} className="shrink-0 text-secondary" />}
        <span className="truncate">{name}</span>
      </button>
    );
  };

  const renderGroupNode = (group: TypeGroup, depth: number): JSX.Element => {
    const childGroups = childGroupsByParent.get(group.id) ?? [];
    const groupedSchemas = schemasByGroup.get(group.id) ?? [];

    return (
      <div key={group.id} className="flex flex-col">
        <button
          type="button"
          className="flex items-center gap-2 py-1.5 pr-3 text-xs font-medium uppercase tracking-wide text-secondary hover:bg-state-hover transition-colors text-left"
          style={{ paddingLeft: 12 + (depth * 16) }}
          onContextMenu={(event) => handleContextMenu(event, {
            x: event.clientX,
            y: event.clientY,
            kind: 'group',
            group,
          })}
        >
          <FolderTree size={13} className="shrink-0" />
          <span className="truncate">{group.name}</span>
        </button>
        {groupedSchemas.map((schema) => renderSchemaRow(
          schema.id,
          schema.name,
          schema.color,
          schema.icon,
          depth + 1,
        ))}
        {childGroups.map((child) => renderGroupNode(child, depth + 1))}
      </div>
    );
  };

  const topLevelGroups = childGroupsByParent.get(null) ?? [];
  const ungroupedSchemas = schemasByGroup.get(UNGROUPED_KEY) ?? [];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-secondary uppercase tracking-wider">
          {t('schema.title')}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setGroupDialog({ mode: 'create', parentGroupId: null })}
            className="rounded p-1 text-muted hover:bg-state-hover hover:text-default transition-colors"
            title={tk('typeGroup.create')}
          >
            <FolderPlus size={14} />
          </button>
          <button
            type="button"
            onClick={() => void handleCreateSchema()}
            className="rounded p-1 text-muted hover:bg-state-hover hover:text-default transition-colors"
            title={t('schema.create')}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-col">
        {topLevelGroups.map((group) => renderGroupNode(group, 0))}
        {ungroupedSchemas.length > 0 && (
          <>
            {topLevelGroups.length > 0 && (
              <div className="px-3 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                {tk('typeGroup.ungrouped')}
              </div>
            )}
            {ungroupedSchemas.map((schema) => renderSchemaRow(
              schema.id,
              schema.name,
              schema.color,
              schema.icon,
              0,
            ))}
          </>
        )}
        {schemas.length === 0 && groups.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">
            {t('schema.noSchemas')}
          </div>
        )}
      </div>
      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={buildMenuItems()} onClose={() => setCtx(null)} />}
      <TypeGroupModal
        open={groupDialog !== null}
        onClose={() => setGroupDialog(null)}
        onSubmit={submitGroupDialog}
        initialValue={groupDialog?.mode === 'rename' ? groupDialog.group.name : ''}
        title={groupDialog?.mode === 'rename' ? tk('typeGroup.rename') : tk('typeGroup.create')}
      />
    </div>
  );
}
