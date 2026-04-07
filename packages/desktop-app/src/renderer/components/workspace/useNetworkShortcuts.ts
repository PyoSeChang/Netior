import { useEffect } from 'react';
import type { RenderNode } from './types';
import { isEditableTarget, isPrimaryModifier, logShortcut } from '../../shortcuts/shortcut-utils';
import { useUIStore, type CanvasMode } from '../../stores/ui-store';

interface UseNetworkShortcutsOptions {
  selectedIds: Set<string>;
  renderNodes: RenderNode[];
  edgeLinkingActive: boolean;
  canvasMode: CanvasMode;
  onClearSelection: () => void;
  onDeleteSelection: () => void;
  onCancelLinking: () => void;
  onSelectAll: () => void;
  onFitToScreen: () => void;
}

export function useNetworkShortcuts({
  selectedIds,
  renderNodes,
  edgeLinkingActive,
  canvasMode,
  onClearSelection,
  onDeleteSelection,
  onCancelLinking,
  onSelectAll,
  onFitToScreen,
}: UseNetworkShortcutsOptions): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === 'Escape' && edgeLinkingActive) {
        logShortcut('shortcut.network.cancelLinking');
        onCancelLinking();
        return;
      }

      if (event.key === 'Delete' && selectedIds.size > 0) {
        event.preventDefault();
        logShortcut('shortcut.network.deleteSelection');
        onDeleteSelection();
        return;
      }

      if (isPrimaryModifier(event) && event.key.toLowerCase() === 'a' && renderNodes.length > 0) {
        event.preventDefault();
        logShortcut('shortcut.network.selectAllNodes');
        onSelectAll();
        return;
      }

      if (!isPrimaryModifier(event) && !event.altKey && !event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === 'e') {
          event.preventDefault();
          logShortcut('shortcut.network.toggleMode');
          useUIStore.getState().setCanvasMode(canvasMode === 'browse' ? 'edit' : 'browse');
          return;
        }
        if (key === 'f' && renderNodes.length > 0) {
          event.preventDefault();
          logShortcut('shortcut.network.fitToScreen');
          onFitToScreen();
          return;
        }
      }

      if (event.key === 'Escape' && selectedIds.size > 0) {
        onClearSelection();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    selectedIds,
    renderNodes,
    edgeLinkingActive,
    canvasMode,
    onClearSelection,
    onDeleteSelection,
    onCancelLinking,
    onSelectAll,
    onFitToScreen,
  ]);
}
