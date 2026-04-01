import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import type { FileTreeNode } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import { FileIcon } from './FileIcon';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { useFileStore } from '../../stores/file-store';
import { useI18n } from '../../hooks/useI18n';
import { showToast } from '../ui/Toast';
import { fsService } from '../../services';

interface FileTreeProps {
  nodes: FileTreeNode[];
  onFileClick: (absolutePath: string) => void;
  onAddDirectory?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: FileTreeNode | null;
}

interface InlineInputState {
  parentPath: string;
  type: 'file' | 'directory';
}

// ─── Inline Input Components ───────────────────────────────────────

function InlineRenameInput({
  initialValue,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      const dotIdx = initialValue.lastIndexOf('.');
      inputRef.current.setSelectionRange(0, dotIdx > 0 ? dotIdx : initialValue.length);
    }
  }, [initialValue]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      className="min-w-0 flex-1 rounded border border-accent bg-surface-base px-1 text-xs text-default outline-none"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') onCancel();
        e.stopPropagation();
      }}
      onBlur={handleSubmit}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function InlineNewInput({
  type,
  depth,
  placeholder,
  onSubmit,
  onCancel,
}: {
  type: 'file' | 'directory';
  depth: number;
  placeholder?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <div
      className="flex items-center gap-1 rounded px-1 py-0.5 text-xs"
      style={{ paddingLeft: depth * 12 + (type === 'file' ? 20 : 4) }}
    >
      {type === 'directory' && <span className="w-3" />}
      <FileIcon
        name={value || (type === 'file' ? 'untitled' : 'folder')}
        isFolder={type === 'directory'}
        size={16}
      />
      <input
        ref={inputRef}
        className="min-w-0 flex-1 rounded border border-accent bg-surface-base px-1 text-xs text-default outline-none"
        value={value}
        placeholder={placeholder ?? (type === 'file' ? 'filename' : 'folder name')}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
          e.stopPropagation();
        }}
        onBlur={handleSubmit}
      />
    </div>
  );
}

// ─── Tree Item ─────────────────────────────────────────────────────

function FileTreeItem({
  node,
  depth,
  onFileClick,
  onContextMenu,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  newInput,
  newInputPlaceholder,
  onNewSubmit,
  onNewCancel,
}: {
  node: FileTreeNode;
  depth: number;
  onFileClick: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  renamingPath: string | null;
  onRenameSubmit: (oldPath: string, newName: string) => void;
  onRenameCancel: () => void;
  newInput: InlineInputState | null;
  newInputPlaceholder?: string;
  onNewSubmit: (parentPath: string, name: string, type: 'file' | 'directory') => void;
  onNewCancel: () => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(depth < 1);
  const isRenaming = renamingPath === node.path;
  const showNewInput = newInput && newInput.parentPath === node.path;
  const { loadChildren, loadingPaths } = useFileStore();
  const isLoadingChildren = loadingPaths.has(node.path);
  const needsLazyLoad = node.type === 'directory' && !node.children && node.hasChildren;

  // Auto-expand when creating new item inside this folder
  useEffect(() => {
    if (showNewInput && !expanded) {
      setExpanded(true);
    }
  }, [showNewInput]);

  const handleToggle = useCallback(() => {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && needsLazyLoad) {
      loadChildren(node.path);
    }
  }, [expanded, needsLazyLoad, loadChildren, node.path]);

  if (node.type === 'directory') {
    return (
      <>
        <div
          className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs text-default hover:bg-surface-hover"
          style={{ paddingLeft: depth * 12 + 4 }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/netior-node', JSON.stringify({ type: 'dir', path: node.path }));
            e.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={handleToggle}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          {isLoadingChildren ? (
            <Loader2 size={12} className="shrink-0 animate-spin text-secondary" />
          ) : expanded ? (
            <ChevronDown size={12} className="shrink-0 text-secondary" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-secondary" />
          )}
          <FileIcon name={node.name} isFolder isOpen={expanded} size={16} />
          {isRenaming ? (
            <InlineRenameInput
              initialValue={node.name}
              onSubmit={(newName) => onRenameSubmit(node.path, newName)}
              onCancel={onRenameCancel}
            />
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </div>
        {expanded && (
          <>
            {showNewInput && (
              <InlineNewInput
                type={newInput.type}
                depth={depth + 1}
                placeholder={newInputPlaceholder}
                onSubmit={(name) => onNewSubmit(newInput.parentPath, name, newInput.type)}
                onCancel={onNewCancel}
              />
            )}
            {node.children?.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileClick={onFileClick}
                onContextMenu={onContextMenu}
                renamingPath={renamingPath}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                newInput={newInput}
                newInputPlaceholder={newInputPlaceholder}
                onNewSubmit={onNewSubmit}
                onNewCancel={onNewCancel}
              />
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <div
      className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs text-secondary hover:bg-surface-hover hover:text-default"
      style={{ paddingLeft: depth * 12 + 20 }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/netior-node', JSON.stringify({ type: 'file', path: node.path }));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onFileClick(node.path)}
      onContextMenu={(e) => onContextMenu(e, node)}
    >
      <FileIcon name={node.name} size={16} />
      {isRenaming ? (
        <InlineRenameInput
          initialValue={node.name}
          onSubmit={(newName) => onRenameSubmit(node.path, newName)}
          onCancel={onRenameCancel}
        />
      ) : (
        <span className="truncate">{node.name}</span>
      )}
    </div>
  );
}

// ─── FileTree Root ─────────────────────────────────────────────────

export function FileTree({ nodes, onFileClick }: FileTreeProps): JSX.Element {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [newInput, setNewInput] = useState<InlineInputState | null>(null);
  const { clipboard, setClipboard, clearClipboard, refreshFileTree, rootDirs } = useFileStore();
  const { t } = useI18n();

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleBgContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node: null });
  }, []);

  const handleRenameSubmit = useCallback(async (oldPath: string, newName: string) => {
    const normalized = oldPath.replace(/\\/g, '/');
    const parentDir = normalized.split('/').slice(0, -1).join('/');
    const newPath = parentDir + '/' + newName;
    try {
      await fsService.renameItem(oldPath, newPath);
      await refreshFileTree();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Already exists')) {
        showToast('error', t('fileTree.alreadyExists' as TranslationKey, { name: newName }));
      } else {
        showToast('error', t('fileTree.renameFailed' as TranslationKey));
      }
    }
    setRenamingPath(null);
  }, [refreshFileTree, t]);

  const handleNewSubmit = useCallback(async (parentPath: string, name: string, type: 'file' | 'directory') => {
    const fullPath = parentPath.replace(/\\/g, '/') + '/' + name;
    try {
      if (type === 'file') {
        await fsService.createFile(fullPath);
      } else {
        await fsService.createDir(fullPath);
      }
      await refreshFileTree();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists') || msg.includes('Already exists')) {
        showToast('error', t('fileTree.alreadyExists' as TranslationKey, { name }));
      } else {
        showToast('error', t('fileTree.createFailed' as TranslationKey));
      }
    }
    setNewInput(null);
  }, [refreshFileTree, t]);

  const handleDelete = useCallback(async (path: string) => {
    try {
      await fsService.deleteItem(path);
      await refreshFileTree();
    } catch (err) {
      showToast('error', t('fileTree.deleteFailed' as TranslationKey));
    }
  }, [refreshFileTree, t]);

  const handlePaste = useCallback(async (destDir: string) => {
    if (!clipboard) return;
    const srcName = clipboard.path.replace(/\\/g, '/').split('/').pop()!;
    const destPath = destDir.replace(/\\/g, '/') + '/' + srcName;

    try {
      if (clipboard.action === 'copy') {
        await fsService.copyItem(clipboard.path, destPath);
      } else {
        await fsService.moveItem(clipboard.path, destPath);
        clearClipboard();
      }
      await refreshFileTree();
    } catch (err) {
      showToast('error', t('fileTree.pasteFailed' as TranslationKey));
    }
  }, [clipboard, clearClipboard, refreshFileTree, t]);

  /** Resolve parent directory for a node (for file nodes, use their parent dir) */
  const getParentDir = useCallback((node: FileTreeNode): string => {
    if (node.type === 'directory') return node.path;
    return node.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
  }, []);

  const buildMenuItems = useCallback((): ContextMenuEntry[] => {
    const node = contextMenu?.node;

    // Background context menu (empty space)
    if (!node) {
      const targetDir = rootDirs[0]?.replace(/\\/g, '/');
      if (!targetDir) return [];

      const items: ContextMenuEntry[] = [];
      items.push({
        label: t('fileTree.newFile' as TranslationKey),
        onClick: () => setNewInput({ parentPath: targetDir, type: 'file' }),
      });
      items.push({
        label: t('fileTree.newFolder' as TranslationKey),
        onClick: () => setNewInput({ parentPath: targetDir, type: 'directory' }),
      });
      if (clipboard) {
        items.push({ type: 'divider' });
        items.push({
          label: t('fileTree.paste' as TranslationKey),
          shortcut: 'Ctrl+V',
          onClick: () => handlePaste(targetDir),
        });
      }
      items.push({ type: 'divider' });
      items.push({
        label: t('fileTree.revealInExplorer' as TranslationKey),
        onClick: () => fsService.showInExplorer(targetDir),
      });
      return items;
    }

    const items: ContextMenuEntry[] = [];

    if (node.type === 'file') {
      items.push({
        label: t('fileTree.open' as TranslationKey),
        onClick: () => onFileClick(node.path),
      });
      items.push({ type: 'divider' });
    }

    // New File / New Folder — for directories use self, for files use parent
    const parentDir = getParentDir(node);
    items.push({
      label: t('fileTree.newFile' as TranslationKey),
      onClick: () => setNewInput({ parentPath: node.type === 'directory' ? node.path : parentDir, type: 'file' }),
    });
    items.push({
      label: t('fileTree.newFolder' as TranslationKey),
      onClick: () => setNewInput({ parentPath: node.type === 'directory' ? node.path : parentDir, type: 'directory' }),
    });
    items.push({ type: 'divider' });

    items.push({
      label: t('fileTree.copy' as TranslationKey),
      shortcut: 'Ctrl+C',
      onClick: () => setClipboard(node.path, 'copy'),
    });
    items.push({
      label: t('fileTree.cut' as TranslationKey),
      shortcut: 'Ctrl+X',
      onClick: () => setClipboard(node.path, 'cut'),
    });

    if (node.type === 'directory') {
      items.push({
        label: t('fileTree.paste' as TranslationKey),
        shortcut: 'Ctrl+V',
        disabled: !clipboard,
        onClick: () => handlePaste(node.path),
      });
    }

    items.push({ type: 'divider' });

    items.push({
      label: t('fileTree.rename' as TranslationKey),
      shortcut: 'F2',
      onClick: () => setRenamingPath(node.path),
    });

    items.push({
      label: t('fileTree.delete' as TranslationKey),
      danger: true,
      onClick: () => handleDelete(node.path),
    });

    items.push({ type: 'divider' });

    items.push({
      label: t('fileTree.revealInExplorer' as TranslationKey),
      onClick: () => fsService.showInExplorer(node.path),
    });

    return items;
  }, [contextMenu, clipboard, rootDirs, onFileClick, setClipboard, handlePaste, handleDelete, getParentDir, t]);

  const newInputPlaceholder = newInput?.type === 'file'
    ? t('fileTree.filenamePlaceholder' as TranslationKey)
    : t('fileTree.folderNamePlaceholder' as TranslationKey);

  /** Check if newInput targets a root dir (not handled by any FileTreeItem) */
  const isRootNewInput = newInput != null &&
    rootDirs.some((d) => d.replace(/\\/g, '/') === newInput.parentPath);

  return (
    <div className="flex flex-1 flex-col gap-0.5 px-1" onContextMenu={handleBgContextMenu}>
      {/* Root-level new input (for background context menu on root dir) */}
      {isRootNewInput && newInput && (
        <InlineNewInput
          type={newInput.type}
          depth={0}
          placeholder={newInputPlaceholder}
          onSubmit={(name) => handleNewSubmit(newInput.parentPath, name, newInput.type)}
          onCancel={() => setNewInput(null)}
        />
      )}
      {nodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={0}
          onFileClick={onFileClick}
          onContextMenu={handleContextMenu}
          renamingPath={renamingPath}
          onRenameSubmit={handleRenameSubmit}
          onRenameCancel={() => setRenamingPath(null)}
          newInput={newInput}
          newInputPlaceholder={newInputPlaceholder}
          onNewSubmit={handleNewSubmit}
          onNewCancel={() => setNewInput(null)}
        />
      ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
