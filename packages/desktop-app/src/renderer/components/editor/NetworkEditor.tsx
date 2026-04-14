import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EditorTab, TypeGroup } from '@netior/shared/types';
import { useNetworkStore } from '../../stores/network-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useContextStore } from '../../stores/context-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useConceptStore } from '../../stores/concept-store';
import { useProjectStore } from '../../stores/project-store';
import { useEditorStore } from '../../stores/editor-store';
import { useNetworkObjectSelectionStore } from '../../stores/network-object-selection-store';
import { useTypeGroupStore } from '../../stores/type-group-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { layoutService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { NumberInput } from '../ui/NumberInput';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { listLayouts, getLayout } from '../workspace/layout-plugins/registry';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';
import {
  NetworkObjectBrowser,
  type NetworkBrowserItem,
} from './NetworkObjectBrowser';

interface NetworkEditorProps {
  tab: EditorTab;
}

interface NetworkState {
  name: string;
  layout_type: string;
  layout_config: Record<string, unknown>;
}

export function NetworkEditor({ tab }: NetworkEditorProps): JSX.Element {
  const { t } = useI18n();
  const networkId = tab.targetId;
  const [bulkContextTargetId, setBulkContextTargetId] = useState('');
  const [bulkNetworkTargetId, setBulkNetworkTargetId] = useState<string | null>(null);
  const { networks, currentLayout, updateNetwork, deleteNetwork, loadNetworks, loadNetworkTree, openNetwork } = useNetworkStore();
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const networkTree = useNetworkStore((s) => s.networkTree);
  const nodes = useNetworkStore((s) => s.nodes);
  const edges = useNetworkStore((s) => s.edges);
  const openEditorTab = useEditorStore((s) => s.openTab);
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const openProject = useProjectStore((s) => s.openProject);

  const archetypes = useArchetypeStore((s) => s.archetypes);
  const fields = useArchetypeStore((s) => s.fields);
  const loadFields = useArchetypeStore((s) => s.loadFields);
  const updateArchetype = useArchetypeStore((s) => s.updateArchetype);
  const deleteArchetype = useArchetypeStore((s) => s.deleteArchetype);
  const concepts = useConceptStore((s) => s.concepts);
  const updateConcept = useConceptStore((s) => s.updateConcept);
  const deleteConcept = useConceptStore((s) => s.deleteConcept);
  const relationTypes = useRelationTypeStore((s) => s.relationTypes);
  const updateRelationType = useRelationTypeStore((s) => s.updateRelationType);
  const deleteRelationType = useRelationTypeStore((s) => s.deleteRelationType);
  const contexts = useContextStore((s) => s.contexts);
  const membersByContext = useContextStore((s) => s.membersByContext);
  const loadContexts = useContextStore((s) => s.loadContexts);
  const loadMembers = useContextStore((s) => s.loadMembers);
  const deleteContext = useContextStore((s) => s.deleteContext);
  const addMember = useContextStore((s) => s.addMember);
  const removeMember = useContextStore((s) => s.removeMember);
  const archetypeGroups = useTypeGroupStore((s) => s.groupsByKind.archetype);
  const relationGroups = useTypeGroupStore((s) => s.groupsByKind.relation_type);
  const selection = useNetworkObjectSelectionStore((s) => s.selection);
  const selectedItems = useNetworkObjectSelectionStore((s) => s.selectedItems);
  const setSelection = useNetworkObjectSelectionStore((s) => s.setSelection);
  const clearSelection = useNetworkObjectSelectionStore((s) => s.clearSelection);

  useEffect(() => {
    for (const a of archetypes) {
      if (!fields[a.id]) loadFields(a.id);
    }
  }, [archetypes, fields, loadFields]);

  useEffect(() => {
    void loadContexts(networkId);
  }, [networkId, loadContexts]);

  useEffect(() => {
    if (selection?.objectType === 'context') {
      void loadMembers(selection.id);
    }
  }, [selection, loadMembers]);

  useEffect(() => {
    setBulkContextTargetId('');
    setBulkNetworkTargetId(null);
  }, [selectedItems]);

  useEffect(() => {
    if (selectedItems.length === 0) return;
    for (const context of contexts) {
      if (!membersByContext[context.id]) {
        void loadMembers(context.id);
      }
    }
  }, [contexts, loadMembers, membersByContext, selectedItems.length]);

  const network = networks.find((c) => c.id === networkId);

  const session = useEditorSession<NetworkState>({
    tabId: tab.id,
    load: () => {
      const c = useNetworkStore.getState().networks.find((cv) => cv.id === networkId);
      const layout = useNetworkStore.getState().currentLayout;
      const configJson = layout?.layout_config_json;
      if (!c) return { name: '', layout_type: 'freeform', layout_config: {} };
      return {
        name: c.name,
        layout_type: layout?.layout_type ?? 'freeform',
        layout_config: configJson ? JSON.parse(configJson) : {},
      };
    },
    save: async (state) => {
      await updateNetwork(networkId, { name: state.name });
      const layout = useNetworkStore.getState().currentLayout;
      if (layout) {
        await layoutService.update(layout.id, {
          layout_type: state.layout_type,
          layout_config_json: JSON.stringify(state.layout_config),
        });
      }
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [networkId, currentLayout?.id],
  });

  const handleDelete = useCallback(async () => {
    await deleteNetwork(networkId);
    useEditorStore.getState().closeTab(tab.id);
  }, [networkId, deleteNetwork, tab.id]);

  const layoutOptions = useMemo(
    () => listLayouts().map((p) => ({ value: p.key, label: p.displayName })),
    [],
  );

  const activePlugin = useMemo(() => getLayout(session.state?.layout_type), [session.state?.layout_type]);
  const layoutConfig = session.state?.layout_config ?? {};
  const fieldMappings = (layoutConfig.field_mappings ?? {}) as Record<string, Record<string, string>>;
  const getOptionLabel = useCallback((value: string, keyPrefix?: string) => {
    if (!keyPrefix) return value;
    const key = `${keyPrefix}.${value}`;
    const translated = t(key as never);
    return translated === key ? value : translated;
  }, [t]);

  const update = (patch: Partial<NetworkState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const updateLayoutConfig = (patch: Record<string, unknown>) => {
    session.setState((prev) => ({
      ...prev,
      layout_config: { ...prev.layout_config, ...patch },
    }));
  };

  const updateFieldMapping = (archetypeId: string, key: string, value: string) => {
    const currentMappings = { ...fieldMappings };
    if (!currentMappings[archetypeId]) currentMappings[archetypeId] = {};
    currentMappings[archetypeId] = { ...currentMappings[archetypeId], [key]: value };
    updateLayoutConfig({ field_mappings: currentMappings });
  };

  const browserSections = useMemo(() => {
    const sections: Array<{
      key: NetworkBrowserItem['objectType'];
      label: string;
      items: NetworkBrowserItem[];
    }> = [
      {
        key: 'network' as const,
        label: t('sidebar.networks'),
        items: [...networks]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'network' as const,
            title: item.name,
            subtitle: item.scope === 'project' ? 'Project Network' : 'Network',
            isActive: item.id === currentNetwork?.id,
          })),
      },
      {
        key: 'concept' as const,
        label: t('objectPanel.concept' as never),
        items: [...concepts]
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((item) => ({
            id: item.id,
            objectType: 'concept' as const,
            title: item.title,
            subtitle: item.archetype_id
              ? (archetypes.find((archetype) => archetype.id === item.archetype_id)?.name ?? 'Concept')
              : 'Concept',
          })),
      },
      {
        key: 'archetype' as const,
        label: t('archetype.title'),
        items: [...archetypes]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'archetype' as const,
            title: item.name,
            subtitle: item.description ?? t('archetype.title'),
          })),
      },
      {
        key: 'relation_type' as const,
        label: t('relationType.title'),
        items: [...relationTypes]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'relation_type' as const,
            title: item.name,
            subtitle: item.description ?? t('relationType.title'),
          })),
      },
      {
        key: 'context' as const,
        label: t('context.title'),
        items: [...contexts]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'context' as const,
            title: item.name,
            subtitle: item.description ?? t('context.title'),
          })),
      },
    ];

    if (network?.scope === 'app' || selection?.objectType === 'project') {
      sections.splice(1, 0, {
        key: 'project' as const,
        label: t('project.title' as never) ?? 'Projects',
        items: [...projects]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'project' as const,
            title: item.name,
            subtitle: item.root_dir,
            isActive: item.id === currentProject?.id,
          })),
      });
    }

    return sections;
  }, [t, networks, currentNetwork?.id, concepts, archetypes, relationTypes, contexts, network?.scope, selection?.objectType, projects, currentProject?.id]);

  const selectedItem = useMemo<NetworkBrowserItem | null>(() => {
    const effectiveSelection = selection ?? { objectType: 'network' as const, id: networkId };
    for (const section of browserSections) {
      const match = section.items.find((item) => item.id === effectiveSelection.id && item.objectType === effectiveSelection.objectType);
      if (match) return match;
    }
    return browserSections[0]?.items.find((item) => item.id === networkId) ?? null;
  }, [browserSections, selection, networkId]);

  const openInspectorItem = useCallback(async (item: NetworkBrowserItem) => {
    switch (item.objectType) {
      case 'network':
        await openEditorTab({ type: 'network', targetId: item.id, title: item.title });
        break;
      case 'project':
        await openEditorTab({ type: 'project', targetId: item.id, title: item.title });
        break;
      case 'concept':
        await openEditorTab({ type: 'concept', targetId: item.id, title: item.title });
        break;
      case 'archetype':
        await openEditorTab({ type: 'archetype', targetId: item.id, title: item.title });
        break;
      case 'relation_type':
        await openEditorTab({ type: 'relationType', targetId: item.id, title: item.title });
        break;
      case 'context':
        await openEditorTab({ type: 'context', targetId: item.id, title: item.title });
        break;
    }
  }, [openEditorTab]);

  const openSelectedDetail = useCallback(async () => {
    if (!selectedItem) return;
    await openInspectorItem(selectedItem);
  }, [openInspectorItem, selectedItem]);

  const selectedObjectType = useMemo(() => {
    if (selectedItems.length === 0) return null;
    const firstType = selectedItems[0].objectType;
    return selectedItems.every((item) => item.objectType === firstType) ? firstType : null;
  }, [selectedItems]);

  const selectedNetworkIds = useMemo(
    () => selectedObjectType === 'network' ? selectedItems.map((item) => item.id) : [],
    [selectedItems, selectedObjectType],
  );

  const networkAncestorsById = useMemo(() => {
    const map = new Map<string, string[]>();
    const walk = (treeNodes: typeof networkTree, ancestors: string[] = []) => {
      for (const treeNode of treeNodes) {
        map.set(treeNode.network.id, ancestors);
        walk(treeNode.children, [...ancestors, treeNode.network.id]);
      }
    };
    walk(networkTree);
    return map;
  }, [networkTree]);

  const networkDescendantsById = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const walk = (treeNode: (typeof networkTree)[number]): Set<string> => {
      const descendants = new Set<string>();
      for (const child of treeNode.children) {
        descendants.add(child.network.id);
        for (const descendantId of walk(child)) descendants.add(descendantId);
      }
      map.set(treeNode.network.id, descendants);
      return descendants;
    };
    for (const treeNode of networkTree) walk(treeNode);
    return map;
  }, [networkTree]);

  const topLevelSelectedNetworkIds = useMemo(() => {
    if (selectedObjectType !== 'network') return [];
    const selectedIdSet = new Set(selectedNetworkIds);
    return selectedNetworkIds.filter((id) => {
      const ancestors = networkAncestorsById.get(id) ?? [];
      return !ancestors.some((ancestorId) => selectedIdSet.has(ancestorId));
    });
  }, [networkAncestorsById, selectedNetworkIds, selectedObjectType]);

  const buildGroupOptions = useCallback((groups: TypeGroup[], parentGroupId: string | null = null, depth = 0): Array<{ value: string; label: string }> => {
    return groups
      .filter((group) => (group.parent_group_id ?? null) === parentGroupId)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name);
      })
      .flatMap((group) => ([
        { value: group.id, label: `${'  '.repeat(depth)}${group.name}` },
        ...buildGroupOptions(groups, group.id, depth + 1),
      ]));
  }, []);

  const bulkGroupOptions = useMemo(() => {
    if (selectedObjectType === 'archetype') {
      return [{ value: '', label: t('common.none') ?? 'None' }, ...buildGroupOptions(archetypeGroups)];
    }
    if (selectedObjectType === 'relation_type') {
      return [{ value: '', label: t('common.none') ?? 'None' }, ...buildGroupOptions(relationGroups)];
    }
    return [];
  }, [archetypeGroups, buildGroupOptions, relationGroups, selectedObjectType, t]);

  const currentBulkGroupValue = useMemo(() => {
    if (selectedObjectType === 'archetype') {
      const values = selectedItems.map((item) => archetypes.find((archetype) => archetype.id === item.id)?.group_id ?? null);
      return values.every((value) => value === values[0]) ? (values[0] ?? '') : '';
    }
    if (selectedObjectType === 'relation_type') {
      const values = selectedItems.map((item) => relationTypes.find((relationType) => relationType.id === item.id)?.group_id ?? null);
      return values.every((value) => value === values[0]) ? (values[0] ?? '') : '';
    }
    return '';
  }, [archetypes, relationTypes, selectedItems, selectedObjectType]);

  const canBulkMoveGroup = selectedObjectType === 'archetype' || selectedObjectType === 'relation_type';
  const canBulkChangeArchetype = selectedObjectType === 'concept';
  const canBulkAssignContext = selectedItems.length > 0 && contexts.length > 0;
  const canBulkMoveNetwork = selectedObjectType === 'network' && topLevelSelectedNetworkIds.length > 0;
  const canBulkDelete = selectedItems.length > 0
    && !selectedItems.some((item) => item.objectType === 'project')
    && !selectedItems.some((item) => item.objectType === 'network' && item.id === networkId);

  const handleBulkDelete = useCallback(async () => {
    for (const item of selectedItems) {
      switch (item.objectType) {
        case 'concept':
          await deleteConcept(item.id);
          break;
        case 'archetype':
          await deleteArchetype(item.id);
          break;
        case 'relation_type':
          await deleteRelationType(item.id);
          break;
        case 'context':
          await deleteContext(item.id);
          break;
        case 'network':
          await deleteNetwork(item.id);
          break;
        case 'project':
          break;
      }
    }
    clearSelection();
  }, [clearSelection, deleteArchetype, deleteConcept, deleteContext, deleteNetwork, deleteRelationType, selectedItems]);

  const handleBulkMoveGroup = useCallback(async (groupId: string | null) => {
    if (selectedObjectType === 'archetype') {
      await Promise.all(selectedItems.map((item) => updateArchetype(item.id, { group_id: groupId })));
      return;
    }
    if (selectedObjectType === 'relation_type') {
      await Promise.all(selectedItems.map((item) => updateRelationType(item.id, { group_id: groupId })));
    }
  }, [selectedItems, selectedObjectType, updateArchetype, updateRelationType]);

  const bulkNetworkOptions = useMemo(() => {
    if (selectedObjectType !== 'network') return [];

    const blockedIds = new Set<string>(selectedNetworkIds);
    for (const selectedId of selectedNetworkIds) {
      const descendants = networkDescendantsById.get(selectedId);
      if (!descendants) continue;
      for (const descendantId of descendants) blockedIds.add(descendantId);
    }

    return [
      { value: '', label: t('common.none') ?? 'None' },
      ...[...networks]
        .filter((candidate) => !blockedIds.has(candidate.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((candidate) => ({ value: candidate.id, label: candidate.name })),
    ];
  }, [networkDescendantsById, networks, selectedNetworkIds, selectedObjectType, t]);

  const currentBulkNetworkValue = useMemo(() => {
    if (selectedObjectType !== 'network') return '';
    const values = topLevelSelectedNetworkIds.map((id) => networks.find((networkItem) => networkItem.id === id)?.parent_network_id ?? null);
    return values.every((value) => value === values[0]) ? (values[0] ?? '') : null;
  }, [networks, selectedObjectType, topLevelSelectedNetworkIds]);

  const handleBulkMoveNetwork = useCallback(async (parentNetworkId: string | null) => {
    if (selectedObjectType !== 'network') return;
    await Promise.all(
      topLevelSelectedNetworkIds.map((id) => updateNetwork(id, { parent_network_id: parentNetworkId })),
    );

    const projectId = network?.project_id ?? currentNetwork?.project_id ?? null;
    if (projectId) {
      await loadNetworks(projectId);
      await loadNetworkTree(projectId);
    }
    await openNetwork(networkId);
    setBulkNetworkTargetId('');
  }, [currentNetwork?.project_id, loadNetworkTree, loadNetworks, network?.project_id, networkId, openNetwork, selectedObjectType, topLevelSelectedNetworkIds, updateNetwork]);

  const bulkArchetypeOptions = useMemo(
    () => [
      { value: '', label: t('common.none') ?? 'None' },
      ...[...archetypes]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((archetype) => ({ value: archetype.id, label: archetype.name })),
    ],
    [archetypes, t],
  );

  const currentBulkArchetypeValue = useMemo(() => {
    if (selectedObjectType !== 'concept') return '';
    const values = selectedItems.map((item) => concepts.find((concept) => concept.id === item.id)?.archetype_id ?? null);
    return values.every((value) => value === values[0]) ? (values[0] ?? '') : '';
  }, [concepts, selectedItems, selectedObjectType]);

  const handleBulkChangeArchetype = useCallback(async (archetypeId: string | null) => {
    if (selectedObjectType !== 'concept') return;
    await Promise.all(selectedItems.map((item) => updateConcept(item.id, { archetype_id: archetypeId })));
  }, [selectedItems, selectedObjectType, updateConcept]);

  const bulkContextOptions = useMemo(
    () => [...contexts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((context) => ({ value: context.id, label: context.name })),
    [contexts],
  );

  const selectedContextMemberships = useMemo(() => {
    const selectedIds = new Set(selectedItems.map((item) => item.id));
    return contexts
      .map((context) => {
        const members = membersByContext[context.id] ?? [];
        const count = members.filter((member) => member.member_type === 'object' && selectedIds.has(member.member_id)).length;
        return { context, count };
      })
      .filter((entry) => entry.count > 0);
  }, [contexts, membersByContext, selectedItems]);

  const selectedContextSummary = useMemo(() => {
    if (selectedContextMemberships.length === 0) return t('common.none');
    return selectedContextMemberships
      .map((entry) => `${entry.context.name} (${entry.count})`)
      .join(' / ');
  }, [selectedContextMemberships, t]);

  const targetContextSelectedCount = useMemo(() => {
    if (!bulkContextTargetId) return 0;
    return selectedContextMemberships.find((entry) => entry.context.id === bulkContextTargetId)?.count ?? 0;
  }, [bulkContextTargetId, selectedContextMemberships]);

  const handleBulkAssignContext = useCallback(async (contextId: string) => {
    if (!contextId) return;
    let members = membersByContext[contextId];
    if (!members) {
      await loadMembers(contextId);
      members = useContextStore.getState().membersByContext[contextId] ?? [];
    }

    const existingIds = new Set(
      members
        .filter((member) => member.member_type === 'object')
        .map((member) => member.member_id),
    );

    for (const item of selectedItems) {
      if (existingIds.has(item.id)) continue;
      await addMember(contextId, 'object', item.id);
      existingIds.add(item.id);
    }

    setBulkContextTargetId('');
  }, [addMember, loadMembers, membersByContext, selectedItems]);

  const handleBulkRemoveContext = useCallback(async (contextId: string) => {
    if (!contextId) return;
    let members = membersByContext[contextId];
    if (!members) {
      await loadMembers(contextId);
      members = useContextStore.getState().membersByContext[contextId] ?? [];
    }

    const selectedIds = new Set(selectedItems.map((item) => item.id));
    const removableMembers = members.filter((member) => member.member_type === 'object' && selectedIds.has(member.member_id));
    await Promise.all(removableMembers.map((member) => removeMember(member.id)));
    setBulkContextTargetId('');
  }, [loadMembers, membersByContext, removeMember, selectedItems]);

  const renderInspectorSummary = () => {
    if (selectedItems.length > 1) {
      const counts = selectedItems.reduce<Record<string, number>>((acc, item) => {
        acc[item.objectType] = (acc[item.objectType] ?? 0) + 1;
        return acc;
      }, {});
      const summary = Object.entries(counts)
        .map(([objectType, count]) => `${objectType} ${count}`)
        .join(' / ');

      return (
        <NetworkObjectEditorShell
          badge={t('sidebar.networkObjects' as never)}
          title={`${selectedItems.length} selected`}
          subtitle={summary}
          description={t('editorShell.bulkInspector' as never)}
          actions={(
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void openSelectedDetail();
                }}
                disabled={!selectedItem}
              >
                {t('common.open')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  void handleBulkDelete();
                }}
                disabled={!canBulkDelete}
              >
                {t('common.delete')}
              </Button>
            </div>
          )}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
            <NetworkObjectMetadataList
              items={[
                { label: t('editorShell.focused' as never), value: selection?.title ?? selection?.id ?? selectedItems[0]?.title ?? '-' },
                { label: t('editorShell.objects' as never), value: `${selectedItems.length}` },
              ]}
            />
          </NetworkObjectEditorSection>
          {canBulkMoveGroup && (
            <NetworkObjectEditorSection title={t('typeGroup.group' as never)}>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">{t('typeGroup.group' as never)}</label>
                <Select
                  options={bulkGroupOptions}
                  value={currentBulkGroupValue}
                  onChange={(event) => {
                    void handleBulkMoveGroup(event.target.value || null);
                  }}
                  selectSize="sm"
                />
              </div>
            </NetworkObjectEditorSection>
          )}
          {canBulkMoveNetwork && (
            <NetworkObjectEditorSection title={t('network.parentNetwork' as never)}>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted">{t('network.parentNetwork' as never)}</label>
                <Select
                  options={bulkNetworkOptions}
                  value={bulkNetworkTargetId ?? currentBulkNetworkValue ?? undefined}
                  onChange={(event) => {
                    setBulkNetworkTargetId(event.target.value);
                  }}
                  placeholder={t('network.parentNetwork' as never)}
                  selectSize="sm"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={bulkNetworkTargetId === null || bulkNetworkTargetId === currentBulkNetworkValue}
                  onClick={() => {
                    void handleBulkMoveNetwork(bulkNetworkTargetId || null);
                  }}
                >
                  {t('common.save')}
                </Button>
              </div>
            </NetworkObjectEditorSection>
          )}
          {canBulkChangeArchetype && (
            <NetworkObjectEditorSection title={t('archetype.title')}>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">{t('archetype.title')}</label>
                <Select
                  options={bulkArchetypeOptions}
                  value={currentBulkArchetypeValue}
                  onChange={(event) => {
                    void handleBulkChangeArchetype(event.target.value || null);
                  }}
                  selectSize="sm"
                />
              </div>
            </NetworkObjectEditorSection>
          )}
          {canBulkAssignContext && (
            <NetworkObjectEditorSection title={t('context.title')}>
              <NetworkObjectMetadataList
                items={[
                  { label: t('editorShell.contexts' as never), value: selectedContextSummary ?? '-' },
                ]}
              />
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted">{t('context.title')}</label>
                <Select
                  options={bulkContextOptions}
                  value={bulkContextTargetId}
                  onChange={(event) => {
                    setBulkContextTargetId(event.target.value);
                  }}
                  placeholder={t('context.title')}
                  selectSize="sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!bulkContextTargetId}
                    onClick={() => {
                      void handleBulkAssignContext(bulkContextTargetId);
                    }}
                  >
                    {t('common.assign' as never)}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!bulkContextTargetId || targetContextSelectedCount === 0}
                    onClick={() => {
                      void handleBulkRemoveContext(bulkContextTargetId);
                    }}
                  >
                    {t('common.remove' as never)}
                  </Button>
                </div>
              </div>
            </NetworkObjectEditorSection>
          )}
        </NetworkObjectEditorShell>
      );
    }

    if (!selectedItem) return null;

    if (selectedItem.objectType === 'network' && selectedItem.id === networkId) {
      return (
        <NetworkObjectEditorShell
          badge={t('sidebar.networks')}
          title={session.state.name || network?.name || selectedItem.title}
          subtitle={t('editorShell.networkObject' as never)}
          description={t('network.layoutSettings')}
          actions={(
            <Button
              size="sm"
              variant="ghost"
              className="text-status-error hover:text-status-error"
              onClick={handleDelete}
            >
              {t('common.delete')}
            </Button>
          )}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">{t('network.name') ?? 'Name'}</label>
              <Input
                value={session.state.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
          </NetworkObjectEditorSection>

          <NetworkObjectEditorSection title={t('network.layout')}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">{t('network.layout') ?? 'Layout'}</label>
              <Select
                options={layoutOptions}
                value={session.state.layout_type}
                onChange={(e) => {
                  const newLayout = e.target.value;
                  const plugin = getLayout(newLayout);
                  update({ layout_type: newLayout, layout_config: plugin.getDefaultConfig() });
                }}
                selectSize="sm"
              />
            </div>

            {activePlugin.key !== 'freeform' && (
              <div className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface-base p-3">
                <div className="text-xs font-medium text-muted">{t('network.layoutSettings') ?? 'Layout Settings'}</div>

                {activePlugin.configSchema.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1">
                    <label className="text-xs text-secondary">{t(field.label as never) ?? field.label}</label>
                    {field.type === 'number' ? (
                      <NumberInput
                        value={(layoutConfig[field.key] as number) ?? (field.default as number)}
                        onChange={(val) => updateLayoutConfig({ [field.key]: val })}
                        inputSize="sm"
                        min={0}
                      />
                    ) : field.type === 'enum' ? (
                      <Select
                        options={(field.options ?? []).map((o) => ({
                          value: o,
                          label: getOptionLabel(o, field.optionLabelKeyPrefix),
                        }))}
                        value={(layoutConfig[field.key] as string) ?? (field.default as string)}
                        onChange={(e) => updateLayoutConfig({ [field.key]: e.target.value })}
                        selectSize="sm"
                      />
                    ) : (
                      <Input
                        value={(layoutConfig[field.key] as string) ?? (field.default as string)}
                        onChange={(e) => updateLayoutConfig({ [field.key]: e.target.value })}
                        inputSize="sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </NetworkObjectEditorSection>

          {activePlugin.requiredFields.length > 0 && archetypes.length > 0 && (
            <NetworkObjectEditorSection title={t('network.fieldMappings')}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-secondary">{t('network.addArchetype') ?? 'Add Archetype...'}</div>
                <div className="w-56">
                  <Select
                    options={[
                      { value: '', label: t('network.addArchetype') ?? 'Add Archetype...' },
                      ...archetypes
                        .filter((a) => !fieldMappings[a.id])
                        .map((a) => ({ value: a.id, label: a.name })),
                    ]}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        updateFieldMapping(e.target.value, 'role', 'occurrence');
                      }
                    }}
                    selectSize="sm"
                  />
                </div>
              </div>

              {Object.keys(fieldMappings).map((archId) => {
                const arch = archetypes.find((a) => a.id === archId);
                if (!arch) return null;
                const archFields = fields[archId] ?? [];
                const archMapping = fieldMappings[archId] ?? {};

                return (
                  <div key={archId} className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-base p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-default">{arch.name}</div>
                      <button
                        type="button"
                        className="text-xs text-secondary hover:text-status-error"
                        onClick={() => {
                          const newMappings = { ...fieldMappings };
                          delete newMappings[archId];
                          updateLayoutConfig({ field_mappings: newMappings });
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                    {activePlugin.requiredFields.map((req) => {
                      if (req.type === 'enum') {
                        return (
                          <div key={req.key} className="flex items-center gap-2">
                            <span className="w-28 shrink-0 text-xs text-secondary">{t(req.label as never) ?? req.label}</span>
                            <Select
                              options={(req.options ?? []).map((o) => ({
                                value: o,
                                label: getOptionLabel(o, req.optionLabelKeyPrefix),
                              }))}
                              value={archMapping[req.key] ?? (req.default as string) ?? ''}
                              onChange={(e) => updateFieldMapping(archId, req.key, e.target.value)}
                              selectSize="sm"
                            />
                          </div>
                        );
                      }
                      const reqLabel = t(req.label as never) ?? req.label;
                      const allowedFieldTypes =
                        req.type === 'date'
                          ? ['date', 'datetime']
                          : req.type === 'number'
                            ? ['number', 'rating']
                            : req.type === 'string'
                              ? ['text', 'textarea', 'url', 'color', 'select', 'radio']
                              : null;
                      const fieldOptions = [
                        { value: '', label: req.required ? `-- ${reqLabel} --` : `(${t('common.none') ?? 'None'})` },
                        ...archFields
                          .filter((f) => !allowedFieldTypes || allowedFieldTypes.includes(f.field_type))
                          .map((f) => ({ value: f.id, label: f.name })),
                      ];
                      return (
                        <div key={req.key} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-xs text-secondary">{t(req.label as never) ?? req.label}</span>
                          <Select
                            options={fieldOptions}
                            value={archMapping[req.key] ?? ''}
                            onChange={(e) => updateFieldMapping(archId, req.key, e.target.value)}
                            selectSize="sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </NetworkObjectEditorSection>
          )}

          <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
            <NetworkObjectMetadataList
              items={[
                { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{network?.id}</code> },
                { label: t('network.layout'), value: activePlugin.displayName },
                { label: 'Nodes', value: `${nodes.length}` },
                { label: 'Edges', value: `${edges.length}` },
              ]}
            />
          </NetworkObjectEditorSection>
        </NetworkObjectEditorShell>
      );
    }

    if (selectedItem.objectType === 'concept') {
      const concept = concepts.find((item) => item.id === selectedItem.id);
      const archetypeName = concept?.archetype_id
        ? archetypes.find((item) => item.id === concept.archetype_id)?.name ?? t('common.none')
        : t('common.none');
      return (
        <NetworkObjectEditorShell
          badge={t('objectPanel.concept' as never)}
          title={selectedItem.title}
          subtitle={selectedItem.subtitle}
          description={concept?.content?.slice(0, 240) ?? null}
          actions={<Button size="sm" variant="secondary" onClick={() => void openSelectedDetail()}>{t('editor.openInEditor')}</Button>}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
            <NetworkObjectMetadataList
              items={[
                { label: t('concept.archetype'), value: archetypeName },
                { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{concept?.id ?? selectedItem.id}</code> },
              ]}
            />
          </NetworkObjectEditorSection>
        </NetworkObjectEditorShell>
      );
    }

    if (selectedItem.objectType === 'project') {
      const project = projects.find((item) => item.id === selectedItem.id);

      const handleOpenProjectWorkspace = async () => {
        if (!project) return;
        await openProject(project);
      };

      return (
        <NetworkObjectEditorShell
          badge={t('project.title' as never) ?? 'Project'}
          title={selectedItem.title}
          subtitle={currentProject?.id === selectedItem.id ? 'Current Project' : 'Project'}
          description={project?.root_dir ?? selectedItem.subtitle}
          actions={(
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void handleOpenProjectWorkspace();
                }}
              >
                {t('common.open')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void openSelectedDetail();
                }}
              >
                {t('editor.openInEditor')}
              </Button>
            </div>
          )}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
            <NetworkObjectMetadataList
              items={[
                { label: t('project.folder'), value: project?.root_dir ?? '-' },
                { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{project?.id ?? selectedItem.id}</code> },
              ]}
            />
          </NetworkObjectEditorSection>

          <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
            <NetworkObjectMetadataList
              items={[
                { label: 'Updated', value: project?.updated_at ?? '-' },
                { label: 'Active', value: currentProject?.id === selectedItem.id ? 'true' : 'false' },
              ]}
            />
          </NetworkObjectEditorSection>
        </NetworkObjectEditorShell>
      );
    }

    if (selectedItem.objectType === 'archetype') {
      const archetype = archetypes.find((item) => item.id === selectedItem.id);
      return (
        <NetworkObjectEditorShell
          badge={t('archetype.title')}
          title={selectedItem.title}
          subtitle={t('editorShell.networkObject' as never)}
          description={archetype?.description ?? null}
          actions={<Button size="sm" variant="secondary" onClick={() => void openSelectedDetail()}>{t('editor.openInEditor')}</Button>}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
            <NetworkObjectMetadataList
              items={[
                { label: t('archetype.fields'), value: `${fields[selectedItem.id]?.length ?? 0}` },
                { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{selectedItem.id}</code> },
              ]}
            />
          </NetworkObjectEditorSection>
        </NetworkObjectEditorShell>
      );
    }

    if (selectedItem.objectType === 'relation_type') {
      const relationType = relationTypes.find((item) => item.id === selectedItem.id);
      return (
        <NetworkObjectEditorShell
          badge={t('relationType.title')}
          title={selectedItem.title}
          subtitle={t('editorShell.networkObject' as never)}
          description={relationType?.description ?? null}
          actions={<Button size="sm" variant="secondary" onClick={() => void openSelectedDetail()}>{t('editor.openInEditor')}</Button>}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
            <NetworkObjectMetadataList
              items={[
                { label: t('relationType.lineStyle'), value: relationType?.line_style ?? 'solid' },
                { label: t('relationType.directed'), value: relationType?.directed ? 'true' : 'false' },
                { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{selectedItem.id}</code> },
              ]}
            />
          </NetworkObjectEditorSection>
        </NetworkObjectEditorShell>
      );
    }

    if (selectedItem.objectType === 'context') {
      const context = contexts.find((item) => item.id === selectedItem.id);
      return (
        <NetworkObjectEditorShell
          badge={t('context.title')}
          title={selectedItem.title}
          subtitle={t('editorShell.networkObject' as never)}
          description={context?.description ?? null}
          actions={<Button size="sm" variant="secondary" onClick={() => void openSelectedDetail()}>{t('editor.openInEditor')}</Button>}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
            <NetworkObjectMetadataList
              items={[
                { label: t('context.members'), value: `${membersByContext[selectedItem.id]?.length ?? 0}` },
                { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{selectedItem.id}</code> },
              ]}
            />
          </NetworkObjectEditorSection>
        </NetworkObjectEditorShell>
      );
    }

    return null;
  };

  if (!network) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('network.notFound') ?? 'Network not found'}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden bg-surface-panel">
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <NetworkObjectBrowser
          title={t('sidebar.networkObjects' as never)}
          searchPlaceholder={t('sidebar.search')}
          sections={browserSections}
          selectedKey={selectedItem ? `${selectedItem.objectType}:${selectedItem.id}` : null}
          onSelect={(item) => setSelection({ objectType: item.objectType, id: item.id, title: item.title })}
          onOpen={(item) => {
            setSelection({ objectType: item.objectType, id: item.id, title: item.title });
            void openInspectorItem(item);
          }}
        />
      </div>
      <div className="editor-scrollbar h-full min-h-0 w-[400px] shrink-0 border-l border-subtle bg-surface-base overflow-y-scroll overflow-x-hidden">
        <div className="min-h-full">
          {renderInspectorSummary()}
        </div>
      </div>
    </div>
  );
}
