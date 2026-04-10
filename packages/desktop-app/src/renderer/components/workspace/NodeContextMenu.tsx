import React, { useCallback, useEffect } from 'react';
import { ExternalLink, FileText, Link, Plus, Trash2 } from 'lucide-react';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import type { NetworkObjectType } from '@netior/shared/types';
import type { CanvasMode } from '../../stores/ui-store';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  objectType?: NetworkObjectType;
  objectTargetId?: string;
  objectTitle?: string;
  conceptId?: string;
  fileId?: string;
  filePath?: string;
  networkId?: string;
  mode: CanvasMode;
  onAddConnection?: (nodeId: string) => void;
  onOpenNetwork?: (networkId: string) => void;
  onCreateNetwork?: (conceptId: string) => void;
  onAttachNetwork?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  nodeId,
  objectType,
  objectTargetId,
  objectTitle,
  conceptId,
  fileId,
  filePath,
  networkId,
  mode,
  onAddConnection,
  onOpenNetwork,
  onCreateNetwork,
  onAttachNetwork,
  onDeleteNode,
  onClose,
}: NodeContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const { currentNetwork } = useNetworkStore();

  const openObjectEditor = useCallback(() => {
    if (!objectType || !objectTargetId) return;

    if (objectType === 'network') {
      useEditorStore.getState().openTab({
        type: 'network',
        targetId: objectTargetId,
        title: objectTitle ?? t('network.name'),
      });
    } else if (objectType === 'concept') {
      useEditorStore.getState().openTab({
        type: 'concept',
        targetId: objectTargetId,
        title: objectTitle ?? t('concept.title'),
        networkId: currentNetwork?.id,
        nodeId,
      });
    } else if (objectType === 'archetype') {
      useEditorStore.getState().openTab({
        type: 'archetype',
        targetId: objectTargetId,
        title: objectTitle ?? t('archetype.title'),
      });
    } else if (objectType === 'relation_type') {
      useEditorStore.getState().openTab({
        type: 'relationType',
        targetId: objectTargetId,
        title: objectTitle ?? t('relationType.title'),
      });
    } else if (objectType === 'context') {
      useEditorStore.getState().openTab({
        type: 'context',
        targetId: objectTargetId,
        title: objectTitle ?? t('context.title'),
      });
    } else if (objectType === 'file' && filePath) {
      useEditorStore.getState().openTab({
        type: 'file',
        targetId: filePath,
        title: objectTitle ?? filePath.replace(/\\/g, '/').split('/').pop() ?? 'File',
      });
    }
    onClose();
  }, [filePath, objectTargetId, objectTitle, objectType, onClose, t]);

  const canOpenEditor =
    !!objectType &&
    !!objectTargetId &&
    ['network', 'concept', 'archetype', 'relation_type', 'context', 'file'].includes(objectType);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOpenNetwork = useCallback(() => {
    if (networkId) onOpenNetwork?.(networkId);
    onClose();
  }, [onOpenNetwork, networkId, onClose]);

  const handleCreateNetwork = useCallback(() => {
    if (conceptId) onCreateNetwork?.(conceptId);
    onClose();
  }, [onCreateNetwork, conceptId, onClose]);

  const handleAttachNetwork = useCallback(() => {
    onAttachNetwork?.(nodeId);
    onClose();
  }, [nodeId, onAttachNetwork, onClose]);

  const handleAddConnection = useCallback(() => {
    onAddConnection?.(nodeId);
    onClose();
  }, [onAddConnection, nodeId, onClose]);

  const handleDelete = useCallback(async () => {
    onDeleteNode?.(nodeId);
    onClose();
  }, [nodeId, onClose, onDeleteNode]);

  return (
    <div
      className="fixed z-50 bg-surface-modal border border-default rounded-md shadow-lg py-1 min-w-[180px]"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Portal: open network */}
      {networkId && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={handleOpenNetwork}
        >
          <ExternalLink size={14} />
          {t('network.openSubNetwork')}
        </button>
      )}

      {canOpenEditor && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={openObjectEditor}
        >
          <ExternalLink size={14} />
          {t('editor.openInEditor')}
        </button>
      )}

      {/* Network creation */}
      {conceptId && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={handleCreateNetwork}
        >
          <Plus size={14} />
          {t('network.createNetwork')}
        </button>
      )}

      {conceptId && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={handleAttachNetwork}
        >
          <Link size={14} />
          {t('network.connectNetwork') ?? 'Connect Network'}
        </button>
      )}

      {/* Edit metadata (file/dir nodes only) */}
      {fileId && currentNetwork && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-default hover:bg-surface-hover cursor-pointer"
          onClick={() => {
            useEditorStore.getState().openTab({
              type: 'fileMetadata',
              targetId: fileId,
              title: filePath?.replace(/\\/g, '/').split('/').pop() ?? 'Metadata',
              networkId: currentNetwork.id,
            });
            onClose();
          }}
        >
          <FileText size={14} />
          {t('fileMetadata.editMetadata')}
        </button>
      )}

      {/* Edge connection (edit mode only) */}
      {mode === 'edit' && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={handleAddConnection}
        >
          <Link size={14} />
          {t('edge.addConnection')}
        </button>
      )}

      {/* Delete */}
      <button
        className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
        onClick={handleDelete}
      >
        <Trash2 size={14} />
        {t('common.delete')}
      </button>
    </div>
  );
}
