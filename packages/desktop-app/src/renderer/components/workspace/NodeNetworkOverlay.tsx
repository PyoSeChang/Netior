import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import type { Network } from '@netior/shared/types';
import { networkService } from '../../services';
import { useNetworkStore } from '../../stores/network-store';
import { useI18n } from '../../hooks/useI18n';

interface NodeNetworkOverlayProps {
  conceptId: string;
  /** Screen-space position of the node */
  x: number;
  y: number;
  onClose: () => void;
}

export function NodeNetworkOverlay({ conceptId, x, y, onClose }: NodeNetworkOverlayProps): JSX.Element | null {
  const { t } = useI18n();
  const [networks, setNetworks] = useState<Network[]>([]);
  const { openNetwork, currentNetwork } = useNetworkStore();

  useEffect(() => {
    networkService.getNetworksByConcept(conceptId).then(setNetworks);
  }, [conceptId]);

  if (networks.length === 0) return null;

  const handleClick = async (networkId: string) => {
    if (currentNetwork) {
      useNetworkStore.setState((s) => ({
        networkHistory: [...s.networkHistory, currentNetwork.id],
      }));
    }
    await openNetwork(networkId);
    onClose();
  };

  return (
    <div
      className="fixed z-40 bg-surface-panel border border-default rounded-md shadow-lg py-1 min-w-[140px]"
      style={{ left: x, top: y - 8, transform: 'translateY(-100%)' }}
      onMouseLeave={onClose}
    >
      <div className="px-2 py-1 text-[10px] text-muted uppercase tracking-wider flex items-center gap-1">
        <Layers size={10} />
        {t('network.networksForConcept') ?? 'Networks'}
      </div>
      {networks.map((c) => (
        <button
          key={c.id}
          type="button"
          className="w-full text-left px-3 py-1 text-xs text-default hover:bg-surface-hover transition-colors"
          onClick={() => handleClick(c.id)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
