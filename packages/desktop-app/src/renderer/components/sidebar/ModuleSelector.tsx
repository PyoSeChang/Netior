import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Package, Plus, Trash2, ChevronDown, Pencil, FolderOpen } from 'lucide-react';
import { useModuleStore } from '../../stores/module-store';
import { useI18n } from '../../hooks/useI18n';
import { fsService } from '../../services';
import { Tooltip } from '../ui/Tooltip';

interface ModuleSelectorProps {
  projectId: string;
  projectRootDir: string;
}

export function ModuleSelector({ projectId, projectRootDir }: ModuleSelectorProps): JSX.Element {
  const { t } = useI18n();
  const { modules, activeModuleId, setActiveModule, createModule, deleteModule, updateModule } =
    useModuleStore();

  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activeModule = modules.find((m) => m.id === activeModuleId);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
        setRenamingId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleSelect = useCallback(
    async (moduleId: string) => {
      await setActiveModule(moduleId);
      setOpen(false);
    },
    [setActiveModule],
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const mod = await createModule({ project_id: projectId, name: newName.trim(), path: projectRootDir });
    await setActiveModule(mod.id);
    setNewName('');
    setCreating(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteModule(id);
  };

  const handleDoubleClick = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await updateModule(renamingId, { name: renameValue.trim() });
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const startRename = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const changePath = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const nextPath = await fsService.openFolderDialog();
    if (!nextPath) return;
    await updateModule(id, { path: nextPath });
  };

  return (
    <div ref={dropdownRef} className="relative flex items-center gap-0.5 px-2 py-1.5">
      {/* Module selector */}
      <button
        className="flex flex-1 items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-default transition-colors hover:bg-surface-hover"
        onClick={() => setOpen((v) => !v)}
      >
        <Package size={12} className="shrink-0 text-secondary" />
        <span className="flex-1 truncate text-left">
          {activeModule ? activeModule.name : t('sidebar.noModule')}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {/* Dropdown — uses fixed positioning to avoid parent overflow clipping */}
      {open && (
        <div
          className="fixed z-50 rounded-md border border-subtle bg-surface-card shadow-lg"
          style={{
            top: (dropdownRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
            left: dropdownRef.current?.getBoundingClientRect().left ?? 0,
            width: dropdownRef.current?.getBoundingClientRect().width ?? 200,
          }}
        >
          {/* Module list */}
          <div className="max-h-48 overflow-y-auto py-1">
            {modules.map((m) => (
              <div
                key={m.id}
                className={`group cursor-pointer px-2 py-1 text-xs transition-colors ${
                  m.id === activeModuleId
                    ? 'bg-interactive-selected text-accent'
                    : 'text-secondary hover:bg-surface-hover hover:text-default'
                }`}
                onClick={() => handleSelect(m.id)}
                onDoubleClick={(e) => handleDoubleClick(e, m.id, m.name)}
              >
                {renamingId === m.id ? (
                  <input
                    ref={renameInputRef}
                    className="w-full rounded border border-subtle bg-input px-1 py-0.5 text-xs text-default outline-none focus:border-accent"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') {
                        setRenamingId(null);
                        setRenameValue('');
                      }
                    }}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 truncate">{m.name}</div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip content={t('sidebar.editModuleName' as never)} position="top">
                          <button
                            className="rounded p-0.5 text-muted hover:text-default"
                            onClick={(e) => startRename(e, m.id, m.name)}
                          >
                            <Pencil size={10} />
                          </button>
                        </Tooltip>
                        <Tooltip content={t('sidebar.editModulePath' as never)} position="top">
                          <button
                            className="rounded p-0.5 text-muted hover:text-default"
                            onClick={(e) => changePath(e, m.id)}
                          >
                            <FolderOpen size={10} />
                          </button>
                        </Tooltip>
                        <Tooltip content={t('sidebar.deleteModule' as never)} position="top">
                          <button
                            className="rounded p-0.5 text-muted hover:text-status-error"
                            onClick={(e) => handleDelete(e, m.id)}
                          >
                            <Trash2 size={10} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {m.path || t('sidebar.selectModulePath')}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {modules.length === 0 && !creating && (
              <div className="px-2 py-2 text-center text-xs text-muted">{t('sidebar.noModules')}</div>
            )}
          </div>

          {/* Create inline */}
          {creating ? (
            <div className="border-t border-subtle px-2 py-1.5">
              <input
                className="w-full rounded border border-subtle bg-input px-2 py-1 text-xs text-default outline-none focus:border-accent"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') {
                    setCreating(false);
                    setNewName('');
                  }
                }}
                placeholder={t('sidebar.moduleName')}
                autoFocus
              />
            </div>
          ) : (
            <button
              className="flex w-full items-center gap-1.5 border-t border-subtle px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-default"
              onClick={() => setCreating(true)}
            >
              <Plus size={12} />
              <span>{t('sidebar.addModule')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
