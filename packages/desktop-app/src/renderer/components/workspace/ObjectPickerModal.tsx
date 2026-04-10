import React, { useEffect, useMemo, useState } from 'react';
import type { NetworkObjectType } from '@netior/shared/types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useConceptStore } from '../../stores/concept-store';
import { useNetworkStore } from '../../stores/network-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useContextStore } from '../../stores/context-store';
import { useProjectStore } from '../../stores/project-store';
import { useI18n } from '../../hooks/useI18n';

interface ObjectPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (objectType: NetworkObjectType, refId: string) => void;
}

type PickerTab = 'concept' | 'network' | 'project' | 'archetype' | 'relation_type' | 'context';

const TABS: PickerTab[] = ['concept', 'network', 'project', 'archetype', 'relation_type', 'context'];

export function ObjectPickerModal({ open, onClose, onSelect }: ObjectPickerModalProps): JSX.Element {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<PickerTab>('concept');
  const [search, setSearch] = useState('');

  const concepts = useConceptStore((s) => s.concepts);
  const networks = useNetworkStore((s) => s.networks);
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const projects = useProjectStore((s) => s.projects);
  const archetypes = useArchetypeStore((s) => s.archetypes);
  const relationTypes = useRelationTypeStore((s) => s.relationTypes);
  const contexts = useContextStore((s) => s.contexts);

  const tabLabels: Record<PickerTab, string> = {
    concept: t('concept.title'),
    network: t('sidebar.networks' as never),
    project: t('project.title' as never) ?? 'Projects',
    archetype: t('archetype.title'),
    relation_type: t('relationType.title'),
    context: t('context.title'),
  };

  useEffect(() => {
    if (!open) return;
    setSearch('');
  }, [open, activeTab]);

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (value: string) => value.toLowerCase().includes(query);

    switch (activeTab) {
      case 'concept':
        return concepts
          .filter((concept) => !query || matches(concept.title))
          .map((concept) => ({ id: concept.id, title: concept.title, subtitle: t('concept.archetype') }));
      case 'network':
        return networks
          .filter((network) => network.id !== currentNetwork?.id)
          .filter((network) => !query || matches(network.name))
          .map((network) => ({ id: network.id, title: network.name, subtitle: t('sidebar.networks' as never) }));
      case 'project':
        return projects
          .filter((project) => !query || matches(project.name))
          .map((project) => ({ id: project.id, title: project.name, subtitle: t('project.title' as never) ?? 'Project' }));
      case 'archetype':
        return archetypes
          .filter((archetype) => !query || matches(archetype.name))
          .map((archetype) => ({ id: archetype.id, title: archetype.name, subtitle: t('archetype.title') }));
      case 'relation_type':
        return relationTypes
          .filter((relationType) => !query || matches(relationType.name))
          .map((relationType) => ({ id: relationType.id, title: relationType.name, subtitle: t('relationType.title') }));
      case 'context':
        return contexts
          .filter((context) => !query || matches(context.name))
          .map((context) => ({ id: context.id, title: context.name, subtitle: t('context.title') }));
      default:
        return [];
    }
  }, [activeTab, archetypes, concepts, contexts, currentNetwork?.id, networks, projects, relationTypes, search, t]);

  const handleSelect = (refId: string) => {
    onSelect(activeTab, refId);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('common.add')} width="520px">
      <div className="flex min-h-[360px] flex-col gap-3">
        <div className="flex flex-wrap gap-1 border-b border-subtle pb-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded px-2 py-1 text-xs transition-colors ${
                activeTab === tab
                  ? 'bg-interactive-selected text-accent'
                  : 'text-secondary hover:bg-surface-hover hover:text-default'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <Input
          inputSize="sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('network.searchPlaceholder')}
          autoFocus
        />

        <div className="flex-1 overflow-auto rounded border border-subtle bg-surface-card">
          {items.length > 0 ? (
            <div className="flex flex-col py-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
                  onClick={() => handleSelect(item.id)}
                >
                  <span className="text-sm text-default">{item.title}</span>
                  <span className="text-[11px] text-muted">{item.subtitle}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center px-4 text-xs text-muted">
              {t('common.noResults')}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
