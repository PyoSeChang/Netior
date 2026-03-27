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
import { ScrollArea } from '../ui/ScrollArea';

interface SidebarProps {
  project: Project;
}

export function Sidebar({ project }: SidebarProps): JSX.Element {
  const { sidebarView, sidebarWidth } = useUIStore();
  const { loadFileTree, fileTree } = useFileStore();
  const { loadCanvases } = useCanvasStore();
  const { loadModules, directories } = useModuleStore();

  useEffect(() => {
    loadCanvases(project.id);
    loadModules(project.id);
  }, [project.id, loadCanvases, loadModules]);

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
      <ScrollArea>
        <div className="py-2">
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
              <FileTree nodes={fileTree} onFileClick={handleFileClick} />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
