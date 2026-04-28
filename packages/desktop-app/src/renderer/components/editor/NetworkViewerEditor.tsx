import React from 'react';
import type { EditorTab } from '@netior/shared/types';
import { useEditorStore } from '../../stores/editor-store';
import { useNetworkStore } from '../../stores/network-store';
import { NetworkWorkspace } from '../workspace/NetworkWorkspace';

interface NetworkViewerEditorProps {
  tab: EditorTab;
}

export function NetworkViewerEditor({ tab }: NetworkViewerEditorProps): JSX.Element {
  const openTab = useEditorStore((s) => s.openTab);
  const networks = useNetworkStore((s) => s.networks);
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const network = networks.find((item) => item.id === tab.targetId)
    ?? (currentNetwork?.id === tab.targetId ? currentNetwork : null);
  const projectId = tab.projectId ?? network?.project_id ?? null;

  return (
    <div className="relative h-full min-h-0 min-w-0 overflow-hidden bg-surface-panel">
      <NetworkWorkspace
        projectId={projectId}
        initialNetworkId={tab.targetId}
        showOpenViewerAction={false}
        onOpenLayoutSettings={() => {
          void openTab({
            type: 'network',
            targetId: tab.targetId,
            title: network?.name ?? tab.title,
            projectId: projectId ?? undefined,
          });
        }}
      />
    </div>
  );
}
