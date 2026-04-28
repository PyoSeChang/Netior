import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { useConceptStore } from '../../stores/concept-store';
import { useContextStore } from '../../stores/context-store';
import { useEditorStore } from '../../stores/editor-store';
import { useModelStore } from '../../stores/model-store';
import { useNetworkStore } from '../../stores/network-store';
import { useProjectStore } from '../../stores/project-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useSchemaStore } from '../../stores/schema-store';
import { useI18n } from '../../hooks/useI18n';
import {
  getSemanticModelDisplayDescription,
  getSemanticModelDisplayName,
} from '../../lib/semantic-model-i18n';
import {
  NetworkObjectBrowser,
  type NetworkBrowserItem,
} from './NetworkObjectBrowser';

interface OntologyEditorProps {
  tab: EditorTab;
}

function getNetworkKindLabel(kind: string): string {
  if (kind === 'ontology') return 'Ontology';
  if (kind === 'universe') return 'Universe';
  return 'Network';
}

export function OntologyEditor({ tab }: OntologyEditorProps): JSX.Element {
  const { t } = useI18n();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const openEditorTab = useEditorStore((s) => s.openTab);
  const currentProject = useProjectStore((s) => s.currentProject);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const networks = useNetworkStore((s) => s.networks);
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const loadNetworks = useNetworkStore((s) => s.loadNetworks);
  const loadNetworkTree = useNetworkStore((s) => s.loadNetworkTree);
  const concepts = useConceptStore((s) => s.concepts);
  const loadConcepts = useConceptStore((s) => s.loadByProject);
  const schemas = useSchemaStore((s) => s.schemas);
  const fields = useSchemaStore((s) => s.fields);
  const loadSchemas = useSchemaStore((s) => s.loadByProject);
  const loadFields = useSchemaStore((s) => s.loadFields);
  const models = useModelStore((s) => s.models);
  const loadModels = useModelStore((s) => s.loadByProject);
  const relationTypes = useRelationTypeStore((s) => s.relationTypes);
  const loadRelationTypes = useRelationTypeStore((s) => s.loadByProject);
  const contexts = useContextStore((s) => s.contexts);
  const loadContexts = useContextStore((s) => s.loadContexts);

  const projectId = tab.projectId
    ?? (tab.targetId === 'global' ? currentProject?.id : tab.targetId)
    ?? currentProject?.id
    ?? null;
  const project = projects.find((item) => item.id === projectId)
    ?? (currentProject?.id === projectId ? currentProject : null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!projectId) return;
    void loadNetworks(projectId);
    void loadNetworkTree(projectId);
    void loadConcepts(projectId);
    void loadSchemas(projectId);
    void loadModels(projectId);
    void loadRelationTypes(projectId);
  }, [
    loadConcepts,
    loadModels,
    loadNetworks,
    loadNetworkTree,
    loadRelationTypes,
    loadSchemas,
    projectId,
  ]);

  useEffect(() => {
    for (const schema of schemas) {
      if (!fields[schema.id]) {
        void loadFields(schema.id);
      }
    }
  }, [fields, loadFields, schemas]);

  const contextNetworkId = useMemo(() => {
    if (currentNetwork?.project_id === projectId) return currentNetwork.id;
    const projectNetworks = networks.filter((network) => network.project_id === projectId);
    return projectNetworks.find((network) => network.kind === 'ontology')?.id
      ?? projectNetworks[0]?.id
      ?? null;
  }, [currentNetwork?.id, currentNetwork?.project_id, networks, projectId]);

  useEffect(() => {
    if (!contextNetworkId) return;
    void loadContexts(contextNetworkId);
  }, [contextNetworkId, loadContexts]);

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
          .filter((item) => !projectId || item.project_id === projectId)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'network' as const,
            title: item.name,
            subtitle: getNetworkKindLabel(item.kind),
            isActive: item.id === currentNetwork?.id,
            networkKind: item.kind,
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
            subtitle: item.schema_id
              ? (schemas.find((schema) => schema.id === item.schema_id)?.name ?? 'Concept')
              : 'Concept',
          })),
      },
      {
        key: 'schema' as const,
        label: t('schema.title'),
        items: [...schemas]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            id: item.id,
            objectType: 'schema' as const,
            title: item.name,
            subtitle: item.description ?? t('schema.title'),
          })),
      },
      {
        key: 'model' as const,
        label: t('model.title' as never),
        items: [...models]
          .sort((a, b) => getSemanticModelDisplayName(a, t).localeCompare(getSemanticModelDisplayName(b, t)))
          .map((item) => ({
            id: item.id,
            objectType: 'model' as const,
            title: getSemanticModelDisplayName(item, t),
            subtitle: getSemanticModelDisplayDescription(item, t) ?? item.key,
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

    return sections.filter((section) => section.items.length > 0);
  }, [
    concepts,
    contexts,
    currentNetwork?.id,
    currentProject?.id,
    models,
    networks,
    projectId,
    projects,
    relationTypes,
    schemas,
    t,
  ]);

  const openItem = useCallback(async (item: NetworkBrowserItem) => {
    setSelectedKey(`${item.objectType}:${item.id}`);
    switch (item.objectType) {
      case 'network': {
        const network = networks.find((candidate) => candidate.id === item.id);
        await openEditorTab({
          type: 'network',
          targetId: item.id,
          title: item.title,
          projectId: network?.project_id ?? projectId ?? undefined,
        });
        break;
      }
      case 'project':
        await openEditorTab({ type: 'project', targetId: item.id, title: item.title });
        break;
      case 'concept':
        await openEditorTab({ type: 'concept', targetId: item.id, title: item.title });
        break;
      case 'schema':
        await openEditorTab({ type: 'schema', targetId: item.id, title: item.title });
        break;
      case 'model':
        await openEditorTab({ type: 'model', targetId: item.id, title: item.title, projectId: projectId ?? undefined });
        break;
      case 'relation_type':
        await openEditorTab({ type: 'relationType', targetId: item.id, title: item.title });
        break;
      case 'context':
        await openEditorTab({ type: 'context', targetId: item.id, title: item.title });
        break;
      default:
        break;
    }
  }, [networks, openEditorTab, projectId]);

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden bg-surface-editor text-default">
      <NetworkObjectBrowser
        title={project ? `${project.name} Ontology` : 'Ontology'}
        searchPlaceholder={t('sidebar.search')}
        sections={browserSections}
        selectedKey={selectedKey}
        onSelect={(item) => setSelectedKey(`${item.objectType}:${item.id}`)}
        onOpen={(item) => {
          void openItem(item);
        }}
      />
    </div>
  );
}
