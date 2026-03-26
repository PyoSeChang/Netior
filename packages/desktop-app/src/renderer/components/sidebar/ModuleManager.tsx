import React from 'react';
import { FolderOpen, Plus, X } from 'lucide-react';
import { useModuleStore } from '../../stores/module-store';
import { fsService } from '../../services';
import { Tooltip } from '../ui/Tooltip';
import { useI18n } from '../../hooks/useI18n';

export function ModuleManager(): JSX.Element | null {
  const { t } = useI18n();
  const { activeModuleId, directories, addDirectory, removeDirectory } = useModuleStore();

  if (!activeModuleId) return null;

  const handleAddDirectory = async () => {
    const dirPath = await fsService.openFolderDialog();
    if (!dirPath) return;
    await addDirectory({ module_id: activeModuleId, dir_path: dirPath });
  };

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await removeDirectory(id);
  };

  const folderName = (fullPath: string): string => {
    const segments = fullPath.replace(/\\/g, '/').split('/').filter(Boolean);
    return segments[segments.length - 1] || fullPath;
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-secondary">{t('sidebar.directories')}</span>
        <button
          className="rounded p-0.5 text-muted hover:bg-surface-hover hover:text-default"
          onClick={handleAddDirectory}
        >
          <Plus size={14} />
        </button>
      </div>

      {directories.map((dir) => (
        <Tooltip key={dir.id} content={dir.dir_path} position="right">
          <div className="group flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-secondary transition-colors hover:bg-surface-hover hover:text-default">
            <FolderOpen size={12} className="shrink-0" />
            <span className="flex-1 truncate">{folderName(dir.dir_path)}</span>
            <button
              className="shrink-0 rounded p-0.5 text-muted opacity-0 hover:text-status-error group-hover:opacity-100"
              onClick={(e) => handleRemove(e, dir.id)}
            >
              <X size={10} />
            </button>
          </div>
        </Tooltip>
      ))}

      {directories.length === 0 && (
        <div className="px-2 py-2 text-center text-xs text-muted">
          {t('sidebar.noDirectories')}
        </div>
      )}
    </div>
  );
}
