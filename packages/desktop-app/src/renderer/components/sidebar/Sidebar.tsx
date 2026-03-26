import React, { useEffect } from 'react';
import { Layout, FolderTree, Search } from 'lucide-react';
import type { Project } from '@moc/shared/types';
import { useCanvasStore } from '../../stores/canvas-store';
import { useFileStore } from '../../stores/file-store';
import { useModuleStore } from '../../stores/module-store';
import { useEditorStore } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { useI18n } from '../../hooks/useI18n';
// Note: EditorDock is replaced by the generic editor system (editor-store + EditorContent)
import { CanvasList } from './CanvasList';
import { FileTree } from './FileTree';
import { ConceptSearch } from './ConceptSearch';
import { ModuleSelector } from './ModuleSelector';
import { ModuleManager } from './ModuleManager';
import { ScrollArea } from '../ui/ScrollArea';

interface SidebarProps {
  project: Project;
}

export function Sidebar({ project }: SidebarProps): JSX.Element {
  const { t } = useI18n();
  const { sidebarView, setSidebarView } = useUIStore();
  const { loadFileTree, fileTree } = useFileStore();
  const { loadCanvases } = useCanvasStore();
  const { loadModules, directories } = useModuleStore();

  useEffect(() => {
    loadCanvases(project.id);
    loadModules(project.id);
  }, [project.id, loadCanvases, loadModules]);

  // Reload file trees when active module's directories change
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

  const tabs = [
    { key: 'canvases' as const, icon: Layout, label: t('sidebar.canvases') },
    { key: 'files' as const, icon: FolderTree, label: t('sidebar.files') },
    { key: 'search' as const, icon: Search, label: t('sidebar.search') },
  ];

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-subtle bg-surface-panel">
      {/* Tab bar */}
      <div className="flex border-b border-subtle">
        {tabs.map(({ key, icon: Icon }) => (
          <button
            key={key}
            className={`flex-1 py-2 text-center transition-colors ${
              sidebarView === key
                ? 'border-b-2 border-accent text-accent'
                : 'text-muted hover:text-default'
            }`}
            onClick={() => setSidebarView(key)}
          >
            <Icon size={14} className="mx-auto" />
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea>
        <div className="py-2">
          {sidebarView === 'canvases' && <CanvasList projectId={project.id} />}
          {sidebarView === 'files' && (
            <>
              <ModuleSelector projectId={project.id} />
              <ModuleManager />
              <div className="my-1 border-t border-subtle" />
              <FileTree nodes={fileTree} onFileClick={handleFileClick} />
            </>
          )}
          {sidebarView === 'search' && <ConceptSearch />}
        </div>
      </ScrollArea>
    </div>
  );
}
