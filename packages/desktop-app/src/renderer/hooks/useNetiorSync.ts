import { useEffect } from 'react';
import type { NetiorChangeEvent } from '@netior/shared/types';
import { useSchemaStore } from '../stores/schema-store';
import { useConceptStore } from '../stores/concept-store';
import { useRelationTypeStore } from '../stores/relation-type-store';
import { useModelStore } from '../stores/model-store';
import { useNetworkStore } from '../stores/network-store';
import { useContextStore } from '../stores/context-store';
import { useTypeGroupStore } from '../stores/type-group-store';

export function useNetiorSync(projectId: string | null): void {
  useEffect(() => {
    if (!projectId) return;

    const cleanup = window.electron.mocSync?.onChangeEvent((event: unknown) => {
      const change = event as NetiorChangeEvent;
      switch (change.type) {
        case 'schemas':
          useSchemaStore.getState().loadByProject(projectId);
          break;
        case 'concepts':
          useConceptStore.getState().loadByProject(projectId);
          break;
        case 'relationTypes':
          useRelationTypeStore.getState().loadByProject(projectId);
          break;
        case 'models':
          useModelStore.getState().loadByProject(projectId);
          break;
        case 'typeGroups':
          useTypeGroupStore.getState().loadByProject(projectId);
          break;
        case 'networks':
          useNetworkStore.getState().loadNetworks(projectId);
          useNetworkStore.getState().loadNetworkTree(projectId);
          {
            const currentNetwork = useNetworkStore.getState().currentNetwork;
            if (currentNetwork) {
              useNetworkStore.getState().openNetwork(currentNetwork.id);
            }
          }
          break;
        case 'contexts': {
          const currentNetwork = useNetworkStore.getState().currentNetwork;
          if (currentNetwork) {
            useContextStore.getState().loadContexts(currentNetwork.id);
          }
          break;
        }
        case 'edges':
        case 'layouts': {
          // Refresh the current network to get updated edges/layouts
          const currentNetwork = useNetworkStore.getState().currentNetwork;
          if (currentNetwork) {
            useNetworkStore.getState().openNetwork(currentNetwork.id);
          }
          break;
        }
      }
    });

    return cleanup;
  }, [projectId]);
}
