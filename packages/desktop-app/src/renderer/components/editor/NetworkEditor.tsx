import React, { useCallback, useEffect, useMemo } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { ArrowLeft } from 'lucide-react';
import { useNetworkStore } from '../../stores/network-store';
import { useProjectStore } from '../../stores/project-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { layoutService, networkService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { openNetworkViewerTab } from '../../lib/open-network-viewer-tab';
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

interface NetworkEditorProps {
  tab: EditorTab;
}

interface NetworkState {
  name: string;
  layout_type: string;
  layout_config: Record<string, unknown>;
}

function parseLayoutConfig(configJson: string | null | undefined): Record<string, unknown> {
  if (!configJson) return {};
  try {
    const parsed = JSON.parse(configJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function getKindLabel(kind: string | undefined): string {
  if (kind === 'ontology') return 'Ontology';
  if (kind === 'universe') return 'Universe';
  return 'Network';
}

export function NetworkEditor({ tab }: NetworkEditorProps): JSX.Element {
  const { t } = useI18n();
  const networkId = tab.targetId;

  const {
    networks,
    updateNetwork,
    deleteNetwork,
    openNetwork,
    loading,
  } = useNetworkStore();
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const nodes = useNetworkStore((s) => s.nodes);
  const edges = useNetworkStore((s) => s.edges);
  const openEditorTab = useEditorStore((s) => s.openTab);
  const currentProject = useProjectStore((s) => s.currentProject);

  const network = networks.find((item) => item.id === networkId)
    ?? (currentNetwork?.id === networkId ? currentNetwork : null);

  useEffect(() => {
    void openNetwork(networkId);
  }, [networkId, openNetwork]);

  const session = useEditorSession<NetworkState>({
    tabId: tab.id,
    load: async () => {
      const full = await networkService.getFull(networkId);
      if (full) {
        return {
          name: full.network.name,
          layout_type: full.layout ? getLayout(full.layout.layout_type).key : 'freeform',
          layout_config: parseLayoutConfig(full.layout?.layout_config_json),
        };
      }

      const store = useNetworkStore.getState();
      const loadedNetwork = store.networks.find((item) => item.id === networkId)
        ?? (store.currentNetwork?.id === networkId ? store.currentNetwork : null);

      if (!loadedNetwork) {
        return { name: '', layout_type: 'freeform', layout_config: {} };
      }

      return {
        name: loadedNetwork.name,
        layout_type: 'freeform',
        layout_config: {},
      };
    },
    save: async (state) => {
      await updateNetwork(networkId, { name: state.name });
      const store = useNetworkStore.getState();
      const layout = store.currentNetwork?.id === networkId
        ? store.currentLayout
        : (await networkService.getFull(networkId))?.layout ?? null;
      if (layout) {
        await layoutService.update(layout.id, {
          layout_type: state.layout_type,
          layout_config_json: JSON.stringify(state.layout_config),
        });
      }
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [networkId],
  });

  const layoutOptions = useMemo(
    () => listLayouts().map((plugin) => ({ value: plugin.key, label: plugin.displayName })),
    [],
  );

  const activePlugin = useMemo(
    () => getLayout(session.state?.layout_type ?? 'freeform'),
    [session.state?.layout_type],
  );
  const layoutConfig = session.state?.layout_config ?? {};

  const getOptionLabel = useCallback((value: string, keyPrefix?: string) => {
    if (!keyPrefix) return value;
    const key = `${keyPrefix}.${value}`;
    const translated = t(key as never);
    return translated === key ? value : translated;
  }, [t]);

  const update = useCallback((patch: Partial<NetworkState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  }, [session]);

  const updateLayoutConfig = useCallback((patch: Record<string, unknown>) => {
    session.setState((prev) => ({
      ...prev,
      layout_config: { ...prev.layout_config, ...patch },
    }));
  }, [session]);

  const handleOpenOntology = useCallback(async () => {
    const projectId = network?.project_id ?? currentProject?.id ?? 'global';
    await openEditorTab({
      type: 'ontology',
      targetId: projectId,
      title: t('sidebar.ontology' as never) === 'sidebar.ontology'
        ? 'Ontology'
        : t('sidebar.ontology' as never),
      projectId: projectId === 'global' ? undefined : projectId,
    });
  }, [currentProject?.id, network?.project_id, openEditorTab, t]);

  const handleDelete = useCallback(async () => {
    await deleteNetwork(networkId);
    useEditorStore.getState().closeTab(tab.id);
  }, [deleteNetwork, networkId, tab.id]);

  if (!network && loading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-editor text-xs text-muted">
        Loading network...
      </div>
    );
  }

  if (!network) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-editor text-xs text-muted">
        {t('network.notFound') === 'network.notFound' ? 'Network not found' : t('network.notFound')}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  const title = session.state.name || network.name;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface-editor text-default">
      <div className="shrink-0 border-b border-subtle bg-surface-panel px-5 py-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void handleOpenOntology();
          }}
        >
          <ArrowLeft size={14} />
          {t('network.backToOverview') === 'network.backToOverview' ? 'All networks' : t('network.backToOverview')}
        </Button>
      </div>

      <div className="editor-scrollbar min-h-0 flex-1 overflow-y-scroll overflow-x-hidden">
        <NetworkObjectEditorShell
          badge={t('sidebar.networks')}
          title={title}
          subtitle={getKindLabel(network.kind)}
          description={t('network.layoutSettings') === 'network.layoutSettings' ? 'Layout settings' : t('network.layoutSettings')}
          actions={(
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void openNetworkViewerTab({
                    networkId,
                    title,
                    projectId: network.project_id ?? currentProject?.id ?? null,
                  });
                }}
              >
                {t('network.openViewer' as never) === 'network.openViewer' ? 'Open viewer' : t('network.openViewer' as never)}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!session.isDirty}
                onClick={() => {
                  void session.save();
                }}
              >
                {t('common.save')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-status-error hover:text-status-error"
                onClick={() => {
                  void handleDelete();
                }}
              >
                {t('common.delete')}
              </Button>
            </div>
          )}
        >
          <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">{t('network.name') === 'network.name' ? 'Name' : t('network.name')}</label>
              <Input
                value={session.state.name}
                onChange={(event) => update({ name: event.target.value })}
              />
            </div>
          </NetworkObjectEditorSection>

          <NetworkObjectEditorSection title={t('network.layout')}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">{t('network.layout') === 'network.layout' ? 'Layout' : t('network.layout')}</label>
              <Select
                options={layoutOptions}
                value={session.state.layout_type}
                onChange={(event) => {
                  const newLayout = event.target.value;
                  const plugin = getLayout(newLayout);
                  update({ layout_type: newLayout, layout_config: plugin.getDefaultConfig() });
                }}
                selectSize="sm"
              />
            </div>

            {activePlugin.key !== 'freeform' && (
              <div className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface-editor p-3">
                <div className="text-xs font-medium text-muted">
                  {t('network.layoutSettings') === 'network.layoutSettings' ? 'Layout settings' : t('network.layoutSettings')}
                </div>

                {activePlugin.configSchema.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1">
                    <label className="text-xs text-secondary">{t(field.label as never) === field.label ? field.label : t(field.label as never)}</label>
                    {field.type === 'number' ? (
                      <NumberInput
                        value={(layoutConfig[field.key] as number) ?? (field.default as number)}
                        onChange={(value) => updateLayoutConfig({ [field.key]: value })}
                        inputSize="sm"
                        min={0}
                      />
                    ) : field.type === 'enum' ? (
                      <Select
                        options={(field.options ?? []).map((option) => ({
                          value: option,
                          label: getOptionLabel(option, field.optionLabelKeyPrefix),
                        }))}
                        value={(layoutConfig[field.key] as string) ?? (field.default as string)}
                        onChange={(event) => updateLayoutConfig({ [field.key]: event.target.value })}
                        selectSize="sm"
                      />
                    ) : (
                      <Input
                        value={(layoutConfig[field.key] as string) ?? (field.default as string)}
                        onChange={(event) => updateLayoutConfig({ [field.key]: event.target.value })}
                        inputSize="sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </NetworkObjectEditorSection>

          <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
            <NetworkObjectMetadataList
              items={[
                { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{network.id}</code> },
                { label: t('network.layout'), value: activePlugin.displayName },
                { label: 'Nodes', value: `${currentNetwork?.id === networkId ? nodes.length : 0}` },
                { label: 'Edges', value: `${currentNetwork?.id === networkId ? edges.length : 0}` },
              ]}
            />
          </NetworkObjectEditorSection>
        </NetworkObjectEditorShell>
      </div>
    </div>
  );
}
