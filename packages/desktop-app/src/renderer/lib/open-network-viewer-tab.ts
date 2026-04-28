import { useEditorStore } from '../stores/editor-store';

interface OpenNetworkViewerTabOptions {
  networkId: string;
  title: string;
  projectId?: string | null;
  isDirty?: boolean;
}

export async function openNetworkViewerTab({
  networkId,
  title,
  projectId,
  isDirty,
}: OpenNetworkViewerTabOptions): Promise<void> {
  await useEditorStore.getState().openTab({
    type: 'networkViewer',
    targetId: networkId,
    title,
    projectId: projectId ?? undefined,
    isDirty,
  });
}
