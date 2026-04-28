import React, { useCallback, useMemo } from 'react';
import type { EditorTab, RelationMeaningKey } from '@netior/shared/types';
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
import { isHierarchyParentMeaning } from '../../lib/hierarchy-meaning';

interface EdgeEditorProps {
  tab: EditorTab;
}

interface EdgeVisualState {
  color: string | null;
  line_style: string | null;
  directed: boolean | null;
}

interface EdgeState {
  relation_type_id: string | null;
  relation_meaning: RelationMeaningKey | null;
  description: string | null;
  visual: EdgeVisualState;
}

export function EdgeEditor({ tab }: EdgeEditorProps): JSX.Element {
  const { t } = useI18n();
  const edgeId = tab.targetId;
  const edges = useNetworkStore((s) => s.edges);
  const nodes = useNetworkStore((s) => s.nodes);
  const { removeEdge, openNetwork, currentNetwork } = useNetworkStore();
  const relationTypes = useRelationTypeStore((s) => s.relationTypes);

  const edge = edges.find((e) => e.id === edgeId);
  const edgeVisuals = useNetworkStore((s) => s.edgeVisuals);
  const { setEdgeVisual } = useNetworkStore();

  const session = useEditorSession<EdgeState>({
    tabId: tab.id,
    load: () => {
      const e = useNetworkStore.getState().edges.find((ed) => ed.id === edgeId);
      if (!e) return { relation_type_id: null, relation_meaning: null, description: null, visual: { color: null, line_style: null, directed: null } };
      const ev = useNetworkStore.getState().edgeVisuals.find((v) => v.edgeId === edgeId);
      const parsed: EdgeVisualState = ev ? JSON.parse(ev.visualJson) : { color: null, line_style: null, directed: null };
      return {
        relation_type_id: e.relation_type_id,
        relation_meaning: e.relation_meaning,
        description: e.description,
        visual: parsed,
      };
    },
    save: async (state) => {
      await networkService.edge.update(edgeId, {
        relation_type_id: state.relation_type_id,
        relation_meaning: state.relation_meaning,
        description: state.description,
      });
      await setEdgeVisual(edgeId, JSON.stringify(state.visual));
      const network = useNetworkStore.getState().currentNetwork;
      if (network) await openNetwork(network.id);
    },
    deps: [edgeId],
  });

  const sourceNode = edge ? nodes.find((n) => n.id === edge.source_node_id) : undefined;
  const targetNode = edge ? nodes.find((n) => n.id === edge.target_node_id) : undefined;
  const sessionState = session.state;

  const sourceLabel = sourceNode?.concept?.title ?? sourceNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?';
  const targetLabel = targetNode?.concept?.title ?? targetNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?';
  const isHierarchyMeaning = isHierarchyParentMeaning(sessionState?.relation_meaning);

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

  if (session.isLoading || !sessionState) return <></>;

  const update = (patch: Partial<EdgeState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const updateVisual = (patch: Partial<EdgeVisualState>) => {
    session.setState((prev) => ({ ...prev, visual: { ...prev.visual, ...patch } }));
  };

  // Resolve effective values for display (edge override > relation type default)
  const rt = edge.relation_type;
  const effectiveDirected = session.state.visual.directed != null ? session.state.visual.directed : (rt?.directed ?? false);

  return (
    <ScrollArea>
      <div className="flex h-full items-start justify-center">
        <div className="flex flex-col gap-6 p-6 w-full max-w-[600px]">
          {isHierarchyMeaning && (
            <div className="sticky top-3 z-[1] mx-auto w-full max-w-[520px] rounded-md border border-default bg-surface-floating px-4 py-3 text-xs text-default shadow-sm">
              <div className="font-medium">{t('edge.hierarchyDirectionTitle')}</div>
              <div className="mt-1 text-secondary">
                {t('edge.hierarchyDirectionBody', { source: sourceLabel, target: targetLabel })}
              </div>
            </div>
          )}

          {/* Source */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('edge.source')}</label>
            <div className="px-3 py-2 text-sm bg-surface-editor border border-subtle rounded-md text-default">
              {sourceLabel}
            </div>
          </div>

          {/* Target */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">{t('edge.target')}</label>
            <div className="px-3 py-2 text-sm bg-surface-editor border border-subtle rounded-md text-default">
              {targetLabel}
            </div>
          </div>

          {/* Relation Type */}
          {session.state.relation_meaning && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">System Meaning</label>
              <div className="rounded-md border border-subtle bg-surface-editor px-3 py-2 text-xs text-default">
                {session.state.relation_meaning}
              </div>
            </div>
          )}

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
                value={session.state.visual.color ?? undefined}
                onChange={(color) => updateVisual({ color })}
              />
              {session.state.visual.color && (
                <button
                  className="text-[10px] text-muted hover:text-default self-start"
                  onClick={() => updateVisual({ color: null })}
                >
                  {t('edge.resetToDefault') ?? 'Reset to type default'}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-secondary">{t('relationType.lineStyle')}</span>
              <Select
                options={lineStyleOptions}
                value={session.state.visual.line_style ?? ''}
                onChange={(e) => updateVisual({ line_style: e.target.value || null })}
                selectSize="sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Toggle
                checked={effectiveDirected}
                onChange={(checked) => updateVisual({ directed: checked })}
              />
              <span className="text-xs text-secondary">{t('relationType.directed')}</span>
              {session.state.visual.directed != null && (
                <button
                  className="text-[10px] text-muted hover:text-default"
                  onClick={() => updateVisual({ directed: null })}
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
