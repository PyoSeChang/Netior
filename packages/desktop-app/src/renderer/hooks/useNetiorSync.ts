import { useEffect } from 'react';
import type { NetiorChangeEvent } from '@netior/shared/types';
import { useArchetypeStore } from '../stores/archetype-store';
import { useConceptStore } from '../stores/concept-store';
import { useRelationTypeStore } from '../stores/relation-type-store';
import { useCanvasTypeStore } from '../stores/canvas-type-store';
import { useCanvasStore } from '../stores/canvas-store';

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
        case 'canvasTypes':
          useCanvasTypeStore.getState().loadByProject(projectId);
          break;
        case 'canvases':
          useCanvasStore.getState().loadCanvases(projectId);
          break;
        case 'edges': {
          // Refresh the current canvas to get updated edges
          const currentCanvas = useCanvasStore.getState().currentCanvas;
          if (currentCanvas) {
            useCanvasStore.getState().openCanvas(currentCanvas.id);
          }
          break;
        }
      }
    });

    return cleanup;
  }, [projectId]);
}
