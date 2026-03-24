import React, { useEffect } from 'react';
import { Layout, FolderTree, Search } from 'lucide-react';
import type { Project } from '@moc/shared/types';
import { useCanvasStore } from '../../stores/canvas-store';
import { useFileStore } from '../../stores/file-store';
import { useUIStore } from '../../stores/ui-store';
import { CanvasList } from './CanvasList';
import { FileTree } from './FileTree';
import { ConceptSearch } from './ConceptSearch';
import { ScrollArea } from '../ui/ScrollArea';

interface SidebarProps {
  project: Project;
}

export function Sidebar({ project }: SidebarProps): JSX.Element {
  const { sidebarView, setSidebarView } = useUIStore();
  const { loadFileTree, fileTree } = useFileStore();
  const { loadCanvases } = useCanvasStore();

  useEffect(() => {
    loadCanvases(project.id);
    loadFileTree(project.root_dir);
  }, [project.id, project.root_dir, loadCanvases, loadFileTree]);

  const handleFileClick = (relativePath: string) => {
    useFileStore.getState().openFile(relativePath, project.root_dir);
    useUIStore.getState().setEditorDockOpen(true);
  };

  const tabs = [
    { key: 'canvases' as const, icon: Layout, label: 'Canvases' },
    { key: 'files' as const, icon: FolderTree, label: 'Files' },
    { key: 'search' as const, icon: Search, label: 'Search' },
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
          {sidebarView === 'files' && <FileTree nodes={fileTree} onFileClick={handleFileClick} />}
          {sidebarView === 'search' && <ConceptSearch />}
        </div>
      </ScrollArea>
    </div>
  );
}
