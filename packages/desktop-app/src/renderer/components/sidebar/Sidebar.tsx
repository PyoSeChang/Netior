import React, { useEffect } from 'react';
import type { Project } from '@moc/shared/types';
import { useCanvasStore } from '../../stores/canvas-store';
import { useFileStore } from '../../stores/file-store';
import { useModuleStore } from '../../stores/module-store';
import { useEditorStore } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { CanvasList } from './CanvasList';
import { FileTree } from './FileTree';
import { ModuleSelector } from './ModuleSelector';
import { ArchetypeList } from './ArchetypeList';
import { RelationTypeList } from './RelationTypeList';
import { CanvasTypeList } from './CanvasTypeList';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useCanvasTypeStore } from '../../stores/canvas-type-store';
import { Divider } from '../ui/Divider';
import { ScrollArea } from '../ui/ScrollArea';
import { Spinner } from '../ui/Spinner';

interface SidebarProps {
  project: Project;
}

export function Sidebar({ project }: SidebarProps): JSX.Element {
  const { sidebarView, sidebarWidth } = useUIStore();
  const { loadFileTree, fileTree, loading: fileLoading } = useFileStore();
  const { loadCanvases, loadCanvasTree } = useCanvasStore();
  const { loadModules, directories } = useModuleStore();
  const { loadByProject: loadArchetypes } = useArchetypeStore();
  const { loadByProject: loadRelationTypes } = useRelationTypeStore();
  const { loadByProject: loadCanvasTypes } = useCanvasTypeStore();

  useEffect(() => {
    loadCanvases(project.id);
    loadCanvasTree(project.id);
    loadModules(project.id);
    loadArchetypes(project.id);
    loadRelationTypes(project.id);
    loadCanvasTypes(project.id);
  }, [project.id, loadCanvases, loadCanvasTree, loadModules, loadArchetypes, loadRelationTypes, loadCanvasTypes]);

  useEffect(() => {
    if (directories.length > 0) {
      loadFileTree(directories.map((d) => d.dir_path));
    }
  }, [directories, loadFileTree]);

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
      className="flex h-full shrink-0 flex-col bg-surface-panel"
      style={{ width: sidebarWidth }}
    >
      <ScrollArea className="flex-1">
        <div className="flex min-h-full flex-col py-2">
          {sidebarView === 'canvases' && <CanvasList projectId={project.id} />}
          {sidebarView === 'files' && (
            <>
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
              <Divider />
              <CanvasTypeList />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
