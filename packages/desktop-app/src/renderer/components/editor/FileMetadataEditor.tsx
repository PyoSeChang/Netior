import React, { useEffect, useState } from 'react';
import type { EditorTab, NetworkNode } from '@netior/shared/types';
import { fileService, networkService } from '../../services';
import { useNetworkStore } from '../../stores/network-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { ScrollArea } from '../ui/ScrollArea';
import { TextArea } from '../ui/TextArea';
import { Input } from '../ui/Input';
import { useI18n } from '../../hooks/useI18n';

interface FileMetadata {
  description?: string;
  content_type?: string;
  topics?: string[];
  pdf_toc?: unknown;
}

interface NodeMetadata {
  description?: string;
  relevant_pages?: number[];
}

interface FileMetadataState {
  fileMeta: FileMetadata;
  nodeMeta: NodeMetadata;
}

interface FileMetadataEditorProps {
  tab: EditorTab;
}

export function FileMetadataEditor({ tab }: FileMetadataEditorProps): JSX.Element {
  const { t } = useI18n();
  const fileId = tab.targetId;
  const networkId = tab.networkId;

  const [nodeId, setNodeId] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('file');

  // Find the network node for this file
  useEffect(() => {
    if (!networkId) return;
    networkService.getFull(networkId).then((full) => {
      if (!full) return;
      const node = full.nodes.find((n) => n.object?.object_type === 'file' && n.object.ref_id === fileId);
      if (node) setNodeId(node.id);
    });
  }, [networkId, fileId]);

  const session = useEditorSession<FileMetadataState>({
    tabId: tab.id,
    load: async () => {
      const file = await fileService.get(fileId);
      const fileMeta: FileMetadata = file?.metadata ? JSON.parse(file.metadata) : {};
      if (file) setFileType(file.type);

      let nodeMeta: NodeMetadata = {};
      if (networkId) {
        const full = await networkService.getFull(networkId);
        const node = full?.nodes.find((n) => n.object?.object_type === 'file' && n.object.ref_id === fileId);
        if (node?.metadata) nodeMeta = JSON.parse(node.metadata);
      }

      return { fileMeta, nodeMeta };
    },
    save: async (state) => {
      await fileService.update(fileId, {
        metadata: JSON.stringify(state.fileMeta),
      });
      if (nodeId) {
        await networkService.node.update(nodeId, {
          metadata: JSON.stringify(state.nodeMeta),
        });
      }
      // Refresh network to reflect changes
      const network = useNetworkStore.getState().currentNetwork;
      if (network) await useNetworkStore.getState().openNetwork(network.id);
    },
    deps: [fileId, networkId, nodeId],
  });

  if (session.isLoading) return <></>;

  const update = (patch: Partial<FileMetadataState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  const updateFileMeta = (patch: Partial<FileMetadata>) => {
    update({ fileMeta: { ...session.state.fileMeta, ...patch } });
  };

  const updateNodeMeta = (patch: Partial<NodeMetadata>) => {
    update({ nodeMeta: { ...session.state.nodeMeta, ...patch } });
  };

  const isDirectory = fileType === 'directory';

  return (
    <ScrollArea>
      <div className="flex h-full items-start justify-center">
        <div className="flex flex-col gap-6 p-6 w-full max-w-[600px]">
          {/* File-level metadata */}
          <section>
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
              {t('fileMetadata.fileProperties')}
            </h3>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">
                  {t('fileMetadata.description')}
                </label>
                <TextArea
                  value={session.state.fileMeta.description ?? ''}
                  onChange={(e) => updateFileMeta({ description: e.target.value || undefined })}
                  rows={3}
                  placeholder={t('fileMetadata.descriptionPlaceholder') ?? ''}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">
                  {t('fileMetadata.contentType')}
                </label>
                <Input
                  value={session.state.fileMeta.content_type ?? ''}
                  onChange={(e) => updateFileMeta({ content_type: e.target.value || undefined })}
                  placeholder="textbook, api-reference, config..."
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">
                  {t('fileMetadata.topics')}
                </label>
                <Input
                  value={(session.state.fileMeta.topics ?? []).join(', ')}
                  onChange={(e) => {
                    const topics = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    updateFileMeta({ topics: topics.length > 0 ? topics : undefined });
                  }}
                  placeholder="react, typescript, design-patterns..."
                />
              </div>

              {/* PDF TOC (read-only) */}
              {session.state.fileMeta.pdf_toc != null && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-secondary">PDF TOC</label>
                  <pre className="text-xs text-muted bg-surface-base rounded p-2 overflow-auto max-h-[200px]">
                    {String(JSON.stringify(session.state.fileMeta.pdf_toc, null, 2))}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* Node-level metadata (only if network context) */}
          {networkId && (
            <section>
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
                {t('fileMetadata.networkContext')}
              </h3>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-secondary">
                    {t('fileMetadata.nodeDescription')}
                  </label>
                  <TextArea
                    value={session.state.nodeMeta.description ?? ''}
                    onChange={(e) => updateNodeMeta({ description: e.target.value || undefined })}
                    rows={3}
                    placeholder={t('fileMetadata.nodeDescriptionPlaceholder') ?? ''}
                  />
                </div>

                {!isDirectory && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-secondary">
                      {t('fileMetadata.relevantPages')}
                    </label>
                    <Input
                      value={(session.state.nodeMeta.relevant_pages ?? []).join(', ')}
                      onChange={(e) => {
                        const pages = e.target.value
                          .split(',')
                          .map((s) => parseInt(s.trim(), 10))
                          .filter((n) => !isNaN(n));
                        updateNodeMeta({ relevant_pages: pages.length > 0 ? pages : undefined });
                      }}
                      placeholder="1, 3, 5..."
                    />
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
