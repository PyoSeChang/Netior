import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { FileTreeNode } from '@moc/shared/types';
import { FileIcon } from './FileIcon';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { useFileStore } from '../../stores/file-store';
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
  onSubmit,
  onCancel,
}: {
  type: 'file' | 'directory';
  depth: number;
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
        placeholder={type === 'file' ? 'filename' : 'folder name'}
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
  onNewSubmit: (parentPath: string, name: string, type: 'file' | 'directory') => void;
  onNewCancel: () => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(depth < 1);
  const isRenaming = renamingPath === node.path;
  const showNewInput = newInput && newInput.parentPath === node.path;

  // Auto-expand when creating new item inside this folder
  useEffect(() => {
    if (showNewInput && !expanded) {
      setExpanded(true);
    }
  }, [showNewInput]);

  if (node.type === 'directory') {
    return (
      <>
        <div
          className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs text-default hover:bg-surface-hover"
          style={{ paddingLeft: depth * 12 + 4 }}
          onClick={() => setExpanded(!expanded)}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          {expanded ? (
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
  const { clipboard, setClipboard, clearClipboard, refreshFileTree } = useFileStore();

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
      console.error('Rename failed:', err);
    }
    setRenamingPath(null);
  }, [refreshFileTree]);

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
      console.error(`Create ${type} failed:`, err);
    }
    setNewInput(null);
  }, [refreshFileTree]);

  const handleDelete = useCallback(async (path: string) => {
    try {
      await fsService.deleteItem(path);
      await refreshFileTree();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [refreshFileTree]);

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
      console.error('Paste failed:', err);
    }
  }, [clipboard, clearClipboard, refreshFileTree]);

  const buildMenuItems = useCallback((): ContextMenuEntry[] => {
    const node = contextMenu?.node;
    if (!node) return [];

    const items: ContextMenuEntry[] = [];

    if (node.type === 'file') {
      items.push({
        label: 'Open',
        onClick: () => onFileClick(node.path),
      });
      items.push({ type: 'divider' });
    }

    if (node.type === 'directory') {
      items.push({
        label: 'New File',
        onClick: () => setNewInput({ parentPath: node.path, type: 'file' }),
      });
      items.push({
        label: 'New Folder',
        onClick: () => setNewInput({ parentPath: node.path, type: 'directory' }),
      });
      items.push({ type: 'divider' });
    }

    items.push({
      label: 'Copy',
      shortcut: 'Ctrl+C',
      onClick: () => setClipboard(node.path, 'copy'),
    });
    items.push({
      label: 'Cut',
      shortcut: 'Ctrl+X',
      onClick: () => setClipboard(node.path, 'cut'),
    });

    if (node.type === 'directory') {
      items.push({
        label: 'Paste',
        shortcut: 'Ctrl+V',
        disabled: !clipboard,
        onClick: () => handlePaste(node.path),
      });
    }

    items.push({ type: 'divider' });

    items.push({
      label: 'Rename',
      shortcut: 'F2',
      onClick: () => setRenamingPath(node.path),
    });

    items.push({
      label: 'Delete',
      danger: true,
      onClick: () => handleDelete(node.path),
    });

    items.push({ type: 'divider' });

    items.push({
      label: 'Reveal in File Explorer',
      onClick: () => fsService.showInExplorer(node.path),
    });

    return items;
  }, [contextMenu, clipboard, onFileClick, setClipboard, handlePaste, handleDelete]);

  return (
    <div className="flex flex-col gap-0.5 px-1" onContextMenu={handleBgContextMenu}>
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
          onNewSubmit={handleNewSubmit}
          onNewCancel={() => setNewInput(null)}
        />
      ))}

      {contextMenu && contextMenu.node && (
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
