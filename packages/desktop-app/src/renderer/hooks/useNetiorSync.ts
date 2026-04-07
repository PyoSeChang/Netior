import { useEffect } from 'react';
import type { NetiorChangeEvent } from '@netior/shared/types';
import { useArchetypeStore } from '../stores/archetype-store';
import { useConceptStore } from '../stores/concept-store';
import { useRelationTypeStore } from '../stores/relation-type-store';
import { useNetworkStore } from '../stores/network-store';
import { useContextStore } from '../stores/context-store';

export function useNetiorSync(projectId: string | null): void {
  useEffect(() => {
    if (!projectId) return;

    const cleanup = window.electron.mocSync?.onChangeEvent((event: unknown) => {
      const change = event as NetiorChangeEvent;
      switch (change.type) {
        case 'archetypes':
          useArchetypeStore.getState().loadByProject(projectId);
          break;
        case 'concepts':
          useConceptStore.getState().loadByProject(projectId);
          break;
        case 'relationTypes':
          useRelationTypeStore.getState().loadByProject(projectId);
          break;
        case 'networks':
          useNetworkStore.getState().loadNetworks(projectId);
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
