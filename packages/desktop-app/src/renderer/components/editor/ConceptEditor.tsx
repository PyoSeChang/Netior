import React, { useCallback, useEffect, useState, useMemo } from 'react';
import type {
  EditorTab,
  NodeConfig,
  NodeSortConfig,
  NodeType,
  SystemSlotKey,
} from '@netior/shared/types';
import { SYSTEM_SLOT_DEFINITIONS, getSystemSlotLabelKey } from '@netior/shared/constants';
import { conceptPropertyService, networkService, objectService } from '../../services';
import type { NetworkFullData } from '../../services/network-service';
import { useConceptStore } from '../../stores/concept-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { ScrollArea } from '../ui/ScrollArea';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { TextArea } from '../ui/TextArea';
import { Button } from '../ui/Button';
import { ConceptPropertiesPanel, FieldInput } from './ConceptPropertiesPanel';
import { ConceptBodyEditor } from './ConceptBodyEditor';
import { ConceptAgentView } from './ConceptAgentView';
import { useI18n } from '../../hooks/useI18n';
import { HIERARCHY_PARENT_CONTRACT } from '../../lib/hierarchy-contract';
import {
  createDefaultNodeConfig,
  extractNodeConfig,
  parseNodeMetadataObject,
  stringifyNodeMetadataObject,
  upsertNodeConfigMetadata,
} from '../../lib/node-config';
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
  nodeOccurrences: ConceptNodeOccurrenceDraft[];
}

interface ConceptNodeOccurrenceDraft {
  nodeId: string;
  networkId: string;
  networkName: string;
  nodeType: NodeType;
  metadata: string;
}

type OccurrenceNetworkData = Pick<NetworkFullData, 'nodes' | 'edges'>;

const isDraftTab = (tab: EditorTab) => tab.targetId.startsWith('draft-');

function createNodeConfigDraft(kind: NodeConfig['kind'], previousSort?: NodeSortConfig | null): NodeConfig {
  const base = createDefaultNodeConfig(kind);
  if (base.kind === 'freeform') return base;
  return { ...base, sort: previousSort ?? null };
}

function createSortConfigDraft(kind: NodeSortConfig['kind'], fallbackFieldId?: string): NodeSortConfig | null {
  if (kind === 'system_slot') {
    return {
      kind: 'system_slot',
      slot: 'order_index',
      direction: 'asc',
      emptyPlacement: 'last',
    };
  }

  if (kind === 'property' && fallbackFieldId) {
    return {
      kind: 'property',
      fieldId: fallbackFieldId,
      direction: 'asc',
      emptyPlacement: 'last',
    };
  }

  return null;
}

function isSortableNodeConfig(nodeConfig: NodeConfig | null | undefined): nodeConfig is Extract<NodeConfig, { kind: 'grid' | 'list' }> {
  return !!nodeConfig && nodeConfig.kind !== 'freeform';
}

function resolvePreferredNodeId(
  occurrences: ConceptNodeOccurrenceDraft[],
  preferredNodeId?: string,
  preferredNetworkId?: string,
): string {
  if (preferredNodeId && occurrences.some((item) => item.nodeId === preferredNodeId)) {
    return preferredNodeId;
  }

  if (preferredNetworkId) {
    const nodeInNetwork = occurrences.find((item) => item.networkId === preferredNetworkId);
    if (nodeInNetwork) return nodeInNetwork.nodeId;
  }

  return occurrences[0]?.nodeId ?? '';
}

async function loadConceptNodeOccurrences(
  projectId: string,
  conceptId: string,
): Promise<Pick<ConceptEditorState, 'nodeOccurrences'>> {
  const networks = await networkService.list(projectId);
  const items = await Promise.all(networks.map(async (network) => ({
    network,
    full: await networkService.getFull(network.id),
  })));

  const nodeOccurrences = items.flatMap(({ network, full }) => (
    full?.nodes
      .filter((node) => node.object?.object_type === 'concept' && node.object.ref_id === conceptId)
      .map((node) => {
        const parsedMetadata = parseNodeMetadataObject(node.metadata);
        return {
          nodeId: node.id,
          networkId: network.id,
          networkName: network.name,
          nodeType: node.node_type,
          metadata: parsedMetadata ? stringifyNodeMetadataObject(parsedMetadata) : (node.metadata ?? ''),
        } satisfies ConceptNodeOccurrenceDraft;
      }) ?? []
  ));

  return {
    nodeOccurrences,
  };
}

function isDateOnlyValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function subtractOccurrenceBoundary(value: string, isAllDay: boolean): string | null {
  if (isAllDay || isDateOnlyValue(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setDate(parsed.getDate() - 1);
    return formatDateOnly(parsed);
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setMinutes(parsed.getMinutes() - 1);

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return parsed.toISOString().slice(0, 16) + 'Z';
  }

  return formatLocalDateTime(parsed);
}

export function ConceptEditor({ tab }: ConceptEditorProps): JSX.Element {
  const { t } = useI18n();
  const isDraft = isDraftTab(tab);
  const currentProject = useProjectStore((s) => s.currentProject);
  const concepts = useConceptStore((s) => s.concepts);
  const {
    createConcept,
    updateConcept,
    loadByProject,
    upsertProperty,
    deleteProperty: deleteConceptProperty,
  } = useConceptStore();
  const archetypes = useArchetypeStore((s) => s.archetypes);
  const fields = useArchetypeStore((s) => s.fields);
  const loadFields = useArchetypeStore((s) => s.loadFields);
  const createField = useArchetypeStore((s) => s.createField);
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const currentNetworkNodes = useNetworkStore((s) => s.nodes);
  const currentNetworkEdges = useNetworkStore((s) => s.edges);
  const { addNode, openNetwork, setNodePosition } = useNetworkStore();
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedOccurrenceNetworkData, setSelectedOccurrenceNetworkData] = useState<OccurrenceNetworkData | null>(null);

  const concept = isDraft ? undefined : concepts.find((c) => c.id === tab.targetId);
  const nodeTypeOptions = useMemo<Array<{ value: NodeType; label: string }>>(() => ([
    { value: 'basic', label: t('concept.nodeRoleOptions.basic' as never) },
    { value: 'portal', label: t('concept.nodeRoleOptions.portal' as never) },
    { value: 'group', label: t('concept.nodeRoleOptions.group' as never) },
    { value: 'hierarchy', label: t('concept.nodeRoleOptions.hierarchy' as never) },
  ]), [t]);

  const syncConceptProperties = useCallback(async (
    conceptId: string,
    nextProperties: Record<string, string | null>,
  ) => {
    const existingProperties = await conceptPropertyService.getByConcept(conceptId);
    const nextPropertyMap = new Map(Object.entries(nextProperties));

    await Promise.all(
      existingProperties
        .filter((property) => !nextPropertyMap.has(property.field_id) || nextPropertyMap.get(property.field_id) == null)
        .map((property) => deleteConceptProperty(property.id, conceptId)),
    );

    await Promise.all(
      Object.entries(nextProperties)
        .filter(([, value]) => value != null)
        .map(([fieldId, value]) => upsertProperty({ concept_id: conceptId, field_id: fieldId, value })),
    );
  }, [deleteConceptProperty, upsertProperty]);

  const maybePromoteOccurrenceToSeries = useCallback(async (
    conceptId: string,
    state: ConceptEditorState,
  ) => {
    const liveConcept = useConceptStore.getState().concepts.find((item) => item.id === conceptId);
    if (!liveConcept?.recurrence_source_concept_id || !state.archetypeId) return;

    const activeFields = useArchetypeStore.getState().fields[state.archetypeId] ?? [];
    const recurrenceRuleField = activeFields.find((field) => field.system_slot === 'recurrence_rule');
    const startAtField = activeFields.find((field) => field.system_slot === 'start_at');
    const allDayField = activeFields.find((field) => field.system_slot === 'all_day');

    const recurrenceRule = recurrenceRuleField ? state.properties[recurrenceRuleField.id]?.trim() : '';
    const startAtValue = startAtField ? state.properties[startAtField.id] : null;
    const isAllDay = allDayField ? state.properties[allDayField.id] === 'true' : false;

    if (!recurrenceRule || !startAtValue) return;

    let recurrenceUntilField = activeFields.find((field) => field.system_slot === 'recurrence_until');
    if (!recurrenceUntilField) {
      recurrenceUntilField = await createField({
        archetype_id: state.archetypeId,
        name: t(getSystemSlotLabelKey('recurrence_until') as never),
        field_type: startAtField?.field_type === 'datetime' && !isAllDay ? 'datetime' : 'date',
        sort_order: activeFields.length,
        required: false,
        system_slot: 'recurrence_until',
        slot_binding_locked: true,
        generated_by_trait: true,
      });
    }

    const previousBoundary = subtractOccurrenceBoundary(startAtValue, isAllDay);
    if (!previousBoundary) return;

    await upsertProperty({
      concept_id: liveConcept.recurrence_source_concept_id,
      field_id: recurrenceUntilField.id,
      value: previousBoundary,
    });

    await updateConcept(conceptId, {
      recurrence_source_concept_id: null,
      recurrence_occurrence_key: null,
    });
  }, [createField, t, updateConcept, upsertProperty]);

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
          nodeOccurrences: [],
        })
      : async () => {
          const c = useConceptStore.getState().concepts.find((cc) => cc.id === tab.targetId);
          const props = await conceptPropertyService.getByConcept(tab.targetId);
          const propsMap: Record<string, string | null> = {};
          for (const p of props) {
            propsMap[p.field_id] = p.value;
          }
          const occurrenceState = currentProject
            ? await loadConceptNodeOccurrences(currentProject.id, tab.targetId)
            : { nodeOccurrences: [] };
          return {
            title: c?.title ?? '',
            archetypeId: c?.archetype_id ?? null,
            icon: c?.icon ?? null,
            color: c?.color ?? null,
            content: c?.content ?? null,
            properties: propsMap,
            nodeOccurrences: occurrenceState.nodeOccurrences,
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
          await syncConceptProperties(newConcept.id, state.properties);
          if (draft?.networkId) {
            const conceptObj = await objectService.getByRef('concept', newConcept.id);
            if (conceptObj) {
              const node = await addNode({
                network_id: draft.networkId,
                object_id: conceptObj.id,
              });
              const parentGroupNode = draft.parentGroupNodeId
                ? useNetworkStore.getState().nodes.find((item) => item.id === draft.parentGroupNodeId)
                : undefined;
              if (draft.parentGroupNodeId) {
                await networkService.edge.create({
                  network_id: draft.networkId,
                  source_node_id: draft.parentGroupNodeId,
                  target_node_id: node.id,
                  system_contract: 'core:contains',
                });
                if (parentGroupNode?.node_type === 'hierarchy') {
                  await networkService.edge.create({
                    network_id: draft.networkId,
                    source_node_id: draft.parentGroupNodeId,
                    target_node_id: node.id,
                    system_contract: HIERARCHY_PARENT_CONTRACT,
                  });
                }
              }
              const positionX = typeof draft.positionX === 'number' ? draft.positionX : 0;
              const positionY = typeof draft.positionY === 'number' ? draft.positionY : 0;
              const positionPayload: Record<string, number> = { x: positionX, y: positionY };
              if (typeof draft.slotIndex === 'number') {
                positionPayload.slotIndex = draft.slotIndex;
              }
              await setNodePosition(node.id, JSON.stringify(positionPayload));
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
          await syncConceptProperties(conceptId, state.properties);
          await maybePromoteOccurrenceToSeries(conceptId, state);
          await Promise.all(state.nodeOccurrences.map(async (occurrence) => {
            const nextMetadata = occurrence.metadata.trim() ? occurrence.metadata : null;
            if (currentNetwork?.id === occurrence.networkId) {
              await useNetworkStore.getState().updateNode(occurrence.nodeId, {
                node_type: occurrence.nodeType,
                metadata: nextMetadata,
              });
              return;
            }

            await networkService.node.update(occurrence.nodeId, {
              node_type: occurrence.nodeType,
              metadata: nextMetadata,
            });
          }));
          useEditorStore.getState().updateTitle(tab.id, state.title);
        },
    deps: isDraft ? [] : [tab.targetId, concept?.archetype_id, currentProject?.id],
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

  const nodeOccurrences = session.state?.nodeOccurrences ?? [];
  const selectedNodeOccurrence = useMemo(
    () => nodeOccurrences.find((item) => item.nodeId === selectedNodeId),
    [nodeOccurrences, selectedNodeId],
  );

  useEffect(() => {
    setSelectedNodeId((current) => {
      if (current && nodeOccurrences.some((item) => item.nodeId === current)) return current;
      return resolvePreferredNodeId(nodeOccurrences, tab.nodeId, tab.networkId);
    });
  }, [nodeOccurrences, tab.networkId, tab.nodeId]);

  useEffect(() => {
    if (!selectedNodeOccurrence) {
      setSelectedOccurrenceNetworkData(null);
      return;
    }

    if (currentNetwork?.id === selectedNodeOccurrence.networkId) {
      setSelectedOccurrenceNetworkData({
        nodes: currentNetworkNodes,
        edges: currentNetworkEdges,
      });
      return;
    }

    let ignore = false;
    networkService.getFull(selectedNodeOccurrence.networkId).then((full) => {
      if (ignore) return;
      setSelectedOccurrenceNetworkData(full ? { nodes: full.nodes, edges: full.edges } : null);
    });
    return () => { ignore = true; };
  }, [currentNetwork?.id, currentNetworkEdges, currentNetworkNodes, selectedNodeOccurrence]);

  const selectedNodeMetadataDraft = selectedNodeOccurrence?.metadata ?? '';
  const parsedNodeMetadataDraft = useMemo(
    () => parseNodeMetadataObject(selectedNodeMetadataDraft),
    [selectedNodeMetadataDraft],
  );

  const selectedNodeConfig = useMemo(
    () => extractNodeConfig(parsedNodeMetadataDraft),
    [parsedNodeMetadataDraft],
  );

  const isGroupNodeOccurrence = selectedNodeOccurrence?.nodeType === 'group';

  const directChildIds = useMemo(() => {
    if (!selectedOccurrenceNetworkData || !selectedNodeOccurrence) return new Set<string>();
    return new Set(
      selectedOccurrenceNetworkData.edges
        .filter((edge) => edge.system_contract === 'core:contains' && edge.source_node_id === selectedNodeOccurrence.nodeId)
        .map((edge) => edge.target_node_id),
    );
  }, [selectedOccurrenceNetworkData, selectedNodeOccurrence]);

  const sortableConceptNodes = useMemo(() => {
    if (!selectedOccurrenceNetworkData) return [];

    const directConceptNodes = selectedOccurrenceNetworkData.nodes.filter((node) => (
      directChildIds.has(node.id)
      && node.object?.object_type === 'concept'
      && !!node.concept?.archetype_id
    ));

    if (directConceptNodes.length > 0) {
      return directConceptNodes;
    }

    return selectedOccurrenceNetworkData.nodes.filter((node) => (
      node.object?.object_type === 'concept'
      && !!node.concept?.archetype_id
    ));
  }, [directChildIds, selectedOccurrenceNetworkData]);

  const sortableArchetypeIds = useMemo(() => (
    Array.from(new Set(
      sortableConceptNodes
        .map((node) => node.concept?.archetype_id)
        .filter((value): value is string => !!value),
    ))
  ), [sortableConceptNodes]);

  useEffect(() => {
    for (const archetypeId of sortableArchetypeIds) {
      if (!fields[archetypeId]) {
        void loadFields(archetypeId);
      }
    }
  }, [fields, loadFields, sortableArchetypeIds]);

  const systemSlotSortOptions = useMemo(() => (
    SYSTEM_SLOT_DEFINITIONS.map((definition) => ({
      value: definition.key,
      label: t(getSystemSlotLabelKey(definition.key) as never),
    }))
  ), [t]);

  const propertySortOptions = useMemo(() => {
    const deduped = new Map<string, { value: string; label: string }>();

    for (const archetypeId of sortableArchetypeIds) {
      const archetype = archetypes.find((item) => item.id === archetypeId);
      for (const field of fields[archetypeId] ?? []) {
        deduped.set(field.id, {
          value: field.id,
          label: archetype ? `${field.name} - ${archetype.name}` : field.name,
        });
      }
    }

    return Array.from(deduped.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [archetypes, fields, sortableArchetypeIds]);

  const canEditNodeConfig = !!selectedNodeOccurrence && parsedNodeMetadataDraft !== null;

  const updateSelectedOccurrenceDraft = useCallback((
    updater: (occurrence: ConceptNodeOccurrenceDraft) => ConceptNodeOccurrenceDraft,
  ) => {
    if (!selectedNodeOccurrence) return;
    session.setState((prev) => ({
      ...prev,
      nodeOccurrences: prev.nodeOccurrences.map((occurrence) => (
        occurrence.nodeId === selectedNodeOccurrence.nodeId ? updater(occurrence) : occurrence
      )),
    }));
  }, [selectedNodeOccurrence, session]);

  const updateSelectedOccurrenceMetadata = useCallback((metadata: string) => {
    updateSelectedOccurrenceDraft((occurrence) => ({ ...occurrence, metadata }));
  }, [updateSelectedOccurrenceDraft]);

  const updateSelectedOccurrenceNodeConfig = useCallback((nodeConfig: NodeConfig | null) => {
    const parsed = parseNodeMetadataObject(selectedNodeMetadataDraft);
    if (parsed === null) return;
    updateSelectedOccurrenceMetadata(stringifyNodeMetadataObject(upsertNodeConfigMetadata(parsed, nodeConfig)));
  }, [selectedNodeMetadataDraft, updateSelectedOccurrenceMetadata]);

  const updateStructuredNodeConfigDraft = useCallback((updater: (config: NodeConfig) => NodeConfig) => {
    if (!selectedNodeConfig) return;
    updateSelectedOccurrenceNodeConfig(updater(selectedNodeConfig));
  }, [selectedNodeConfig, updateSelectedOccurrenceNodeConfig]);

  const nodeOccurrenceOptions = useMemo(() => nodeOccurrences.map((item) => {
    const sameNetworkCount = nodeOccurrences.filter((candidate) => candidate.networkId === item.networkId).length;
    const occurrenceIndex = nodeOccurrences
      .filter((candidate) => candidate.networkId === item.networkId)
      .findIndex((candidate) => candidate.nodeId === item.nodeId);
    const suffix = sameNetworkCount > 1 ? ` / node ${occurrenceIndex + 1}` : '';
    return {
      value: item.nodeId,
      label: `${item.networkName}${suffix}`,
    };
  }), [nodeOccurrences]);

  const nodeLayoutOptions = useMemo(() => ([
    { value: '', label: t('common.none') ?? 'None' },
    { value: 'freeform', label: t('concept.nodeLayoutKindOptions.freeform' as never) },
    { value: 'grid', label: t('concept.nodeLayoutKindOptions.grid' as never) },
    { value: 'list', label: t('concept.nodeLayoutKindOptions.list' as never) },
  ]), [t]);

  const sortKindOptions = useMemo(() => ([
    { value: '', label: t('common.none') ?? 'None' },
    { value: 'system_slot', label: t('concept.nodeSortKindOptions.system_slot' as never) },
    { value: 'property', label: t('concept.nodeSortKindOptions.property' as never) },
  ]), [t]);

  const sortDirectionOptions = useMemo(() => ([
    { value: 'asc', label: t('concept.nodeSortDirectionOptions.asc' as never) },
    { value: 'desc', label: t('concept.nodeSortDirectionOptions.desc' as never) },
  ]), [t]);

  const emptyPlacementOptions = useMemo(() => ([
    { value: 'last', label: t('concept.nodeSortEmptyOptions.last' as never) },
    { value: 'first', label: t('concept.nodeSortEmptyOptions.first' as never) },
  ]), [t]);

  const sortableNodeConfig = isSortableNodeConfig(selectedNodeConfig) ? selectedNodeConfig : null;
  const sortableNodeSortConfig = sortableNodeConfig?.sort ?? null;

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
                {nodeOccurrences.length === 0 ? (
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
                            onClick={() => openNetwork(selectedNodeOccurrence.networkId)}
                          >
                            {t('network.switchNetwork')}
                          </Button>
                          <div className="min-w-0 rounded-lg border border-subtle bg-surface-base px-3 py-1.5 text-xs text-muted">
                            <div className="truncate">{selectedNodeOccurrence.nodeId}</div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-secondary">{t('concept.nodeRole' as never)}</label>
                          <Select
                            options={nodeTypeOptions}
                            value={selectedNodeOccurrence.nodeType}
                            onChange={(e) => updateSelectedOccurrenceDraft((occurrence) => ({
                              ...occurrence,
                              nodeType: e.target.value as NodeType,
                            }))}
                            selectSize="sm"
                          />
                          <div className="text-[11px] text-muted">{t('concept.nodeRoleHint' as never)}</div>
                        </div>

                        {isGroupNodeOccurrence && (
                          <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-base px-3 py-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-secondary">{t('concept.nodeLayoutKind' as never)}</label>
                              <Select
                                options={nodeLayoutOptions}
                                value={selectedNodeConfig?.kind ?? ''}
                                onChange={(e) => {
                                  if (!e.target.value) {
                                    updateSelectedOccurrenceNodeConfig(null);
                                    return;
                                  }

                                  const previousSort = isSortableNodeConfig(selectedNodeConfig)
                                    ? selectedNodeConfig.sort ?? null
                                    : null;

                                  updateSelectedOccurrenceNodeConfig(
                                    createNodeConfigDraft(e.target.value as NodeConfig['kind'], previousSort),
                                  );
                                }}
                                selectSize="sm"
                                disabled={!canEditNodeConfig}
                              />
                              <div className="text-[11px] text-muted">{t('concept.nodeConfigHint' as never)}</div>
                            </div>

                            {selectedNodeConfig?.kind === 'grid' && (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('concept.nodeConfigColumns' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.columns ?? 2}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, columns: Math.max(1, Math.floor(value)) }
                                          : config
                                      ))}
                                      min={1}
                                      step={1}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('concept.nodeConfigPadding' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.padding ?? 24}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, padding: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('concept.nodeConfigGapX' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.gapX ?? 16}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, gapX: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('concept.nodeConfigGapY' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.gapY ?? 16}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, gapY: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('concept.nodeConfigItemWidth' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.itemWidth ?? 160}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, itemWidth: Math.max(48, value) }
                                          : config
                                      ))}
                                      min={48}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('concept.nodeConfigItemHeight' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.itemHeight ?? 60}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'grid'
                                          ? { ...config, itemHeight: Math.max(40, value) }
                                          : config
                                      ))}
                                      min={40}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            {selectedNodeConfig?.kind === 'list' && (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('concept.nodeConfigPadding' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.padding ?? 24}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'list'
                                          ? { ...config, padding: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('concept.nodeConfigGap' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.gap ?? 12}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'list'
                                          ? { ...config, gap: Math.max(0, value) }
                                          : config
                                      ))}
                                      min={0}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-secondary">{t('concept.nodeConfigItemHeight' as never)}</label>
                                    <NumberInput
                                      value={selectedNodeConfig.itemHeight ?? 60}
                                      onChange={(value) => updateStructuredNodeConfigDraft((config) => (
                                        config.kind === 'list'
                                          ? { ...config, itemHeight: Math.max(40, value) }
                                          : config
                                      ))}
                                      min={40}
                                      step={4}
                                      inputSize="sm"
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            {sortableNodeConfig && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-secondary">{t('concept.nodeSortKind' as never)}</label>
                                  <Select
                                    options={sortKindOptions}
                                    value={sortableNodeSortConfig?.kind ?? ''}
                                    onChange={(e) => {
                                      if (!e.target.value) {
                                        updateStructuredNodeConfigDraft((config) => (
                                          isSortableNodeConfig(config) ? { ...config, sort: null } : config
                                        ));
                                        return;
                                      }

                                      updateStructuredNodeConfigDraft((config) => (
                                        isSortableNodeConfig(config)
                                          ? {
                                              ...config,
                                              sort: createSortConfigDraft(
                                                e.target.value as NodeSortConfig['kind'],
                                                propertySortOptions[0]?.value,
                                              ),
                                            }
                                          : config
                                      ));
                                    }}
                                    selectSize="sm"
                                    disabled={!canEditNodeConfig}
                                  />
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-secondary">{t('concept.nodeSortValue' as never)}</label>
                                  {sortableNodeSortConfig?.kind === 'system_slot' ? (
                                    <Select
                                      options={systemSlotSortOptions}
                                      value={sortableNodeSortConfig.slot}
                                      onChange={(e) => updateStructuredNodeConfigDraft((config) => (
                                        isSortableNodeConfig(config) && config.sort?.kind === 'system_slot'
                                          ? { ...config, sort: { ...config.sort, slot: e.target.value as SystemSlotKey } }
                                          : config
                                      ))}
                                      selectSize="sm"
                                      searchable
                                      disabled={!canEditNodeConfig}
                                    />
                                  ) : sortableNodeSortConfig?.kind === 'property' ? (
                                    <Select
                                      options={propertySortOptions}
                                      value={sortableNodeSortConfig.fieldId}
                                      onChange={(e) => updateStructuredNodeConfigDraft((config) => (
                                        isSortableNodeConfig(config) && config.sort?.kind === 'property'
                                          ? { ...config, sort: { ...config.sort, fieldId: e.target.value } }
                                          : config
                                      ))}
                                      selectSize="sm"
                                      searchable
                                      emptyMessage={t('concept.nodeSortNoPropertyOptions' as never)}
                                      disabled={!canEditNodeConfig || propertySortOptions.length === 0}
                                    />
                                  ) : (
                                    <Input
                                      value=""
                                      readOnly
                                      inputSize="sm"
                                      placeholder={t('concept.nodeSortValueDisabled' as never)}
                                    />
                                  )}
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-secondary">{t('concept.nodeSortDirection' as never)}</label>
                                  <Select
                                    options={sortDirectionOptions}
                                    value={sortableNodeSortConfig?.direction ?? 'asc'}
                                    onChange={(e) => updateStructuredNodeConfigDraft((config) => (
                                      isSortableNodeConfig(config) && config.sort
                                        ? { ...config, sort: { ...config.sort, direction: e.target.value as 'asc' | 'desc' } }
                                        : config
                                    ))}
                                    selectSize="sm"
                                    disabled={!sortableNodeSortConfig || !canEditNodeConfig}
                                  />
                                </div>

                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-secondary">{t('concept.nodeSortEmptyPlacement' as never)}</label>
                                  <Select
                                    options={emptyPlacementOptions}
                                    value={sortableNodeSortConfig?.emptyPlacement ?? 'last'}
                                    onChange={(e) => updateStructuredNodeConfigDraft((config) => (
                                      isSortableNodeConfig(config) && config.sort
                                        ? { ...config, sort: { ...config.sort, emptyPlacement: e.target.value as 'first' | 'last' } }
                                        : config
                                    ))}
                                    selectSize="sm"
                                    disabled={!sortableNodeSortConfig || !canEditNodeConfig}
                                  />
                                </div>
                              </div>
                            )}

                            {!canEditNodeConfig && (
                              <div className="text-[11px] text-muted">
                                {t('concept.nodeConfigInvalidMetadataHint' as never)}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-secondary">{t('concept.nodeMetadata' as never)}</label>
                          <TextArea
                            value={selectedNodeMetadataDraft}
                            onChange={(e) => updateSelectedOccurrenceMetadata(e.target.value)}
                            rows={4}
                            placeholder='{"label":"local note"}'
                            className="font-mono text-xs"
                          />
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
