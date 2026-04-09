import React, { useEffect, useState, useMemo } from 'react';
import type { EditorTab, Network, NetworkNode, NetworkNodeUpdate, NodeType } from '@netior/shared/types';
import { conceptPropertyService, networkService, objectService } from '../../services';
import { useConceptStore } from '../../stores/concept-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { ScrollArea } from '../ui/ScrollArea';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Button } from '../ui/Button';
import { ConceptPropertiesPanel, FieldInput } from './ConceptPropertiesPanel';
import { ConceptBodyEditor } from './ConceptBodyEditor';
import { ConceptAgentView } from './ConceptAgentView';
import { useI18n } from '../../hooks/useI18n';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';

interface ConceptEditorProps {
  tab: EditorTab;
}

interface ConceptEditorState {
  title: string;
  archetypeId: string | null;
  icon: string | null;
  color: string | null;
  content: string | null;
  properties: Record<string, string | null>;
}

interface ConceptNodeOccurrence {
  network: Network;
  node: NetworkNode;
}

const isDraftTab = (tab: EditorTab) => tab.targetId.startsWith('draft-');

const nodeTypeOptions: Array<{ value: NodeType; label: string }> = [
  { value: 'basic', label: 'Basic' },
  { value: 'portal', label: 'Portal' },
  { value: 'box', label: 'Box' },
];

function resolvePreferredNodeId(
  occurrences: ConceptNodeOccurrence[],
  preferredNodeId?: string,
  preferredNetworkId?: string,
): string {
  if (preferredNodeId && occurrences.some((item) => item.node.id === preferredNodeId)) {
    return preferredNodeId;
  }

  if (preferredNetworkId) {
    const nodeInNetwork = occurrences.find((item) => item.network.id === preferredNetworkId);
    if (nodeInNetwork) return nodeInNetwork.node.id;
  }

  return occurrences[0]?.node.id ?? '';
}

export function ConceptEditor({ tab }: ConceptEditorProps): JSX.Element {
  const { t } = useI18n();
  const isDraft = isDraftTab(tab);
  const currentProject = useProjectStore((s) => s.currentProject);
  const concepts = useConceptStore((s) => s.concepts);
  const { createConcept, updateConcept, loadByProject, upsertProperty } = useConceptStore();
  const archetypes = useArchetypeStore((s) => s.archetypes);
  const fields = useArchetypeStore((s) => s.fields);
  const loadFields = useArchetypeStore((s) => s.loadFields);
  const networks = useNetworkStore((s) => s.networks);
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const { addNode, openNetwork, loadNetworks, updateNode, setNodePosition } = useNetworkStore();
  const [nodeOccurrences, setNodeOccurrences] = useState<ConceptNodeOccurrence[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [nodeMetadataDraft, setNodeMetadataDraft] = useState('');
  const [isLoadingNodeOccurrences, setIsLoadingNodeOccurrences] = useState(false);
  const [isSavingNode, setIsSavingNode] = useState(false);

  const concept = isDraft ? undefined : concepts.find((c) => c.id === tab.targetId);
  useEffect(() => {
    if (!isDraft && !concept && currentProject) {
      loadByProject(currentProject.id);
    }
  }, [isDraft, concept, currentProject, loadByProject]);

  const session = useEditorSession<ConceptEditorState>({
    tabId: tab.id,
    load: isDraft
      ? () => ({
          title: tab.title,
          archetypeId: null,
          icon: null,
          color: null,
          content: null,
          properties: {},
        })
      : async () => {
          const c = useConceptStore.getState().concepts.find((cc) => cc.id === tab.targetId);
          const props = await conceptPropertyService.getByConcept(tab.targetId);
          const propsMap: Record<string, string | null> = {};
          for (const p of props) {
            propsMap[p.field_id] = p.value;
          }
          return {
            title: c?.title ?? '',
            archetypeId: c?.archetype_id ?? null,
            icon: c?.icon ?? null,
            color: c?.color ?? null,
            content: c?.content ?? null,
            properties: propsMap,
          };
        },
    save: isDraft
      ? async (state) => {
          if (!currentProject || !state.title.trim()) return;
          const draft = tab.draftData;
          const newConcept = await createConcept({
            project_id: currentProject.id,
            title: state.title.trim(),
            archetype_id: state.archetypeId || undefined,
            icon: state.icon || undefined,
            color: state.color || undefined,
            content: state.content || undefined,
          });
          for (const [fieldId, value] of Object.entries(state.properties)) {
            if (value != null) {
              await upsertProperty({ concept_id: newConcept.id, field_id: fieldId, value });
            }
          }
          if (draft?.networkId) {
            const conceptObj = await objectService.getByRef('concept', newConcept.id);
            if (conceptObj) {
              const node = await addNode({
                network_id: draft.networkId,
                object_id: conceptObj.id,
              });
              const positionX = typeof draft.positionX === 'number' ? draft.positionX : 0;
              const positionY = typeof draft.positionY === 'number' ? draft.positionY : 0;
              await setNodePosition(node.id, JSON.stringify({ x: positionX, y: positionY }));
            }
            await openNetwork(draft.networkId);
            const networkStore = useNetworkStore.getState();
            if (networkStore.currentNetwork?.project_id) {
              await networkStore.loadNetworkTree(networkStore.currentNetwork.project_id);
            }
          }
          const editorStore = useEditorStore.getState();
          editorStore.closeTab(tab.id);
          editorStore.openTab({
            type: 'concept',
            targetId: newConcept.id,
            title: newConcept.title,
          });
        }
      : async (state) => {
          const conceptId = tab.targetId;
          await updateConcept(conceptId, {
            title: state.title,
            archetype_id: state.archetypeId,
            icon: state.icon,
            color: state.color,
            content: state.content,
          });
          for (const [fieldId, value] of Object.entries(state.properties)) {
            await upsertProperty({ concept_id: conceptId, field_id: fieldId, value });
          }
          useEditorStore.getState().updateTitle(tab.id, state.title);
        },
    deps: isDraft ? [] : [tab.targetId, concept?.archetype_id],
  });

  const currentArchetypeId = session.state?.archetypeId;
  useEffect(() => {
    if (currentArchetypeId && !fields[currentArchetypeId]) {
      loadFields(currentArchetypeId);
    }
  }, [currentArchetypeId, fields, loadFields]);

  useEffect(() => {
    if (!isDraft || !currentArchetypeId) return;
    const arch = archetypes.find((a) => a.id === currentArchetypeId);
    if (arch) {
      session.setState((prev) => ({
        ...prev,
        icon: prev.icon || arch.icon || null,
        color: prev.color || arch.color || null,
      }));
    }
  }, [isDraft, currentArchetypeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allowedIds = tab.draftData?.allowedArchetypeIds;
  const filteredArchetypes = allowedIds
    ? archetypes.filter((a) => allowedIds.includes(a.id))
    : archetypes;

  useEffect(() => {
    if (isDraft && allowedIds && !currentArchetypeId && filteredArchetypes.length > 0) {
      session.setState((prev) => ({ ...prev, archetypeId: filteredArchetypes[0].id }));
    }
  }, [isDraft, allowedIds, currentArchetypeId, filteredArchetypes]); // eslint-disable-line react-hooks/exhaustive-deps

  const archetypeOptions = useMemo(() => [
    ...(allowedIds ? [] : [{ value: '', label: t('common.none') ?? 'None' }]),
    ...filteredArchetypes.map((a) => ({ value: a.id, label: a.name })),
  ], [filteredArchetypes, allowedIds, t]);

  const archetypeFields = currentArchetypeId ? (fields[currentArchetypeId] ?? []) : [];

  useEffect(() => {
    if (!currentProject || isDraft || networks.length > 0) return;
    loadNetworks(currentProject.id);
  }, [currentProject, isDraft, loadNetworks, networks.length]);

  useEffect(() => {
    if (!currentProject || isDraft || networks.length === 0) {
      setNodeOccurrences([]);
      return;
    }

    let ignore = false;
    setIsLoadingNodeOccurrences(true);

    Promise.all(networks.map(async (network) => ({
      network,
      full: await networkService.getFull(network.id),
    })))
      .then((items) => {
        if (ignore) return;
        const occurrences = items.flatMap(({ network, full }) => (
          full?.nodes
            .filter((node) => node.object?.object_type === 'concept' && node.object.ref_id === tab.targetId)
            .map((node) => ({ network, node })) ?? []
        ));
        setNodeOccurrences(occurrences);
      })
      .finally(() => {
        if (!ignore) setIsLoadingNodeOccurrences(false);
      });

    return () => { ignore = true; };
  }, [currentProject, isDraft, networks, tab.targetId]);

  useEffect(() => {
    setSelectedNodeId((current) => {
      if (current && nodeOccurrences.some((item) => item.node.id === current)) return current;
      return resolvePreferredNodeId(nodeOccurrences, tab.nodeId, tab.networkId);
    });
  }, [nodeOccurrences, tab.networkId, tab.nodeId]);

  useEffect(() => {
    const preferred = resolvePreferredNodeId(nodeOccurrences, tab.nodeId, tab.networkId);
    if (preferred) setSelectedNodeId(preferred);
  }, [tab.networkId, tab.nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedNodeOccurrence = useMemo(
    () => nodeOccurrences.find((item) => item.node.id === selectedNodeId),
    [nodeOccurrences, selectedNodeId],
  );

  useEffect(() => {
    setNodeMetadataDraft(selectedNodeOccurrence?.node.metadata ?? '');
  }, [selectedNodeOccurrence?.node.id, selectedNodeOccurrence?.node.metadata]);

  const nodeOccurrenceOptions = useMemo(() => nodeOccurrences.map((item) => {
    const sameNetworkCount = nodeOccurrences.filter((candidate) => candidate.network.id === item.network.id).length;
    const occurrenceIndex = nodeOccurrences
      .filter((candidate) => candidate.network.id === item.network.id)
      .findIndex((candidate) => candidate.node.id === item.node.id);
    const suffix = sameNetworkCount > 1 ? ` / node ${occurrenceIndex + 1}` : '';
    return {
      value: item.node.id,
      label: `${item.network.name}${suffix}`,
    };
  }), [nodeOccurrences]);

  const updateSelectedNetworkNode = async (data: NetworkNodeUpdate) => {
    if (!selectedNodeOccurrence) return;
    setIsSavingNode(true);
    try {
      const updated = currentNetwork?.id === selectedNodeOccurrence.network.id
        ? await updateNode(selectedNodeOccurrence.node.id, data)
        : await networkService.node.update(selectedNodeOccurrence.node.id, data);
      setNodeOccurrences((items) => items.map((item) => (
        item.node.id === updated.id ? { ...item, node: { ...item.node, ...updated } } : item
      )));
    } finally {
      setIsSavingNode(false);
    }
  };

  const saveNodeMetadata = async () => {
    await updateSelectedNetworkNode({ metadata: nodeMetadataDraft.trim() ? nodeMetadataDraft : null });
  };

  if (!isDraft && !concept) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        Loading...
      </div>
    );
  }

  if (session.isLoading) return <></>;

  const update = (patch: Partial<ConceptEditorState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <NetworkObjectEditorShell
          badge={t('objectPanel.concept' as never)}
          title={session.state.title || tab.title || t('concept.defaultTitle')}
          subtitle={isDraft ? t('concept.create') : t('editorShell.networkObject' as never)}
          description={session.state.archetypeId ? archetypes.find((a) => a.id === session.state.archetypeId)?.name ?? null : null}
          showHeader={false}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
              <Input
                value={session.state.title}
                onChange={(e) => {
                  update({ title: e.target.value });
                  useEditorStore.getState().updateTitle(tab.id, e.target.value);
                }}
                placeholder={t('concept.title') ?? 'Title'}
                inputSize={isDraft ? undefined : 'sm'}
                autoFocus={isDraft}
              />

              {archetypes.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary">{t('concept.archetype') ?? 'Archetype'}</label>
                  <Select
                    options={archetypeOptions}
                    value={session.state.archetypeId ?? ''}
                    onChange={(e) => {
                      update({ archetypeId: e.target.value || null, properties: {} });
                    }}
                    selectSize="sm"
                  />
                </div>
              )}
            </NetworkObjectEditorSection>

            {session.state.archetypeId && (
              <NetworkObjectEditorSection title={t('concept.properties')}>
                {isDraft ? (
                  archetypeFields.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {archetypeFields.map((field) => (
                        <FieldInput
                          key={field.id}
                          field={field}
                          value={session.state.properties[field.id] ?? null}
                          onChange={(val) => update({
                            properties: { ...session.state.properties, [field.id]: val },
                          })}
                        />
                      ))}
                    </div>
                  ) : null
                ) : (
                  <ConceptPropertiesPanel
                    archetypeId={session.state.archetypeId}
                    properties={session.state.properties}
                    onChange={(fieldId, value) => update({
                      properties: { ...session.state.properties, [fieldId]: value },
                    })}
                  />
                )}
              </NetworkObjectEditorSection>
            )}

            {!isDraft && (
              <NetworkObjectEditorSection title={t('concept.networkPlacement' as never)}>
                {isLoadingNodeOccurrences && nodeOccurrences.length === 0 ? (
                  <div className="text-xs text-muted">{t('common.loading')}</div>
                ) : nodeOccurrences.length === 0 ? (
                  <div className="rounded-lg border border-subtle bg-surface-base px-3 py-2 text-xs text-muted">
                    {t('concept.noNetworkPlacement' as never)}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-secondary">{t('concept.networkPlacement' as never)}</label>
                      <Select
                        options={nodeOccurrenceOptions}
                        value={selectedNodeId}
                        onChange={(e) => setSelectedNodeId(e.target.value)}
                        selectSize="sm"
                      />
                    </div>

                    {selectedNodeOccurrence && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openNetwork(selectedNodeOccurrence.network.id)}
                          >
                            {t('network.switchNetwork')}
                          </Button>
                          <div className="min-w-0 rounded-lg border border-subtle bg-surface-base px-3 py-1.5 text-xs text-muted">
                            <div className="truncate">{selectedNodeOccurrence.node.id}</div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-secondary">{t('concept.nodeType' as never)}</label>
                          <Select
                            options={nodeTypeOptions}
                            value={selectedNodeOccurrence.node.node_type}
                            onChange={(e) => updateSelectedNetworkNode({ node_type: e.target.value as NodeType })}
                            selectSize="sm"
                            disabled={isSavingNode}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-secondary">{t('concept.nodeMetadata' as never)}</label>
                          <TextArea
                            value={nodeMetadataDraft}
                            onChange={(e) => setNodeMetadataDraft(e.target.value)}
                            rows={4}
                            placeholder='{"label":"local note"}'
                            className="font-mono text-xs"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              isLoading={isSavingNode}
                              onClick={saveNodeMetadata}
                            >
                              {t('concept.saveNodeMetadata' as never)}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </NetworkObjectEditorSection>
            )}

            <NetworkObjectEditorSection title={t('editorShell.content' as never)}>
              <ConceptBodyEditor
                content={session.state.content ?? ''}
                onChange={(content) => update({ content: content || null })}
              />
          </NetworkObjectEditorSection>

            {!isDraft && (
              <NetworkObjectEditorSection title="Agent" defaultOpen={false}>
                <div className="h-[min(60vh,560px)] min-h-[320px] overflow-hidden rounded-lg border border-subtle bg-surface-base">
                  <ConceptAgentView conceptId={tab.targetId} agentContent={concept?.agent_content ?? null} />
                </div>
              </NetworkObjectEditorSection>
            )}

            {!isDraft && concept && (
              <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
                <NetworkObjectMetadataList
                  items={[
                    { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{concept.id}</code> },
                    { label: t('concept.archetype'), value: session.state.archetypeId ? (archetypes.find((a) => a.id === session.state.archetypeId)?.name ?? t('common.none')) : t('common.none') },
                  ]}
                />
              </NetworkObjectEditorSection>
            )}
          </NetworkObjectEditorShell>
      </ScrollArea>
    </div>
  );
}
