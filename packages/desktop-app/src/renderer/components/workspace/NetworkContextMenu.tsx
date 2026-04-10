import React, { useEffect, useState } from 'react';
import { Plus, Shapes, ArrowRightLeft, File } from 'lucide-react';
import type { Network } from '@netior/shared/types';
import { useNetworkStore } from '../../stores/network-store';
import { useI18n } from '../../hooks/useI18n';

interface NetworkContextMenuProps {
  x: number;
  y: number;
  onCreateConcept?: () => void;
  onAddObject?: () => void;
  onAddFileNode?: () => void;
  onClose: () => void;
}

export function NetworkContextMenu({
  x,
  y,
  onCreateConcept,
  onAddObject,
  onAddFileNode,
  onClose,
}: NetworkContextMenuProps): JSX.Element {
  const { t } = useI18n();
  const { currentNetwork, networks, openNetwork } = useNetworkStore();
  const [siblingNetworks, setSiblingNetworks] = useState<Network[]>([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Load sibling networks (same parent_network_id)
  useEffect(() => {
    if (!currentNetwork) return;
    setSiblingNetworks(
      networks.filter((c) => c.id !== currentNetwork.id && c.parent_network_id === currentNetwork.parent_network_id)
    );
  }, [currentNetwork, networks]);

  const handleSwitch = async (networkId: string) => {
    await openNetwork(networkId);
    onClose();
  };

  return (
    <div
      className="fixed z-50 rounded-md border border-default bg-surface-modal py-1 shadow-lg min-w-[180px]"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {onCreateConcept && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={() => {
            onCreateConcept();
            onClose();
          }}
        >
          <Plus size={14} />
          {t('network.createConcept')}
        </button>
      )}

      {onAddObject && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={() => {
            onAddObject();
            onClose();
          }}
        >
          <Shapes size={14} />
          {t('common.add')}
        </button>
      )}

      {onAddFileNode && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
          onClick={() => {
            onAddFileNode();
            onClose();
          }}
        >
          <File size={14} />
          {t('network.addFileNode')}
        </button>
      )}

      {siblingNetworks.length > 0 && (
        <>
          <div className="my-1 border-t border-subtle" />
          <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
            <ArrowRightLeft size={10} />
            {t('network.switchNetwork') ?? 'Switch Network'}
          </div>
          {siblingNetworks.map((c) => (
            <button
              key={c.id}
              className="flex w-full items-center gap-2 px-3 py-1 text-xs text-default hover:bg-surface-hover cursor-pointer"
              onClick={() => handleSwitch(c.id)}
            >
              {c.name}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
