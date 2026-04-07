import React, { useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Project } from '@netior/shared/types';
import { useNetworkStore } from '../../stores/network-store';
import { useFileStore } from '../../stores/file-store';
import { useModuleStore } from '../../stores/module-store';
import { useEditorStore } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { NetworkList } from './NetworkList';
import { FileTree } from './FileTree';
import { ModuleSelector } from './ModuleSelector';
import { ArchetypeList } from './ArchetypeList';
import { RelationTypeList } from './RelationTypeList';
import { useConceptStore } from '../../stores/concept-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { Divider } from '../ui/Divider';
import { ScrollArea } from '../ui/ScrollArea';
import { Spinner } from '../ui/Spinner';
import { Tooltip } from '../ui/Tooltip';
import { fsService } from '../../services';
import { useI18n } from '../../hooks/useI18n';

interface SidebarProps {
  project: Project;
}

export function Sidebar({ project }: SidebarProps): JSX.Element {
  const { t } = useI18n();
  const { sidebarView, sidebarWidth } = useUIStore();
  const { loadFileTree, fileTree, refreshFileTree, loading: fileLoading } = useFileStore();
  const { loadNetworks, loadNetworkTree } = useNetworkStore();
  const { loadModules, directories } = useModuleStore();
  const { loadByProject: loadConcepts } = useConceptStore();
  const { loadByProject: loadArchetypes } = useArchetypeStore();
  const { loadByProject: loadRelationTypes } = useRelationTypeStore();

  useEffect(() => {
    loadNetworks(project.id);
    loadNetworkTree(project.id);
    loadModules(project.id);
    loadConcepts(project.id);
    loadArchetypes(project.id);
    loadRelationTypes(project.id);
  }, [project.id, loadNetworks, loadNetworkTree, loadModules, loadConcepts, loadArchetypes, loadRelationTypes]);

  useEffect(() => {
    if (directories.length > 0) {
      const dirs = directories.map((d) => d.dir_path);
      loadFileTree(dirs);
      fsService.watchDirs(dirs);
    }
    return () => { fsService.unwatchDirs(); };
  }, [directories, loadFileTree]);

  // Auto-refresh on filesystem changes
  useEffect(() => {
    const unsubscribe = fsService.onDirChanged(() => {
      refreshFileTree();
    });
    return unsubscribe;
  }, [refreshFileTree]);

  const handleRefresh = useCallback(() => {
    refreshFileTree();
  }, [refreshFileTree]);

  const handleFileClick = (absolutePath: string) => {
    const fileName = absolutePath.replace(/\\/g, '/').split('/').pop() ?? absolutePath;
    useEditorStore.getState().openTab({
      type: 'file',
      targetId: absolutePath,
      title: fileName,
    });
  };

  return (
    <div
      className="flex h-full shrink-0 flex-col bg-[var(--surface-sidebar-panel)]"
      style={{ width: sidebarWidth }}
    >
      <ScrollArea className="flex-1">
        <div className="flex min-h-full flex-col py-2">
          {sidebarView === 'canvases' && <NetworkList projectId={project.id} />}
          {sidebarView === 'files' && (
            <>
              <div className="flex items-center">
                <div className="flex-1">
                  <ModuleSelector
                    projectId={project.id}
                    onAddDirectory={async () => {
                      const { activeModuleId, addDirectory } = useModuleStore.getState();
                      if (!activeModuleId) return;
                      const { fsService } = await import('../../services');
                      const dirPath = await fsService.openFolderDialog();
                      if (dirPath) await addDirectory({ module_id: activeModuleId, dir_path: dirPath });
                    }}
                  />
                </div>
                <Tooltip content={t('fileTree.refresh')} position="bottom">
                  <button
                    className="mr-2 shrink-0 rounded p-1 text-muted hover:bg-surface-hover hover:text-default"
                    onClick={handleRefresh}
                  >
                    <RefreshCw size={14} />
                  </button>
                </Tooltip>
              </div>
              {fileLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="sm" />
                </div>
              ) : (
                <FileTree nodes={fileTree} onFileClick={handleFileClick} />
              )}
            </>
          )}
          {sidebarView === 'archetypes' && (
            <>
              <ArchetypeList />
              <Divider />
              <RelationTypeList />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
