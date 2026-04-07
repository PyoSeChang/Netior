import React, { useCallback, useMemo } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { useNetworkStore } from '../../stores/network-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { networkService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { ColorPicker } from '../ui/ColorPicker';
import { Toggle } from '../ui/Toggle';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/ScrollArea';

interface EdgeEditorProps {
  tab: EditorTab;
}

interface EdgeState {
  relation_type_id: string | null;
  description: string | null;
  color: string | null;
  line_style: string | null;
  directed: boolean | null;
}

export function EdgeEditor({ tab }: EdgeEditorProps): JSX.Element {
  const { t } = useI18n();
  const edgeId = tab.targetId;
  const edges = useNetworkStore((s) => s.edges);
  const nodes = useNetworkStore((s) => s.nodes);
  const { removeEdge, openNetwork, currentNetwork } = useNetworkStore();
  const relationTypes = useRelationTypeStore((s) => s.relationTypes);

  const edge = edges.find((e) => e.id === edgeId);

  const session = useEditorSession<EdgeState>({
    tabId: tab.id,
    load: () => {
      const e = useNetworkStore.getState().edges.find((ed) => ed.id === edgeId);
      if (!e) return { relation_type_id: null, description: null, color: null, line_style: null, directed: null };
      return {
        relation_type_id: e.relation_type_id,
        description: e.description,
        color: e.color,
        line_style: e.line_style,
        directed: e.directed != null ? !!e.directed : null,
      };
    },
    save: async (state) => {
      await networkService.edge.update(edgeId, state);
      const network = useNetworkStore.getState().currentNetwork;
      if (network) await openNetwork(network.id);
    },
    deps: [edgeId],
  });

  const sourceNode = edge ? nodes.find((n) => n.id === edge.source_node_id) : undefined;
  const targetNode = edge ? nodes.find((n) => n.id === edge.target_node_id) : undefined;

  const sourceLabel = sourceNode?.concept?.title ?? sourceNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?';
  const targetLabel = targetNode?.concept?.title ?? targetNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?';

  const relationTypeOptions = useMemo(() => [
    { value: '', label: t('edge.noRelationType') },
    ...relationTypes.map((rt) => ({ value: rt.id, label: rt.name })),
  ], [relationTypes, t]);

  const lineStyleOptions = [
    { value: '', label: t('edge.inheritFromType') ?? 'Inherit' },
    { value: 'solid', label: t('relationType.solid') },
    { value: 'dashed', label: t('relationType.dashed') },
    { value: 'dotted', label: t('relationType.dotted') },
  ];

  const handleDelete = useCallback(async () => {
    await removeEdge(edgeId);
    useEditorStore.getState().closeTab(tab.id);
  }, [edgeId, removeEdge, tab.id]);

  if (!edge) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('edge.notFound') ?? 'Edge not found'}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  const update = (patch: Partial<EdgeState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  // Resolve effective values for display (edge override > relation type default)
  const rt = edge.relation_type;
  const effectiveDirected = session.state.directed != null ? session.state.directed : (rt?.directed ?? false);

  return (
    <ScrollArea>
      <div className="flex h-full items-start justify-center">
        <div className="flex flex-col gap-6 p-6 w-full max-w-[600px]">
          {/* Source */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('edge.source')}</label>
            <div className="px-3 py-2 text-sm bg-surface-base border border-subtle rounded-md text-default">
              {sourceLabel}
            </div>
          </div>

          {/* Target */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('edge.target')}</label>
            <div className="px-3 py-2 text-sm bg-surface-base border border-subtle rounded-md text-default">
              {targetLabel}
            </div>
          </div>

          {/* Relation Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('edge.relationType')}</label>
            <Select
              options={relationTypeOptions}
              value={session.state.relation_type_id ?? ''}
              onChange={(e) => update({ relation_type_id: e.target.value || null })}
              selectSize="sm"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('relationType.description')}</label>
            <TextArea
              value={session.state.description ?? ''}
              onChange={(e) => update({ description: e.target.value || null })}
              rows={4}
              placeholder={t('edge.descriptionPlaceholder')}
            />
          </div>

          {/* Visual Overrides */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-secondary">{t('edge.visualOverride') ?? 'Visual Override'}</label>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('relationType.color')}</span>
              <ColorPicker
                value={session.state.color ?? undefined}
                onChange={(color) => update({ color })}
              />
              {session.state.color && (
                <button
                  className="text-[10px] text-muted hover:text-default self-start"
                  onClick={() => update({ color: null })}
                >
                  {t('edge.resetToDefault') ?? 'Reset to type default'}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('relationType.lineStyle')}</span>
              <Select
                options={lineStyleOptions}
                value={session.state.line_style ?? ''}
                onChange={(e) => update({ line_style: e.target.value || null })}
                selectSize="sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Toggle
                checked={effectiveDirected}
                onChange={(checked) => update({ directed: checked })}
              />
              <span className="text-xs text-secondary">{t('relationType.directed')}</span>
              {session.state.directed != null && (
                <button
                  className="text-[10px] text-muted hover:text-default"
                  onClick={() => update({ directed: null })}
                >
                  {t('edge.resetToDefault') ?? 'Reset'}
                </button>
              )}
            </div>
          </div>

          {/* Delete */}
          <div className="pt-4 border-t border-subtle">
            <Button
              size="sm"
              variant="ghost"
              className="text-status-error hover:text-status-error"
              onClick={handleDelete}
            >
              {t('edge.delete')}
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
