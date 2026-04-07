import React, { useCallback, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  onClose: () => void;
}

export function EdgeContextMenu({ x, y, edgeId, onClose }: EdgeContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const { removeEdge } = useNetworkStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = useCallback(async () => {
    const tabId = `edge:${edgeId}`;
    const tab = useEditorStore.getState().tabs.find((t) => t.id === tabId);
    if (tab) useEditorStore.getState().closeTab(tabId);

    await removeEdge(edgeId);
    onClose();
  }, [edgeId, removeEdge, onClose]);

  return (
    <div
      className="fixed z-50 bg-surface-modal border border-default rounded-md shadow-lg py-1 min-w-[180px]"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-red-400 hover:bg-surface-hover cursor-pointer"
        onClick={handleDelete}
      >
        <Trash2 size={14} />
        {t('edge.delete')}
      </button>
    </div>
  );
}
