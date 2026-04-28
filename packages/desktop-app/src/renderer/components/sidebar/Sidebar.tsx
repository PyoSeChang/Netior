import React, { useEffect, useCallback, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type { Project } from '@netior/shared/types';
import { useNetworkStore } from '../../stores/network-store';
import { useFileStore } from '../../stores/file-store';
import { useModuleStore } from '../../stores/module-store';
import { useUIStore } from '../../stores/ui-store';
import { useProjectStore } from '../../stores/project-store';
import { NetworkList } from './NetworkList';
import { FileTree } from './FileTree';
import { ModuleSelector } from './ModuleSelector';
import { ObjectPanel } from './ObjectPanel';
import { BookmarkedNetworkSidebar } from './BookmarkedNetworkSidebar';
import { useConceptStore } from '../../stores/concept-store';
import { useSchemaStore } from '../../stores/schema-store';
import { useModelStore } from '../../stores/model-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useTypeGroupStore } from '../../stores/type-group-store';
import { ScrollArea } from '../ui/ScrollArea';
import { Spinner } from '../ui/Spinner';
import { Tooltip } from '../ui/Tooltip';
import { fsService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { openFileTab } from '../../lib/open-file-tab';
import { ProjectCreateDialog } from '../home/ProjectCreateDialog';
import { AgentSessionPanel } from './AgentSessionPanel';

interface SidebarProps {
  project: Project | null;
}

const OBJECT_PANEL_TYPES = {
  concepts: ['concept'],
  schemas: ['schema'],
  models: ['model'],
  relationTypes: ['relation_type'],
  contexts: ['context'],
} as const;

function AppWorkspaceSidebar(): JSX.Element {
  const { t } = useI18n();
  const currentNetwork = useNetworkStore((s) => s.currentNetwork);
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const openProject = useProjectStore((s) => s.openProject);
  const currentProject = useProjectStore((s) => s.currentProject);
  const createModule = useModuleStore((s) => s.createModule);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const handleCreateProject = async (name: string, rootDir: string) => {
    const project = await createProject(name, rootDir);
    await createModule({ project_id: project.id, name, path: rootDir });
    await openProject(project);
  };

  const handleOpenProject = async (project: Project) => {
    await openProject(project);
  };

  return (
    <div className="flex min-h-full flex-col gap-4 py-2">
      <div className="px-2">
        <div className="mb-2 text-xs font-medium text-secondary">{t('sidebar.networks' as never)}</div>
        <button
          className={`flex w-full items-center rounded px-2 py-1 text-left text-xs transition-colors ${
            currentNetwork?.kind === 'universe'
              ? 'bg-state-selected text-accent'
              : 'text-default hover:bg-state-hover'
          }`}
          onClick={() => {
            if (currentNetwork?.kind === 'universe') return;
            const loadUniverseWorkspace = useNetworkStore.getState().loadUniverseWorkspace;
            loadUniverseWorkspace().then((universe) => {
              if (universe) {
                void useNetworkStore.getState().openNetwork(universe.id);
              }
            });
          }}
        >
          Universe
        </button>
      </div>

      <div className="px-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-secondary">{t('project.title' as never) ?? 'Projects'}</div>
          <button
            type="button"
            className="rounded p-1 text-muted transition-colors hover:bg-state-hover hover:text-default"
            onClick={() => setShowCreateProject(true)}
            title={t('project.create')}
          >
            <Plus size={12} />
          </button>
        </div>
        {projects.length > 0 ? (
          <div className="flex flex-col gap-1">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`flex w-full items-center rounded px-2 py-1 text-left text-xs transition-colors ${
                  currentProject?.id === project.id
                    ? 'bg-state-selected text-accent'
                    : 'text-default hover:bg-state-hover'
                }`}
                onClick={() => {
                  void handleOpenProject(project);
                }}
              >
                <span className="truncate">{project.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded border border-subtle bg-surface-card px-2 py-3 text-xs text-muted">
            {t('project.noProjectsYet')}
          </div>
        )}
      </div>

      <ProjectCreateDialog
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}

export function Sidebar({ project }: SidebarProps): JSX.Element {
  const { t } = useI18n();
  const { sidebarView, sidebarWidth, bookmarkedSidebarNetworkId } = useUIStore();
  const { loadFileTree, fileTree, refreshFileTree, loading: fileLoading } = useFileStore();
  const { loadNetworks, loadNetworkTree } = useNetworkStore();
  const { loadModules, directories } = useModuleStore();
  const { loadByProject: loadConcepts } = useConceptStore();
  const { loadByProject: loadSchemas } = useSchemaStore();
  const { loadByProject: loadModels } = useModelStore();
  const { loadByProject: loadRelationTypes } = useRelationTypeStore();
  const { loadByProject: loadTypeGroups } = useTypeGroupStore();

  useEffect(() => {
    if (!project) return;
    loadNetworks(project.id);
    loadNetworkTree(project.id);
    loadModules(project.id);
    loadConcepts(project.id);
    loadSchemas(project.id);
    loadModels(project.id);
    loadRelationTypes(project.id);
    loadTypeGroups(project.id);
  }, [project?.id, loadNetworks, loadNetworkTree, loadModules, loadConcepts, loadSchemas, loadModels, loadRelationTypes, loadTypeGroups]);

  useEffect(() => {
    if (!project) return undefined;
    if (directories.length > 0) {
      const dirs = directories.map((d) => d.dir_path);
      loadFileTree(dirs);
      fsService.watchDirs(dirs);
    }
    return () => { fsService.unwatchDirs(); };
  }, [directories, loadFileTree, project]);

  // Auto-refresh on filesystem changes
  useEffect(() => {
    if (!project) return undefined;
    const unsubscribe = fsService.onDirChanged(() => {
      refreshFileTree();
    });
    return unsubscribe;
  }, [refreshFileTree, project]);

  const handleRefresh = useCallback(() => {
    refreshFileTree();
  }, [refreshFileTree]);

  const handleFileClick = (absolutePath: string) => {
    void openFileTab({ filePath: absolutePath });
  };

  return (
    <div
      className="sidebar-surface flex h-full shrink-0 flex-col"
      style={{ width: sidebarWidth }}
    >
      {!project || sidebarView === 'projects' ? (
        <ScrollArea className="flex-1">
          <AppWorkspaceSidebar />
        </ScrollArea>
      ) : sidebarView === 'bookmarkedNetwork' && bookmarkedSidebarNetworkId ? (
        <BookmarkedNetworkSidebar networkId={bookmarkedSidebarNetworkId} />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex min-h-full flex-col py-2">
            {sidebarView === 'ontology' && (
              <NetworkList
                projectId={project.id}
                kindFilter="ontology"
                title={t('sidebar.ontology' as never)}
                canCreate={false}
              />
            )}
            {sidebarView === 'networks' && <NetworkList projectId={project.id} kindFilter="network" />}
            {sidebarView === 'files' && (
              <>
                <div className="flex items-center">
                  <div className="flex-1">
                    <ModuleSelector projectId={project.id} projectRootDir={project.root_dir} />
                  </div>
                  <Tooltip content={t('fileTree.refresh')} position="bottom">
                    <button
                      className="mr-2 shrink-0 rounded p-1 text-muted hover:bg-state-hover hover:text-default"
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
            {sidebarView === 'concepts' && <ObjectPanel types={[...OBJECT_PANEL_TYPES.concepts]} />}
            {sidebarView === 'schemas' && <ObjectPanel types={[...OBJECT_PANEL_TYPES.schemas]} />}
            {sidebarView === 'models' && <ObjectPanel types={[...OBJECT_PANEL_TYPES.models]} />}
            {sidebarView === 'relationTypes' && <ObjectPanel types={[...OBJECT_PANEL_TYPES.relationTypes]} />}
            {sidebarView === 'contexts' && <ObjectPanel types={[...OBJECT_PANEL_TYPES.contexts]} />}
            {sidebarView === 'objects' && <ObjectPanel />}
            {sidebarView === 'sessions' && <AgentSessionPanel projectId={project.id} />}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
