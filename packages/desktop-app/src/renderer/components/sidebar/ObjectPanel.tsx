import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TypeGroup, TypeGroupKind } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Eye,
  EyeOff,
  FolderPlus,
  FolderTree,
  GripVertical,
  Layers3,
  Plus,
  Shapes,
  Share2,
  Trash2,
  Waypoints,
} from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';
import { useProjectStore } from '../../stores/project-store';
import { useConceptStore } from '../../stores/concept-store';
import { useNetworkStore } from '../../stores/network-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useContextStore } from '../../stores/context-store';
import { useEditorStore } from '../../stores/editor-store';
import { useNetworkObjectSelectionStore } from '../../stores/network-object-selection-store';
import { useTypeGroupStore } from '../../stores/type-group-store';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { getIconComponent } from '../ui/lucide-utils';
import { TypeGroupModal } from './TypeGroupModal';

type PanelObjectType = 'concept' | 'network' | 'archetype' | 'relation_type' | 'context';
type GroupablePanelObjectType = Extract<PanelObjectType, 'archetype' | 'relation_type'>;

type PanelItem =
  | {
      id: string;
      kind: 'object';
      objectType: PanelObjectType;
      title: string;
      subtitle: string;
      color?: string | null;
      isActive?: boolean;
      iconName?: string | null;
    }
  | {
      id: string;
      kind: 'group';
      objectType: GroupablePanelObjectType;
      title: string;
      subtitle: string;
      parentGroupId: string | null;
      groupKind: TypeGroupKind;
    };

type PanelRow = {
  key: string;
  depth: number;
  item: PanelItem;
};

type PanelSection = {
  objectType: PanelObjectType;
  label: string;
  rows: PanelRow[];
};

type ContextMenuState = {
  x: number;
  y: number;
  row: PanelRow | null;
};

type GroupDialogState =
  | { mode: 'create'; kind: TypeGroupKind; parentGroupId: string | null }
  | { mode: 'rename'; group: TypeGroup };

type DragPayload = {
  keys: string[];
  objectType: GroupablePanelObjectType;
};

type InlineGroupCreateState = {
  kind: GroupablePanelObjectType;
  parentGroupId: string | null;
  value: string;
};

type ActiveDragState = {
  rows: PanelRow[];
  objectType: GroupablePanelObjectType;
} | null;

const FILTERS: Array<{ key: PanelObjectType; icon: React.ElementType; labelKey: TranslationKey | string }> = [
  { key: 'concept', icon: CircleDot, labelKey: 'objectPanel.concept' },
  { key: 'network', icon: Waypoints, labelKey: 'sidebar.networks' },
  { key: 'archetype', icon: Shapes, labelKey: 'archetype.title' },
  { key: 'relation_type', icon: Share2, labelKey: 'relationType.title' },
  { key: 'context', icon: Layers3, labelKey: 'context.title' },
];

function getGroupName(groups: TypeGroup[], groupId: string | null): string | null {
  if (!groupId) return null;
  return groups.find((group) => group.id === groupId)?.name ?? null;
}

function getSelectionRange(rows: PanelRow[], anchorKey: string | null, targetKey: string): string[] {
  const anchorIndex = anchorKey ? rows.findIndex((row) => row.key === anchorKey) : -1;
  const targetIndex = rows.findIndex((row) => row.key === targetKey);
  if (targetIndex === -1) return [targetKey];
  const start = anchorIndex === -1 ? targetIndex : Math.min(anchorIndex, targetIndex);
  const end = anchorIndex === -1 ? targetIndex : Math.max(anchorIndex, targetIndex);
  return rows.slice(start, end + 1).map((row) => row.key);
}

function isGroupableType(type: PanelObjectType): type is GroupablePanelObjectType {
  return type === 'archetype' || type === 'relation_type';
}

function isDescendantGroup(groupId: string, parentGroupId: string | null, groups: TypeGroup[]): boolean {
  let current = parentGroupId;
  while (current) {
    if (current === groupId) return true;
    current = groups.find((group) => group.id === current)?.parent_group_id ?? null;
  }
  return false;
}

function buildTreeRows<T extends { id: string; name: string; group_id: string | null }>(
  objectType: GroupablePanelObjectType,
  groups: TypeGroup[],
  items: T[],
  expandedGroups: Set<string>,
  baseSubtitle: string,
  mapItem: (item: T) => Omit<Extract<PanelItem, { kind: 'object' }>, 'id' | 'kind' | 'objectType'>,
): PanelRow[] {
  const groupByParent = new Map<string | null, TypeGroup[]>();
  const itemsByGroup = new Map<string | null, T[]>();

  for (const group of groups) {
    const key = group.parent_group_id ?? null;
    const current = groupByParent.get(key) ?? [];
    groupByParent.set(key, [...current, group]);
  }

  for (const item of items) {
    const key = item.group_id ?? null;
    const current = itemsByGroup.get(key) ?? [];
    itemsByGroup.set(key, [...current, item]);
  }

  const sortGroups = (list: TypeGroup[]) => [...list].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
  const sortItems = (list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));
  const rows: PanelRow[] = [];

  const visit = (parentGroupId: string | null, depth: number) => {
    for (const group of sortGroups(groupByParent.get(parentGroupId) ?? [])) {
      rows.push({
        key: `group:${objectType}:${group.id}`,
        depth,
        item: {
          id: group.id,
          kind: 'group',
          objectType,
          title: group.name,
          subtitle: `${baseSubtitle} Folder`,
          parentGroupId: group.parent_group_id,
          groupKind: group.kind,
        },
      });

      if (!expandedGroups.has(group.id)) continue;

      for (const item of sortItems(itemsByGroup.get(group.id) ?? [])) {
        const mapped = mapItem(item);
        rows.push({
          key: `object:${objectType}:${item.id}`,
          depth: depth + 1,
          item: {
            ...mapped,
            id: item.id,
            kind: 'object',
            objectType,
          },
        });
      }

      visit(group.id, depth + 1);
    }

    if (parentGroupId !== null) return;

    for (const item of sortItems(itemsByGroup.get(null) ?? [])) {
      const mapped = mapItem(item);
      rows.push({
        key: `object:${objectType}:${item.id}`,
        depth,
        item: {
          ...mapped,
          id: item.id,
          kind: 'object',
          objectType,
        },
      });
    }
  };

  visit(null, 0);
  return rows;
}

function ObjectTypeFilterSelect({
  selectedTypes,
  onChange,
  labelFor,
  allLabel,
}: {
  selectedTypes: PanelObjectType[];
  onChange: (next: PanelObjectType[]) => void;
  labelFor: (type: PanelObjectType) => string;
  allLabel: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPos = useAnchoredDropdown(open, rootRef, {
    estimatedHeight: 190,
    minWidth: 192,
  }, dropdownRef);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleWindowBlur = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [open]);

  const summary = selectedTypes.length === FILTERS.length
    ? allLabel
    : selectedTypes.length === 1
      ? labelFor(selectedTypes[0])
      : `${selectedTypes.length}`;
  const toggleType = (type: PanelObjectType) => {
    const selected = selectedTypes.includes(type);
    const next = selected
      ? selectedTypes.filter((selectedType) => selectedType !== type)
      : [...selectedTypes, type];
    onChange(next.length === 0 ? FILTERS.map((item) => item.key) : next);
  };

  return (
    <div className="shrink-0" ref={rootRef}>
      <button
        type="button"
        className="flex h-7 w-16 items-center justify-between rounded border border-input bg-input px-2 text-xs text-default transition-colors hover:border-strong"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed rounded-md border border-default bg-surface-modal p-1 shadow-lg"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxHeight: dropdownPos.maxHeight,
            visibility: dropdownPos.ready ? 'visible' : 'hidden',
            zIndex: 10001,
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {FILTERS.map((filter) => {
            const Icon = filter.icon;
            const selected = selectedTypes.includes(filter.key);
            return (
              <div
                key={filter.key}
                role="menuitemcheckbox"
                aria-checked={selected}
                tabIndex={0}
                className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-default transition-colors hover:bg-surface-hover"
                onClick={() => toggleType(filter.key)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  toggleType(filter.key);
                }}
              >
                <div onClick={(event) => event.stopPropagation()}>
                  <Checkbox checked={selected} onChange={() => toggleType(filter.key)} />
                </div>
                <Icon size={14} className="shrink-0 text-secondary" />
                <span className="min-w-0 flex-1 truncate">{labelFor(filter.key)}</span>
              </div>
            );
          })}
        </div>
      , document.body)}
    </div>
  );
}

function InlineGroupInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  depth = 0,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
  depth?: number;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit();
    } else {
      onCancel();
    }
  };

  return (
    <div style={{ paddingLeft: `${8 + depth * 16}px` }}>
      <Input
        ref={inputRef}
        value={value}
        inputSize="sm"
        placeholder={placeholder}
        className="h-7"
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleSubmit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        onBlur={handleSubmit}
      />
    </div>
  );
}

export function ObjectPanel(): JSX.Element {
  const { t } = useI18n();
  const tk = (key: string) => t(key as TranslationKey);
  const currentProject = useProjectStore((state) => state.currentProject);
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const networks = useNetworkStore((state) => state.networks);
  const concepts = useConceptStore((state) => state.concepts);
  const archetypes = useArchetypeStore((state) => state.archetypes);
  const relationTypes = useRelationTypeStore((state) => state.relationTypes);
  const contexts = useContextStore((state) => state.contexts);
  const activeContextId = useContextStore((state) => state.activeContextId);
  const loadContexts = useContextStore((state) => state.loadContexts);
  const createContext = useContextStore((state) => state.createContext);
  const deleteContext = useContextStore((state) => state.deleteContext);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const createArchetype = useArchetypeStore((state) => state.createArchetype);
  const updateArchetype = useArchetypeStore((state) => state.updateArchetype);
  const deleteArchetype = useArchetypeStore((state) => state.deleteArchetype);
  const createRelationType = useRelationTypeStore((state) => state.createRelationType);
  const updateRelationType = useRelationTypeStore((state) => state.updateRelationType);
  const deleteRelationType = useRelationTypeStore((state) => state.deleteRelationType);
  const deleteConcept = useConceptStore((state) => state.deleteConcept);
  const createNetwork = useNetworkStore((state) => state.createNetwork);
  const deleteNetwork = useNetworkStore((state) => state.deleteNetwork);
  const openNetwork = useNetworkStore((state) => state.openNetwork);
  const loadNetworkTree = useNetworkStore((state) => state.loadNetworkTree);
  const archetypeGroups = useTypeGroupStore((state) => state.groupsByKind.archetype);
  const relationGroups = useTypeGroupStore((state) => state.groupsByKind.relation_type);
  const createGroup = useTypeGroupStore((state) => state.createGroup);
  const updateGroup = useTypeGroupStore((state) => state.updateGroup);
  const deleteGroup = useTypeGroupStore((state) => state.deleteGroup);
  const networkObjectSelection = useNetworkObjectSelectionStore((state) => state.selection);
  const selectedNetworkObjects = useNetworkObjectSelectionStore((state) => state.selectedItems);
  const setNetworkObjectSelection = useNetworkObjectSelectionStore((state) => state.setSelection);
  const setNetworkObjectSelectionState = useNetworkObjectSelectionStore((state) => state.setSelectionState);
  const [selectedTypes, setSelectedTypes] = useState<PanelObjectType[]>(() => FILTERS.map((filter) => filter.key));
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState | null>(null);
  const [inlineGroupCreate, setInlineGroupCreate] = useState<InlineGroupCreateState | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [selectionAnchorKey, setSelectionAnchorKey] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [draggingObjectType, setDraggingObjectType] = useState<GroupablePanelObjectType | null>(null);
  const dragStateRef = useRef<ActiveDragState>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!currentNetwork) return;
    loadContexts(currentNetwork.id);
  }, [currentNetwork?.id, loadContexts]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      [...archetypeGroups, ...relationGroups].forEach((group) => next.add(group.id));
      return next;
    });
  }, [archetypeGroups, relationGroups]);

  useEffect(() => {
    const clearDragState = () => {
      dragStateRef.current = null;
      setDraggingObjectType(null);
      setDropTargetKey(null);
    };

    window.addEventListener('dragend', clearDragState);
    window.addEventListener('drop', clearDragState);

    return () => {
      window.removeEventListener('dragend', clearDragState);
      window.removeEventListener('drop', clearDragState);
    };
  }, []);

  const labelForType = (type: PanelObjectType): string => {
    const match = FILTERS.find((filter) => filter.key === type);
    return match ? t(match.labelKey as TranslationKey) : type;
  };

  const conceptRows = useMemo<PanelRow[]>(() => (
    [...concepts].sort((a, b) => a.title.localeCompare(b.title)).map((concept) => ({
      key: `object:concept:${concept.id}`,
      depth: 0,
      item: {
        id: concept.id,
        kind: 'object',
        objectType: 'concept',
        title: concept.title,
        subtitle: concept.archetype_id
          ? (archetypes.find((archetype) => archetype.id === concept.archetype_id)?.name ?? 'Concept')
          : 'Concept',
        color: concept.color,
      },
    }))
  ), [concepts, archetypes]);

  const networkRows = useMemo<PanelRow[]>(() => (
    [...networks].sort((a, b) => a.name.localeCompare(b.name)).map((network) => ({
      key: `object:network:${network.id}`,
      depth: 0,
      item: {
        id: network.id,
        kind: 'object',
        objectType: 'network',
        title: network.name,
        subtitle: network.scope === 'project' ? 'Project Network' : 'Network',
        isActive: currentNetwork?.id === network.id,
      },
    }))
  ), [networks, currentNetwork?.id]);

  const archetypeRows = useMemo(() => buildTreeRows(
    'archetype',
    archetypeGroups,
    archetypes,
    expandedGroups,
    t('archetype.title'),
    (archetype) => ({
      title: archetype.name,
      subtitle: getGroupName(archetypeGroups, archetype.group_id) ?? t('archetype.title'),
      color: archetype.color,
      iconName: archetype.icon,
    }),
  ), [archetypeGroups, archetypes, expandedGroups, t]);

  const relationTypeRows = useMemo(() => buildTreeRows(
    'relation_type',
    relationGroups,
    relationTypes,
    expandedGroups,
    t('relationType.title'),
    (relationType) => ({
      title: relationType.name,
      subtitle: getGroupName(relationGroups, relationType.group_id) ?? t('relationType.title'),
      color: relationType.color,
    }),
  ), [relationGroups, relationTypes, expandedGroups, t]);

  const contextRows = useMemo<PanelRow[]>(() => (
    [...contexts].sort((a, b) => a.name.localeCompare(b.name)).map((context) => ({
      key: `object:context:${context.id}`,
      depth: 0,
      item: {
        id: context.id,
        kind: 'object',
        objectType: 'context',
        title: context.name,
        subtitle: currentNetwork ? currentNetwork.name : t('context.title'),
        isActive: activeContextId === context.id,
      },
    }))
  ), [contexts, currentNetwork, activeContextId, t]);

  const sections = useMemo<PanelSection[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const rowsByType: Record<PanelObjectType, PanelRow[]> = {
      concept: conceptRows,
      network: networkRows,
      archetype: archetypeRows,
      relation_type: relationTypeRows,
      context: contextRows,
    };

    return selectedTypes.map((type) => ({
      objectType: type,
      label: labelForType(type),
      rows: rowsByType[type].filter((row) => {
        if (!normalizedSearch) return true;
        return row.item.title.toLowerCase().includes(normalizedSearch)
          || row.item.subtitle.toLowerCase().includes(normalizedSearch);
      }),
    })).filter((section) => section.rows.length > 0);
  }, [selectedTypes, search, conceptRows, networkRows, archetypeRows, relationTypeRows, contextRows]);

  const visibleRows = useMemo(() => sections.flatMap((section) => section.rows), [sections]);
  const rowByKey = useMemo(() => new Map(visibleRows.map((row) => [row.key, row])), [visibleRows]);
  const primaryType = selectedTypes.length === 1 ? selectedTypes[0] : null;
  const canCreateObject = primaryType !== null && !(primaryType === 'context' && !currentNetwork);
  const canCreateGroup = primaryType === 'archetype' || primaryType === 'relation_type';
  const canCreateObjectType = (objectType: PanelObjectType): boolean => (
    objectType !== 'context' || currentNetwork !== null
  );

  useEffect(() => {
    if (visibleRows.length === 0) {
      setSelectedKeys(new Set());
      setSelectionAnchorKey(null);
      setFocusedKey(null);
      return;
    }

    const visibleKeySet = new Set(visibleRows.map((row) => row.key));
    setSelectedKeys((prev) => new Set([...prev].filter((key) => visibleKeySet.has(key))));
    if (!focusedKey || !visibleKeySet.has(focusedKey)) {
      setFocusedKey(visibleRows[0].key);
    }
  }, [visibleRows, focusedKey]);

  useEffect(() => {
    if (selectedNetworkObjects.length === 0 && !networkObjectSelection) return;
    const keys = new Set(
      selectedNetworkObjects
        .map((item) => `object:${item.objectType}:${item.id}`)
        .filter((key) => rowByKey.has(key)),
    );
    const focusedSelection = networkObjectSelection
      ? `object:${networkObjectSelection.objectType}:${networkObjectSelection.id}`
      : null;
    if (keys.size === 0 && focusedSelection && rowByKey.has(focusedSelection)) {
      keys.add(focusedSelection);
    }
    if (keys.size === 0) return;
    setSelectedKeys(keys);
    if (focusedSelection && rowByKey.has(focusedSelection)) {
      setSelectionAnchorKey(focusedSelection);
      setFocusedKey(focusedSelection);
      return;
    }
    const firstKey = [...keys][0];
    setSelectionAnchorKey(firstKey);
    setFocusedKey(firstKey);
  }, [networkObjectSelection, rowByKey, selectedNetworkObjects]);

  useEffect(() => {
    const selectedRows = [...selectedKeys]
      .map((key) => rowByKey.get(key))
      .filter((row): row is PanelRow => row?.item.kind === 'object');
    const selectedItems = selectedRows.map((row) => ({
      objectType: row.item.objectType,
      id: row.item.id,
      title: row.item.title,
    }));
    const focusedRow = focusedKey ? rowByKey.get(focusedKey) : undefined;
    const focusedSelection = focusedRow?.item.kind === 'object'
      ? {
          objectType: focusedRow.item.objectType,
          id: focusedRow.item.id,
          title: focusedRow.item.title,
        }
      : selectedItems[0] ?? null;
    setNetworkObjectSelectionState({
      selection: focusedSelection,
      selectedItems,
    });
  }, [focusedKey, rowByKey, selectedKeys, setNetworkObjectSelectionState]);

  useEffect(() => {
    if (!focusedKey) return;
    rowRefs.current.get(focusedKey)?.scrollIntoView({ block: 'nearest' });
  }, [focusedKey]);

  const openItem = async (item: Extract<PanelItem, { kind: 'object' }>) => {
    switch (item.objectType) {
      case 'concept':
        await useEditorStore.getState().openTab({ type: 'concept', targetId: item.id, title: item.title });
        break;
      case 'network':
        await openNetwork(item.id);
        await useEditorStore.getState().openTab({ type: 'network', targetId: item.id, title: item.title });
        break;
      case 'archetype':
        await useEditorStore.getState().openTab({ type: 'archetype', targetId: item.id, title: item.title });
        break;
      case 'relation_type':
        await useEditorStore.getState().openTab({ type: 'relationType', targetId: item.id, title: item.title });
        break;
      case 'context':
        await useEditorStore.getState().openTab({ type: 'context', targetId: item.id, title: item.title });
        break;
    }
  };

  const handleCreateObject = async (objectType: PanelObjectType | null = primaryType) => {
    if (!currentProject || !objectType || !canCreateObjectType(objectType)) return;
    switch (objectType) {
      case 'concept': {
        const draftId = `draft-${Date.now()}`;
        await useEditorStore.getState().openTab({
          type: 'concept',
          targetId: draftId,
          title: t('concept.defaultTitle'),
          draftData: currentNetwork ? { networkId: currentNetwork.id } : undefined,
        });
        break;
      }
      case 'network': {
        const created = await createNetwork({
          project_id: currentProject.id,
          name: t('network.defaultName'),
          parent_network_id: currentNetwork?.id ?? undefined,
        });
        await loadNetworkTree(currentProject.id);
        await openNetwork(created.id);
        await useEditorStore.getState().openTab({ type: 'network', targetId: created.id, title: created.name });
        break;
      }
      case 'archetype': {
        const created = await createArchetype({ project_id: currentProject.id, name: tk('archetype.newDefault') });
        await useEditorStore.getState().openTab({ type: 'archetype', targetId: created.id, title: created.name });
        break;
      }
      case 'relation_type': {
        const created = await createRelationType({ project_id: currentProject.id, name: t('relationType.newDefault') });
        await useEditorStore.getState().openTab({ type: 'relationType', targetId: created.id, title: created.name });
        break;
      }
      case 'context': {
        if (!currentNetwork) return;
        const created = await createContext({ network_id: currentNetwork.id, name: t('context.newDefault') });
        await useEditorStore.getState().openTab({ type: 'context', targetId: created.id, title: created.name });
        break;
      }
    }
  };
  const handleDeleteItem = async (item: PanelItem) => {
    if (item.kind === 'group') {
      await deleteGroup(item.id);
      return;
    }
    switch (item.objectType) {
      case 'concept':
        await deleteConcept(item.id);
        break;
      case 'network':
        await deleteNetwork(item.id);
        if (currentProject) await loadNetworkTree(currentProject.id);
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
    }
  };

  const handleCreateGroup = (kind: GroupablePanelObjectType, parentGroupId: string | null = null) => {
    setInlineGroupCreate({ kind, parentGroupId, value: '' });
  };

  const submitInlineGroupCreate = async () => {
    if (!currentProject || !inlineGroupCreate || !inlineGroupCreate.value.trim()) return;
    const groups = inlineGroupCreate.kind === 'archetype' ? archetypeGroups : relationGroups;
    const siblingGroups = groups.filter((group) => (group.parent_group_id ?? null) === inlineGroupCreate.parentGroupId);
    await createGroup({
      project_id: currentProject.id,
      kind: inlineGroupCreate.kind,
      name: inlineGroupCreate.value.trim(),
      parent_group_id: inlineGroupCreate.parentGroupId ?? undefined,
      sort_order: siblingGroups.length,
    });
    if (inlineGroupCreate.parentGroupId) {
      setExpandedGroups((prev) => new Set(prev).add(inlineGroupCreate.parentGroupId as string));
    }
    setInlineGroupCreate(null);
  };

  const submitGroupDialog = async (name: string) => {
    if (!groupDialog) return;
    if (groupDialog.mode === 'create') {
      if (!currentProject) return;
      const groups = groupDialog.kind === 'archetype' ? archetypeGroups : relationGroups;
      const siblingGroups = groups.filter((group) => (group.parent_group_id ?? null) === groupDialog.parentGroupId);
      await createGroup({
        project_id: currentProject.id,
        kind: groupDialog.kind,
        name,
        parent_group_id: groupDialog.parentGroupId ?? undefined,
        sort_order: siblingGroups.length,
      });
      return;
    }
    await updateGroup(groupDialog.group.id, { name });
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const selectRow = (event: React.MouseEvent, row: PanelRow) => {
    if (row.item.kind === 'object') {
      setNetworkObjectSelection({
        objectType: row.item.objectType,
        id: row.item.id,
        title: row.item.title,
      });
    } else {
      setNetworkObjectSelection(null);
    }
    if (event.shiftKey) {
      setSelectedKeys(new Set(getSelectionRange(visibleRows, selectionAnchorKey ?? focusedKey, row.key)));
      setFocusedKey(row.key);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(row.key)) next.delete(row.key);
        else next.add(row.key);
        return next;
      });
      setFocusedKey(row.key);
      setSelectionAnchorKey(row.key);
      return;
    }
    setSelectedKeys(new Set([row.key]));
    setFocusedKey(row.key);
    setSelectionAnchorKey(row.key);
  };

  const focusRowByKey = useCallback((key: string, extend = false) => {
    const row = rowByKey.get(key);
    if (!row) return;
    if (row.item.kind === 'object') {
      setNetworkObjectSelection({
        objectType: row.item.objectType,
        id: row.item.id,
        title: row.item.title,
      });
    } else {
      setNetworkObjectSelection(null);
    }
    setFocusedKey(key);
    if (extend) {
      setSelectedKeys(new Set(getSelectionRange(visibleRows, selectionAnchorKey ?? focusedKey, key)));
      return;
    }
    setSelectedKeys(new Set([key]));
    setSelectionAnchorKey(key);
  }, [focusedKey, rowByKey, selectionAnchorKey, setNetworkObjectSelection, visibleRows]);

  const openRow = useCallback(async (row: PanelRow | undefined) => {
    if (!row) return;
    if (row.item.kind === 'group') {
      toggleGroup(row.item.id);
      return;
    }
    await openItem(row.item);
  }, [openItem]);

  const deleteRows = useCallback(async (rows: PanelRow[]) => {
    for (const row of rows) {
      await handleDeleteItem(row.item);
    }
    if (rows.some((row) => row.item.kind === 'object')) {
      setNetworkObjectSelection(null);
    }
  }, [handleDeleteItem, setNetworkObjectSelection]);

  const draggableSelectionForRow = (row: PanelRow): PanelRow[] => {
    if (!isGroupableType(row.item.objectType)) return [];
    const selectedRows = [...selectedKeys]
      .map((key) => rowByKey.get(key))
      .filter((value): value is PanelRow => value !== undefined)
      .filter((selectedRow) => selectedRow.item.objectType === row.item.objectType);
    const baseRows = selectedKeys.has(row.key) && selectedRows.length > 0 ? selectedRows : [row];
    return baseRows.filter((selectedRow) => selectedRow.item.kind === 'group' || selectedRow.item.kind === 'object');
  };

  const moveRowsToGroup = async (rows: PanelRow[], objectType: GroupablePanelObjectType, targetGroupId: string | null) => {
    if (objectType === 'archetype') {
      await Promise.all(rows.map(async (row) => {
        if (row.item.kind === 'object') {
          await updateArchetype(row.item.id, { group_id: targetGroupId });
          return;
        }
        if (row.item.id === targetGroupId) return;
        if (isDescendantGroup(row.item.id, targetGroupId, archetypeGroups)) return;
        await updateGroup(row.item.id, { parent_group_id: targetGroupId });
      }));
      return;
    }
    await Promise.all(rows.map(async (row) => {
      if (row.item.kind === 'object') {
        await updateRelationType(row.item.id, { group_id: targetGroupId });
        return;
      }
      if (row.item.id === targetGroupId) return;
      if (isDescendantGroup(row.item.id, targetGroupId, relationGroups)) return;
      await updateGroup(row.item.id, { parent_group_id: targetGroupId });
    }));
  };

  const parseDragPayload = (event: React.DragEvent): DragPayload | null => {
    if (dragStateRef.current) {
      return {
        keys: dragStateRef.current.rows.map((row) => row.key),
        objectType: dragStateRef.current.objectType,
      };
    }
    const rawPayload = event.dataTransfer.getData('application/netior-object-panel');
    if (!rawPayload) return null;
    try {
      return JSON.parse(rawPayload) as DragPayload;
    } catch {
      return null;
    }
  };

  const handleDragStart = (event: React.DragEvent, row: PanelRow) => {
    if (!isGroupableType(row.item.objectType)) return;
    const rows = draggableSelectionForRow(row);
    if (rows.length === 0) return;
    dragStateRef.current = {
      rows,
      objectType: row.item.objectType,
    };
    setDraggingObjectType(row.item.objectType);
    const payload = JSON.stringify({
      keys: rows.map((item) => item.key),
      objectType: row.item.objectType,
    } satisfies DragPayload);
    event.dataTransfer.setData('application/netior-object-panel', payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (event: React.DragEvent, row: PanelRow) => {
    if (row.item.kind !== 'group') return;
    const payload = parseDragPayload(event);
    if (!payload || payload.objectType !== row.item.objectType) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetKey(row.key);
  };

  const handleSectionDragOver = (event: React.DragEvent, objectType: PanelObjectType) => {
    if (!isGroupableType(objectType)) return;
    const payload = parseDragPayload(event);
    if (!payload || payload.objectType !== objectType) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetKey(`section:${objectType}`);
  };

  const handleDragLeave = (event: React.DragEvent, key: string) => {
    if (event.currentTarget !== event.target) return;
    setDropTargetKey((current) => (current === key ? null : current));
  };

  const handleRowDrop = async (event: React.DragEvent, row: PanelRow) => {
    if (row.item.kind !== 'group') return;
    const payload = parseDragPayload(event);
    if (!payload || payload.objectType !== row.item.objectType) return;
    event.preventDefault();
    event.stopPropagation();
    setDropTargetKey(null);
    const rows = payload.keys.map((key) => rowByKey.get(key)).filter((value): value is PanelRow => value !== undefined);
    await moveRowsToGroup(rows, row.item.objectType, row.item.id);
    dragStateRef.current = null;
    setDraggingObjectType(null);
  };

  const handleSectionDrop = async (event: React.DragEvent, objectType: PanelObjectType) => {
    if (!isGroupableType(objectType)) return;
    const payload = parseDragPayload(event);
    if (!payload || payload.objectType !== objectType) return;
    event.preventDefault();
    setDropTargetKey(null);
    const rows = payload.keys.map((key) => rowByKey.get(key)).filter((value): value is PanelRow => value !== undefined);
    await moveRowsToGroup(rows, objectType, null);
    dragStateRef.current = null;
    setDraggingObjectType(null);
  };

  const activeRow = contextMenu?.row;
  const activeSelection = activeRow && selectedKeys.has(activeRow.key)
    ? [...selectedKeys].map((key) => rowByKey.get(key)).filter((row): row is PanelRow => row !== undefined)
    : activeRow ? [activeRow] : [];

  const contextMenuItems: ContextMenuEntry[] = useMemo(() => {
    if (!contextMenu) return [];
    if (!activeRow) {
      const items: ContextMenuEntry[] = [];
      if (canCreateObject) {
        items.push({ label: t('common.create'), icon: <Plus size={14} />, onClick: () => { void handleCreateObject(); } });
      }
      if (canCreateGroup && primaryType) {
        items.push({
          label: tk('typeGroup.create'),
          icon: <FolderPlus size={14} />,
          onClick: () => handleCreateGroup(primaryType === 'archetype' ? 'archetype' : 'relation_type'),
        });
      }
      return items;
    }

    if (activeRow.item.kind === 'group') {
      const groupItem = activeRow.item;
      return [
        {
          label: activeRow.item.objectType === 'archetype' ? tk('archetype.createInGroup') : tk('relationType.createInGroup'),
          icon: <Plus size={14} />,
          onClick: async () => {
            if (!currentProject) return;
            if (activeRow.item.objectType === 'archetype') {
              const created = await createArchetype({ project_id: currentProject.id, group_id: activeRow.item.id, name: tk('archetype.newDefault') });
              await useEditorStore.getState().openTab({ type: 'archetype', targetId: created.id, title: created.name });
              return;
            }
            const created = await createRelationType({ project_id: currentProject.id, group_id: activeRow.item.id, name: t('relationType.newDefault') });
            await useEditorStore.getState().openTab({ type: 'relationType', targetId: created.id, title: created.name });
          },
        },
        { label: tk('typeGroup.createSubgroup'), icon: <FolderPlus size={14} />, onClick: () => handleCreateGroup(groupItem.objectType, groupItem.id) },
        {
          label: tk('typeGroup.rename'),
          icon: <FolderTree size={14} />,
          onClick: () => {
            const groups = groupItem.objectType === 'archetype' ? archetypeGroups : relationGroups;
            const group = groups.find((item) => item.id === groupItem.id);
            if (group) setGroupDialog({ mode: 'rename', group });
          },
        },
        { type: 'divider' as const },
        { label: t('common.delete'), icon: <Trash2 size={14} />, danger: true, onClick: () => { void handleDeleteItem(groupItem); } },
      ];
    }

    const objectItem = activeRow.item;

    return [
      {
        label: objectItem.objectType === 'network' ? t('common.open') : t('editor.openInEditor'),
        icon: <ExternalLink size={14} />,
        onClick: () => { void openItem(objectItem); },
      },
      ...(objectItem.objectType === 'context'
        ? [{
            label: objectItem.isActive ? tk('context.deactivate') : tk('context.activate'),
            icon: objectItem.isActive ? <EyeOff size={14} /> : <Eye size={14} />,
            onClick: () => setActiveContext(objectItem.isActive ? null : objectItem.id),
          } satisfies ContextMenuEntry]
        : []),
      { type: 'divider' as const },
      {
        label: activeSelection.length > 1 ? `${t('common.delete')} (${activeSelection.length})` : t('common.delete'),
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: async () => {
          await deleteRows(activeSelection);
        },
      },
    ];
  }, [
    contextMenu,
    activeRow,
    activeSelection,
    canCreateObject,
    canCreateGroup,
    primaryType,
    t,
    tk,
    currentProject,
    createArchetype,
    createRelationType,
    archetypeGroups,
    relationGroups,
    setActiveContext,
    deleteRows,
  ]);

  const renderLeadingVisual = (row: PanelRow) => {
    if (row.item.kind === 'group') {
      const expanded = expandedGroups.has(row.item.id);
      return (
        <>
          {expanded ? <ChevronDown size={12} className="shrink-0 text-secondary" /> : <ChevronRight size={12} className="shrink-0 text-secondary" />}
          <FolderTree size={14} className="shrink-0 text-secondary" />
        </>
      );
    }
    if (row.item.objectType === 'archetype' && row.item.iconName) {
      const Icon = getIconComponent(row.item.iconName);
      if (Icon) return <Icon size={14} className="shrink-0 text-secondary" />;
    }
    if (row.item.color) {
      return <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.item.color }} />;
    }
    switch (row.item.objectType) {
      case 'concept':
        return <CircleDot size={14} className="shrink-0 text-secondary" />;
      case 'network':
        return <Waypoints size={14} className="shrink-0 text-secondary" />;
      case 'archetype':
        return <Shapes size={14} className="shrink-0 text-secondary" />;
      case 'relation_type':
        return <Share2 size={14} className="shrink-0 text-secondary" />;
      case 'context':
        return <Layers3 size={14} className="shrink-0 text-secondary" />;
    }
  };

  return (
    <div
      ref={panelRef}
      className="flex h-full flex-col gap-2 p-2 outline-none"
      onMouseDown={() => panelRef.current?.focus()}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
        if (visibleRows.length === 0) return;

        const currentIndex = focusedKey ? visibleRows.findIndex((row) => row.key === focusedKey) : -1;
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const nextIndex = Math.min(visibleRows.length - 1, safeIndex + 1);
          focusRowByKey(visibleRows[nextIndex].key, event.shiftKey);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          const nextIndex = Math.max(0, safeIndex - 1);
          focusRowByKey(visibleRows[nextIndex].key, event.shiftKey);
          return;
        }

        if (event.key === 'ArrowRight') {
          const row = focusedKey ? rowByKey.get(focusedKey) : undefined;
          if (row?.item.kind === 'group' && !expandedGroups.has(row.item.id)) {
            event.preventDefault();
            toggleGroup(row.item.id);
          }
          return;
        }

        if (event.key === 'ArrowLeft') {
          const row = focusedKey ? rowByKey.get(focusedKey) : undefined;
          if (row?.item.kind === 'group' && expandedGroups.has(row.item.id)) {
            event.preventDefault();
            toggleGroup(row.item.id);
          }
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          void openRow(focusedKey ? rowByKey.get(focusedKey) : visibleRows[0]);
          return;
        }

        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedKeys.size > 0) {
          event.preventDefault();
          const rows = [...selectedKeys]
            .map((key) => rowByKey.get(key))
            .filter((row): row is PanelRow => row !== undefined);
          void deleteRows(rows);
          return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
          event.preventDefault();
          setSelectedKeys(new Set(visibleRows.map((row) => row.key)));
          const firstObjectRow = visibleRows.find((row) => row.item.kind === 'object');
          if (firstObjectRow) {
            setNetworkObjectSelection({
              objectType: firstObjectRow.item.objectType,
              id: firstObjectRow.item.id,
              title: firstObjectRow.item.title,
            });
            setFocusedKey(firstObjectRow.key);
            setSelectionAnchorKey(firstObjectRow.key);
          }
        }
      }}
      onContextMenu={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, row: null });
      }}
      tabIndex={0}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-xs font-medium text-secondary">{tk('sidebar.networkObjects')}</span>
        <ObjectTypeFilterSelect
          selectedTypes={selectedTypes}
          onChange={setSelectedTypes}
          labelFor={labelForType}
          allLabel={tk('objectPanel.allTypes')}
        />
      </div>

      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('sidebar.search')}
        className="w-full rounded border border-input bg-input px-2.5 py-1.5 text-xs text-default outline-none focus:border-accent"
      />

      {selectedTypes.length === 1 && selectedTypes[0] === 'context' && currentNetwork && (
        <div className="rounded border border-subtle bg-surface-card px-2.5 py-1.5 text-[11px] text-muted">
          {currentNetwork.name}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {sections.map((section) => {
          const sectionDropKey = `section:${section.objectType}`;
          const sectionCanCreateGroup = isGroupableType(section.objectType);
          return (
            <div
              key={section.objectType}
              className={`rounded border border-transparent ${
                dropTargetKey === sectionDropKey ? 'border-accent bg-accent-muted/50' : ''
              }`}
              onDragEnter={(event) => handleSectionDragOver(event, section.objectType)}
              onDragOverCapture={(event) => handleSectionDragOver(event, section.objectType)}
              onDragOver={(event) => handleSectionDragOver(event, section.objectType)}
              onDragLeave={(event) => handleDragLeave(event, sectionDropKey)}
              onDrop={(event) => { void handleSectionDrop(event, section.objectType); }}
            >
              <div className="flex items-center gap-1 px-2 py-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-secondary">
                  {section.label}
                </div>
                <div className="flex items-center gap-1">
                  {canCreateObjectType(section.objectType) && (
                    <button
                      type="button"
                      className="rounded p-1 text-muted transition-colors hover:bg-surface-hover hover:text-default"
                      onClick={() => { void handleCreateObject(section.objectType); }}
                      title={t('common.create')}
                    >
                      <Plus size={12} />
                    </button>
                  )}
                  {sectionCanCreateGroup && (
                    <button
                      type="button"
                      className="rounded p-1 text-muted transition-colors hover:bg-surface-hover hover:text-default"
                      onClick={() => handleCreateGroup(section.objectType === 'archetype' ? 'archetype' : 'relation_type')}
                      title={tk('typeGroup.create')}
                    >
                      <FolderPlus size={12} />
                    </button>
                  )}
                </div>
              </div>
              {inlineGroupCreate && inlineGroupCreate.kind === section.objectType && inlineGroupCreate.parentGroupId === null && (
                <InlineGroupInput
                  value={inlineGroupCreate.value}
                  onChange={(value) => setInlineGroupCreate((prev) => (prev ? { ...prev, value } : prev))}
                  onSubmit={() => { void submitInlineGroupCreate(); }}
                  onCancel={() => setInlineGroupCreate(null)}
                  placeholder={tk('typeGroup.namePlaceholder')}
                />
              )}
              <div className="flex flex-col gap-0.5">
                {section.rows.map((row) => {
                  const isSelected = selectedKeys.has(row.key);
                  const isFocused = focusedKey === row.key;
                  const isDropTarget = dropTargetKey === row.key;
                  const rowIsActive = row.item.kind === 'object' ? (row.item.isActive ?? false) : false;
                  const contextItem = row.item.kind === 'object' && row.item.objectType === 'context' ? row.item : null;
                  return (
                    <React.Fragment key={row.key}>
                      <div
                        ref={(element) => {
                          if (element) rowRefs.current.set(row.key, element);
                          else rowRefs.current.delete(row.key);
                        }}
                        className={`group flex items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                          isSelected
                            ? 'bg-interactive-selected text-accent'
                            : rowIsActive
                              ? 'bg-accent-muted/60 text-accent'
                              : 'hover:bg-surface-hover'
                        } ${isFocused && !isSelected ? 'ring-1 ring-border-default' : ''} ${
                          isDropTarget ? 'bg-accent-muted/70 ring-1 ring-accent' : ''
                        } ${isGroupableType(row.item.objectType) ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        style={{ paddingLeft: `${8 + row.depth * 16}px` }}
                        draggable={isGroupableType(row.item.objectType)}
                        onDragStart={(event) => handleDragStart(event, row)}
                        onDragEnd={() => setDropTargetKey(null)}
                        onDragEnter={(event) => handleRowDragOver(event, row)}
                        onDragOver={(event) => handleRowDragOver(event, row)}
                        onDragLeave={(event) => handleDragLeave(event, row.key)}
                        onDrop={(event) => { void handleRowDrop(event, row); }}
                        onClick={(event) => {
                          selectRow(event, row);
                          if (row.item.kind === 'group' && !(event.metaKey || event.ctrlKey || event.shiftKey)) {
                            toggleGroup(row.item.id);
                          }
                        }}
                        onDoubleClick={() => {
                          if (row.item.kind === 'group') {
                            toggleGroup(row.item.id);
                            return;
                          }
                          void openItem(row.item);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!selectedKeys.has(row.key)) {
                            setSelectedKeys(new Set([row.key]));
                            setSelectionAnchorKey(row.key);
                          }
                          if (row.item.kind === 'object') {
                            setNetworkObjectSelection({
                              objectType: row.item.objectType,
                              id: row.item.id,
                              title: row.item.title,
                            });
                          } else {
                            setNetworkObjectSelection(null);
                          }
                          setFocusedKey(row.key);
                          setContextMenu({ x: event.clientX, y: event.clientY, row });
                        }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {isGroupableType(row.item.objectType) && <GripVertical size={12} className="shrink-0 text-muted opacity-0 group-hover:opacity-100" />}
                          {renderLeadingVisual(row)}
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-sm ${rowIsActive || isSelected ? 'text-accent' : 'text-default'}`}>
                              {row.item.title}
                            </div>
                            <div className="truncate text-[11px] text-muted">{row.item.subtitle}</div>
                          </div>
                        </div>
                        {contextItem && (
                          <button
                            type="button"
                            className={`rounded p-1 transition-colors ${
                              contextItem.isActive
                                ? 'text-accent'
                                : 'text-muted opacity-0 group-hover:opacity-100 hover:text-default'
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveContext(contextItem.isActive ? null : contextItem.id);
                            }}
                            title={contextItem.isActive ? tk('context.deactivate') : tk('context.activate')}
                          >
                            {contextItem.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                        )}
                      </div>
                      {inlineGroupCreate
                        && row.item.kind === 'group'
                        && inlineGroupCreate.kind === row.item.objectType
                        && inlineGroupCreate.parentGroupId === row.item.id && (
                          <InlineGroupInput
                            value={inlineGroupCreate.value}
                            onChange={(value) => setInlineGroupCreate((prev) => (prev ? { ...prev, value } : prev))}
                            onSubmit={() => { void submitInlineGroupCreate(); }}
                            onCancel={() => setInlineGroupCreate(null)}
                            placeholder={tk('typeGroup.namePlaceholder')}
                            depth={row.depth + 1}
                          />
                        )}
                    </React.Fragment>
                  );
                })}
              </div>
              {sectionCanCreateGroup && draggingObjectType === section.objectType && (
                <div
                  className={`mx-2 mt-1 rounded border border-dashed px-2 py-1 text-[11px] transition-colors ${
                    dropTargetKey === sectionDropKey
                      ? 'border-accent bg-accent-muted text-accent'
                      : 'border-subtle text-muted'
                  }`}
                  onDragEnter={(event) => handleSectionDragOver(event, section.objectType)}
                  onDragOverCapture={(event) => handleSectionDragOver(event, section.objectType)}
                  onDragOver={(event) => handleSectionDragOver(event, section.objectType)}
                  onDragLeave={(event) => handleDragLeave(event, sectionDropKey)}
                  onDrop={(event) => { void handleSectionDrop(event, section.objectType); }}
                >
                  {tk('objectPanel.dropToRoot')}
                </div>
              )}
            </div>
          );
        })}

        {sections.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted">
            {tk('objectPanel.empty')}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

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
