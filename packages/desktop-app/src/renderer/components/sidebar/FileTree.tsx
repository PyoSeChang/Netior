import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import type { FileTreeNode } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import { FileIcon } from './FileIcon';
import { ContextMenu, type ContextMenuEntry } from '../ui/ContextMenu';
import { useFileStore } from '../../stores/file-store';
import { useEditorStore } from '../../stores/editor-store';
import { useI18n } from '../../hooks/useI18n';
import { showToast } from '../ui/Toast';
import { fsService, type StashedDeleteResult } from '../../services';
import { isPrimaryModifier, logShortcut } from '../../shortcuts/shortcut-utils';
import { setFileOpenDragData } from '../../hooks/useFileOpenDrag';

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

interface VisibleTreeItem {
  node: FileTreeNode;
  depth: number;
}

interface DragPayload {
  paths: string[];
  items?: Array<{ path: string; type: 'file' | 'directory' }>;
}

interface UndoDeleteAction {
  type: 'delete';
  items: StashedDeleteResult[];
}

interface UndoCopyAction {
  type: 'copy';
  createdPaths: string[];
}

interface UndoMoveAction {
  type: 'move';
  moves: Array<{ from: string; to: string }>;
}

type UndoAction = UndoDeleteAction | UndoCopyAction | UndoMoveAction;

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const WINDOWS_INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;

function formatPastedImageBaseName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `Pasted image ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function isAlreadyExistsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Already exists') || message.includes('already exists') || message.includes('EEXIST');
}

function normalizePath(targetPath: string): string {
  return targetPath.replace(/\\/g, '/');
}

function getBaseName(targetPath: string): string {
  return normalizePath(targetPath).split('/').pop() ?? targetPath;
}

function getParentPath(targetPath: string): string {
  return normalizePath(targetPath).split('/').slice(0, -1).join('/');
}

function makeTerminalTitle(targetPath: string): string {
  const baseName = getBaseName(targetPath);
  return baseName ? `Terminal: ${baseName}` : 'Terminal';
}

function isSameOrNestedPath(sourcePath: string, targetPath: string): boolean {
  const source = normalizePath(sourcePath);
  const target = normalizePath(targetPath);
  return target === source || target.startsWith(`${source}/`);
}

function splitNameAndExtension(name: string): { stem: string; extension: string } {
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex <= 0) {
    return { stem: name, extension: '' };
  }
  return {
    stem: name.slice(0, lastDotIndex),
    extension: name.slice(lastDotIndex),
  };
}

function compactPaths(paths: string[]): string[] {
  const normalized = [...new Set(paths.map(normalizePath))].sort((a, b) => a.length - b.length);
  return normalized.filter((candidate, index) =>
    !normalized.slice(0, index).some((existing) => isSameOrNestedPath(existing, candidate)),
  );
}

function getSelectionRange(items: VisibleTreeItem[], anchorPath: string | null, targetPath: string): string[] {
  const anchorIndex = anchorPath ? items.findIndex((item) => item.node.path === anchorPath) : -1;
  const targetIndex = items.findIndex((item) => item.node.path === targetPath);
  if (targetIndex === -1) return [targetPath];
  const rangeStart = anchorIndex === -1 ? targetIndex : Math.min(anchorIndex, targetIndex);
  const rangeEnd = anchorIndex === -1 ? targetIndex : Math.max(anchorIndex, targetIndex);
  return items.slice(rangeStart, rangeEnd + 1).map((item) => item.node.path);
}

function validateFileName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name cannot be empty.';
  if (trimmed === '.' || trimmed === '..') return 'This name is not allowed.';
  if (WINDOWS_INVALID_CHARS.test(trimmed)) return 'Name contains invalid characters.';
  if (/[. ]$/.test(trimmed)) return 'Name cannot end with a space or period.';
  if (WINDOWS_RESERVED_NAMES.test(trimmed)) return 'This name is reserved on Windows.';
  return null;
}

async function getNextAvailablePath(targetPath: string): Promise<string> {
  const normalizedTargetPath = normalizePath(targetPath);
  const segments = normalizedTargetPath.split('/');
  const originalName = segments.pop() ?? normalizedTargetPath;
  const parentDir = segments.join('/');
  const { stem, extension } = splitNameAndExtension(originalName);

  let candidatePath = normalizedTargetPath;
  let index = 1;
  while (await fsService.existsItem(candidatePath)) {
    const candidateName = `${stem} (${index})${extension}`;
    candidatePath = parentDir ? `${parentDir}/${candidateName}` : candidateName;
    index += 1;
  }
  return candidatePath;
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
  selectedPaths,
  focusedPath,
  expandedPaths,
  onSelect,
  onToggleExpand,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  newInput,
  newInputPlaceholder,
  onNewSubmit,
  onNewCancel,
  cutPaths,
  dropTargetPath,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  registerRow,
}: {
  node: FileTreeNode;
  depth: number;
  onFileClick: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  selectedPaths: Set<string>;
  focusedPath: string | null;
  expandedPaths: Set<string>;
  onSelect: (event: React.MouseEvent, path: string) => void;
  onToggleExpand: (node: FileTreeNode) => void;
  renamingPath: string | null;
  onRenameSubmit: (oldPath: string, newName: string) => void;
  onRenameCancel: () => void;
  newInput: InlineInputState | null;
  newInputPlaceholder?: string;
  onNewSubmit: (parentPath: string, name: string, type: 'file' | 'directory') => void;
  onNewCancel: () => void;
  cutPaths: Set<string>;
  dropTargetPath: string | null;
  onDragStart: (event: React.DragEvent, node: FileTreeNode) => void;
  onDragOver: (event: React.DragEvent, node: FileTreeNode) => void;
  onDragLeave: (event: React.DragEvent, node: FileTreeNode) => void;
  onDrop: (event: React.DragEvent, node: FileTreeNode) => void;
  registerRow: (path: string, element: HTMLDivElement | null) => void;
}): JSX.Element {
  const isRenaming = renamingPath === node.path;
  const showNewInput = newInput && newInput.parentPath === node.path;
  const { loadChildren, loadingPaths } = useFileStore();
  const isLoadingChildren = loadingPaths.has(node.path);
  const needsLazyLoad = node.type === 'directory' && !node.children && node.hasChildren;
  const expanded = expandedPaths.has(node.path);
  const isSelected = selectedPaths.has(node.path);
  const isFocused = focusedPath === node.path;
  const isCut = [...cutPaths].some((path) => isSameOrNestedPath(path, node.path));
  const dropTargetForNode = node.type === 'directory' ? node.path : getParentPath(node.path);
  const isDropTarget = dropTargetPath === dropTargetForNode;

  // Auto-expand when creating new item inside this folder
  useEffect(() => {
    if (showNewInput && !expanded) {
      onToggleExpand(node);
    }
  }, [showNewInput, expanded, node, onToggleExpand]);

  const handleToggle = useCallback(() => {
    if (!expanded && needsLazyLoad) {
      void loadChildren(node.path);
    }
    onToggleExpand(node);
  }, [expanded, needsLazyLoad, loadChildren, node, onToggleExpand]);

  const rowClassName = `flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs outline-none transition-opacity ${
    isSelected
      ? 'bg-interactive-selected text-accent'
      : node.type === 'directory'
        ? 'text-default hover:bg-surface-hover'
        : 'text-secondary hover:bg-surface-hover hover:text-default'
  } ${isFocused && !isSelected ? 'ring-1 ring-border-default' : ''} ${isCut ? 'opacity-45' : ''} ${
    isDropTarget ? 'bg-interactive-selected' : ''
  }`;

  if (node.type === 'directory') {
    return (
      <>
        <div
          ref={(element) => registerRow(node.path, element)}
          className={rowClassName}
          style={{ paddingLeft: depth * 12 + 4 }}
          draggable
          onDragStart={(e) => onDragStart(e, node)}
          onDragOver={(e) => onDragOver(e, node)}
          onDragLeave={(e) => onDragLeave(e, node)}
          onDrop={(e) => onDrop(e, node)}
          onClick={(e) => {
            onSelect(e, node.path);
            if (!(e.metaKey || e.ctrlKey || e.shiftKey)) {
              handleToggle();
            }
          }}
          onContextMenu={(e) => {
            if (!selectedPaths.has(node.path)) {
              onSelect(e, node.path);
            }
            onContextMenu(e, node);
          }}
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
                selectedPaths={selectedPaths}
                focusedPath={focusedPath}
                expandedPaths={expandedPaths}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                renamingPath={renamingPath}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                newInput={newInput}
                newInputPlaceholder={newInputPlaceholder}
                onNewSubmit={onNewSubmit}
                onNewCancel={onNewCancel}
                cutPaths={cutPaths}
                dropTargetPath={dropTargetPath}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                registerRow={registerRow}
              />
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <div
      ref={(element) => registerRow(node.path, element)}
      className={rowClassName}
      style={{ paddingLeft: depth * 12 + 20 }}
      draggable
      onDragStart={(e) => onDragStart(e, node)}
      onDragOver={(e) => onDragOver(e, node)}
      onDragLeave={(e) => onDragLeave(e, node)}
      onDrop={(e) => onDrop(e, node)}
      onClick={(e) => {
        const isMultiSelect = e.metaKey || e.ctrlKey || e.shiftKey;
        onSelect(e, node.path);
        if (!isMultiSelect) {
          onFileClick(node.path);
        }
      }}
      onContextMenu={(e) => {
        if (!selectedPaths.has(node.path)) {
          onSelect(e, node.path);
        }
        onContextMenu(e, node);
      }}
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
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const { clipboard, setClipboard, clearClipboard, refreshFileTree, rootDirs, loadChildren } = useFileStore();
  const { t } = useI18n();
  const treeRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const undoStackRef = useRef<UndoAction[]>([]);
  const [hasSystemFiles, setHasSystemFiles] = useState(false);
  const [hasClipboardImage, setHasClipboardImage] = useState(false);

  // Auto-expand only root wrapper nodes (multi-dir mode), not content folders
  useEffect(() => {
    const rootSet = new Set(rootDirs.map((d) => d.replace(/\\/g, '/')));
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (const node of nodes) {
        if (rootSet.has(node.path)) {
          next.add(node.path);
        }
      }
      return next;
    });
  }, [nodes, rootDirs]);

  useEffect(() => {
    const pendingLoads = new Set<string>();
    const visit = (items: FileTreeNode[]) => {
      for (const item of items) {
        if (item.type !== 'directory') continue;
        if (expandedPaths.has(item.path) && item.hasChildren && !item.children) {
          pendingLoads.add(item.path);
        }
        if (item.children) visit(item.children);
      }
    };
    visit(nodes);
    for (const dirPath of pendingLoads) {
      void loadChildren(dirPath);
    }
  }, [nodes, expandedPaths, loadChildren]);

  const flattenVisibleNodes = useCallback((items: FileTreeNode[], depth = 0): VisibleTreeItem[] => {
    const result: VisibleTreeItem[] = [];
    for (const item of items) {
      result.push({ node: item, depth });
      if (item.type === 'directory' && expandedPaths.has(item.path) && item.children) {
        result.push(...flattenVisibleNodes(item.children, depth + 1));
      }
    }
    return result;
  }, [expandedPaths]);

  const visibleItems = useMemo(() => flattenVisibleNodes(nodes), [nodes, flattenVisibleNodes]);
  const visiblePathSet = useMemo(() => new Set(visibleItems.map((item) => item.node.path)), [visibleItems]);
  const selectedNode = focusedPath
    ? visibleItems.find((item) => item.node.path === focusedPath)?.node ?? null
    : null;
  const cutPaths = useMemo(
    () => new Set(clipboard?.action === 'cut' ? clipboard.paths.map(normalizePath) : []),
    [clipboard],
  );

  useEffect(() => {
    if (visibleItems.length === 0) {
      setSelectedPaths(new Set());
      setFocusedPath(null);
      setSelectionAnchorPath(null);
      return;
    }
    if (!focusedPath || !visiblePathSet.has(focusedPath)) {
      const fallbackPath = visibleItems[0].node.path;
      setFocusedPath(fallbackPath);
      setSelectedPaths(new Set([fallbackPath]));
      setSelectionAnchorPath(fallbackPath);
      return;
    }
    setSelectedPaths((prev) => {
      const next = new Set([...prev].filter((path) => visiblePathSet.has(path)));
      return next.size > 0 ? next : new Set([focusedPath]);
    });
  }, [focusedPath, visibleItems, visiblePathSet]);

  useEffect(() => {
    if (!focusedPath) return;
    rowRefs.current.get(focusedPath)?.scrollIntoView({ block: 'nearest' });
  }, [focusedPath]);

  const registerRow = useCallback((path: string, element: HTMLDivElement | null) => {
    if (element) {
      rowRefs.current.set(path, element);
    } else {
      rowRefs.current.delete(path);
    }
  }, []);

  const handleContextMenu = useCallback(async (e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    const [hasFiles, hasImage] = await Promise.all([
      fsService.hasClipboardFiles().catch(() => false),
      fsService.hasClipboardImage().catch(() => false),
    ]);
    setHasSystemFiles(hasFiles);
    setHasClipboardImage(hasImage);
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleBgContextMenu = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    const [hasFiles, hasImage] = await Promise.all([
      fsService.hasClipboardFiles().catch(() => false),
      fsService.hasClipboardImage().catch(() => false),
    ]);
    setHasSystemFiles(hasFiles);
    setHasClipboardImage(hasImage);
    setContextMenu({ x: e.clientX, y: e.clientY, node: null });
  }, []);

  const toggleExpand = useCallback((node: FileTreeNode) => {
    if (node.type !== 'directory') return;
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback((event: React.MouseEvent, path: string) => {
    const normalizedPath = normalizePath(path);

    if (event.shiftKey) {
      const range = getSelectionRange(visibleItems, selectionAnchorPath ?? focusedPath, normalizedPath);
      setSelectedPaths(new Set(range));
      setFocusedPath(normalizedPath);
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(normalizedPath)) {
          next.delete(normalizedPath);
        } else {
          next.add(normalizedPath);
        }
        return next.size > 0 ? next : new Set([normalizedPath]);
      });
      setFocusedPath(normalizedPath);
      setSelectionAnchorPath(normalizedPath);
      return;
    }

    setSelectedPaths(new Set([normalizedPath]));
    setFocusedPath(normalizedPath);
    setSelectionAnchorPath(normalizedPath);
  }, [focusedPath, selectionAnchorPath, visibleItems]);

  const getActiveSelection = useCallback((): string[] => {
    if (selectedPaths.size > 0) {
      return compactPaths([...selectedPaths]);
    }
    return focusedPath ? [focusedPath] : [];
  }, [focusedPath, selectedPaths]);

  const syncClipboardPaths = useCallback((updater: (paths: string[]) => string[]) => {
    if (!clipboard) return;
    const nextPaths = compactPaths(updater(clipboard.paths));
    if (nextPaths.length > 0) {
      setClipboard(nextPaths, clipboard.action);
      void fsService.writeClipboardFiles(nextPaths, clipboard.action).catch((error) => {
        console.error('[FileTree] Failed to sync system clipboard:', error);
        showToast('error', t('fileTree.clipboardFailed' as TranslationKey));
      });
    } else {
      clearClipboard();
    }
  }, [clipboard, clearClipboard, setClipboard, t]);

  const handleClipboardAction = useCallback(async (paths: string[], action: 'copy' | 'cut') => {
    const nextPaths = compactPaths(paths);
    if (nextPaths.length === 0) return;

    setClipboard(nextPaths, action);
    try {
      await fsService.writeClipboardFiles(nextPaths, action);
    } catch (error) {
      console.error('[FileTree] Failed to write file clipboard:', { action, paths: nextPaths, error });
      showToast('error', t('fileTree.clipboardFailed' as TranslationKey));
    }
  }, [setClipboard, t]);

  const handleRenameSubmit = useCallback(async (oldPath: string, newName: string) => {
    const validationError = validateFileName(newName);
    if (validationError) {
      showToast('error', validationError);
      return;
    }

    const parentDir = getParentPath(oldPath);
    const newPath = `${parentDir}/${newName}`;
    let renamed = false;
    try {
      if (normalizePath(oldPath) === normalizePath(newPath)) {
        setRenamingPath(null);
        return;
      }
      await fsService.renameItem(oldPath, newPath);
      await refreshFileTree();
      renamed = true;
    } catch (err) {
      console.error('[FileTree] Rename failed:', { oldPath, newPath, error: err });
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Already exists')) {
        showToast('error', t('fileTree.alreadyExists' as TranslationKey, { name: newName }));
      } else {
        showToast('error', t('fileTree.renameFailed' as TranslationKey));
      }
    }
    setRenamingPath(null);
    if (renamed) {
      setSelectedPaths(new Set([newPath]));
      setFocusedPath(newPath);
      setSelectionAnchorPath(newPath);
      syncClipboardPaths((paths) => paths.map((path) => {
        if (!isSameOrNestedPath(oldPath, path)) return path;
        if (normalizePath(path) === normalizePath(oldPath)) return newPath;
        return normalizePath(path).replace(normalizePath(oldPath), newPath);
      }));
    }
  }, [refreshFileTree, syncClipboardPaths, t]);

  const handleNewSubmit = useCallback(async (parentPath: string, name: string, type: 'file' | 'directory') => {
    const validationError = validateFileName(name);
    if (validationError) {
      showToast('error', validationError);
      return;
    }

    const requestedPath = normalizePath(parentPath) + '/' + name;
    try {
      const fullPath = await getNextAvailablePath(requestedPath);
      if (type === 'file') {
        await fsService.createFile(fullPath);
      } else {
        await fsService.createDir(fullPath);
      }
      await refreshFileTree();
      setSelectedPaths(new Set([fullPath]));
      setFocusedPath(fullPath);
      setSelectionAnchorPath(fullPath);
    } catch (err) {
      console.error('[FileTree] Create failed:', { parentPath, requestedPath, type, error: err });
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists') || msg.includes('Already exists')) {
        showToast('error', t('fileTree.alreadyExists' as TranslationKey, { name }));
      } else {
        showToast('error', t('fileTree.createFailed' as TranslationKey));
      }
    }
    setNewInput(null);
  }, [refreshFileTree, t]);

  const handleDelete = useCallback(async (paths: string[]) => {
    const targets = compactPaths(paths);
    if (targets.length === 0) return;

    try {
      const stashedItems: StashedDeleteResult[] = [];
      for (const path of targets) {
        stashedItems.push(await fsService.stashDeleteItem(path));
      }
      undoStackRef.current.push({ type: 'delete', items: stashedItems });
      await refreshFileTree();
      setSelectedPaths(new Set());
      setFocusedPath(null);
      setSelectionAnchorPath(null);
      syncClipboardPaths((clipboardPaths) =>
        clipboardPaths.filter((clipboardPath) => !targets.some((target) => isSameOrNestedPath(target, clipboardPath))),
      );
    } catch (err) {
      console.error('[FileTree] Delete failed:', { paths: targets, error: err });
      showToast('error', t('fileTree.deleteFailed' as TranslationKey));
    }
  }, [refreshFileTree, syncClipboardPaths, t]);

  const handlePaste = useCallback(async (destDir: string) => {
    // Internal clipboard (cut/copy within the app)
    const normalizedDestDir = normalizePath(destDir);
    if (clipboard && clipboard.paths.length > 0) {
      const sourcePaths = compactPaths(clipboard.paths);
      const createdPaths: string[] = [];
      const movedPaths: Array<{ from: string; to: string }> = [];
      try {
        for (const srcPath of sourcePaths) {
          const srcName = getBaseName(srcPath);
          const requestedDestPath = `${normalizedDestDir}/${srcName}`;
          if (clipboard.action === 'cut' && normalizePath(srcPath) === normalizePath(requestedDestPath)) {
            continue;
          }
          const resolvedDestPath = await getNextAvailablePath(requestedDestPath);
          if (clipboard.action === 'copy') {
            await fsService.copyItem(srcPath, resolvedDestPath);
            createdPaths.push(resolvedDestPath);
          } else {
            await fsService.moveItem(srcPath, resolvedDestPath);
            movedPaths.push({ from: srcPath, to: resolvedDestPath });
          }
        }

        if (clipboard.action === 'copy' && createdPaths.length > 0) {
          undoStackRef.current.push({ type: 'copy', createdPaths });
        }
        if (clipboard.action === 'cut' && movedPaths.length > 0) {
          undoStackRef.current.push({ type: 'move', moves: movedPaths });
          clearClipboard();
        }
        await refreshFileTree();
        const finalPath = createdPaths.at(-1) ?? movedPaths.at(-1)?.to ?? null;
        if (finalPath) {
          setSelectedPaths(new Set([finalPath]));
          setFocusedPath(finalPath);
          setSelectionAnchorPath(finalPath);
        }
      } catch (err) {
        console.error('[FileTree] Internal paste failed:', {
          action: clipboard.action,
          srcPaths: sourcePaths,
          destDir: normalizedDestDir,
          error: err,
        });
        if (isAlreadyExistsError(err)) {
          showToast('error', t('fileTree.alreadyExists' as TranslationKey, { name: getBaseName(sourcePaths[0] ?? normalizedDestDir) }));
        } else {
          showToast('error', t('fileTree.pasteFailed' as TranslationKey));
        }
      }
      return;
    }
    // System clipboard (files copied from Windows Explorer)
    let currentSrcName = '';
    let lastPastedPath = '';
    try {
      const paths = await fsService.readClipboardFiles();
      const createdPaths: string[] = [];
      if (paths.length > 0) {
        for (const srcPath of paths) {
          currentSrcName = getBaseName(srcPath);
          const requestedDestPath = normalizedDestDir + '/' + currentSrcName;
          const destPath = await getNextAvailablePath(requestedDestPath);
          await fsService.copyItem(srcPath, destPath);
          createdPaths.push(destPath);
          lastPastedPath = destPath;
        }
      } else if (await fsService.hasClipboardImage()) {
        currentSrcName = `${formatPastedImageBaseName()}.png`;
        const requestedDestPath = normalizedDestDir + '/' + currentSrcName;
        const destPath = await getNextAvailablePath(requestedDestPath);
        await fsService.saveClipboardImage(destPath);
        createdPaths.push(destPath);
        lastPastedPath = destPath;
      } else {
        return;
      }
      if (createdPaths.length > 0) {
        undoStackRef.current.push({ type: 'copy', createdPaths });
      }
      await refreshFileTree();
      if (lastPastedPath) {
        setSelectedPaths(new Set([lastPastedPath]));
        setFocusedPath(lastPastedPath);
        setSelectionAnchorPath(lastPastedPath);
      }
    } catch (err) {
      console.error('[FileTree] System paste failed:', {
        destDir,
        currentSrcName,
        error: err,
      });
      if (isAlreadyExistsError(err)) {
        showToast('error', t('fileTree.alreadyExists' as TranslationKey, { name: currentSrcName || destDir }));
      } else {
        showToast('error', t('fileTree.pasteFailed' as TranslationKey));
      }
    }
  }, [clipboard, clearClipboard, refreshFileTree, t]);

  // Block browser default paste behavior (prevents "Not allowed to load local resource" errors)
  const handleNativePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
  }, []);

  /** Resolve parent directory for a node (for file nodes, use their parent dir) */
  const getParentDir = useCallback((node: FileTreeNode): string => {
    if (node.type === 'directory') return node.path;
    return getParentPath(node.path);
  }, []);

  const handleUndo = useCallback(async () => {
    const action = undoStackRef.current.pop();
    if (!action) return;

    try {
      if (action.type === 'delete') {
        for (const item of action.items) {
          await fsService.restoreDeletedItem(item.stashPath, item.originalPath);
        }
        await refreshFileTree();
        const restoredPath = action.items.at(-1)?.originalPath;
        if (restoredPath) {
          setSelectedPaths(new Set([restoredPath]));
          setFocusedPath(restoredPath);
          setSelectionAnchorPath(restoredPath);
        }
        return;
      }

      if (action.type === 'copy') {
        for (const path of [...action.createdPaths].reverse()) {
          if (await fsService.existsItem(path)) {
            await fsService.stashDeleteItem(path);
          }
        }
        await refreshFileTree();
        return;
      }

      for (const move of [...action.moves].reverse()) {
        if (await fsService.existsItem(move.to) && !(await fsService.existsItem(move.from))) {
          await fsService.moveItem(move.to, move.from);
        }
      }
      await refreshFileTree();
      const restoredPath = action.moves.at(-1)?.from;
      if (restoredPath) {
        setSelectedPaths(new Set([restoredPath]));
        setFocusedPath(restoredPath);
        setSelectionAnchorPath(restoredPath);
      }
    } catch (err) {
      console.error('[FileTree] Undo failed:', { action, error: err });
      showToast('error', 'Unable to undo the last file tree action.');
    }
  }, [refreshFileTree]);

  const handleDragStart = useCallback((event: React.DragEvent, node: FileTreeNode) => {
    const dragPaths = selectedPaths.has(node.path) ? getActiveSelection() : [node.path];
    const nodesByPath = new Map(visibleItems.map((item) => [normalizePath(item.node.path), item.node]));
    const payload: DragPayload = {
      paths: dragPaths,
      items: dragPaths.map((path) => {
        const treeNode = nodesByPath.get(normalizePath(path));
        return {
          path,
          type: treeNode?.type ?? 'file',
        };
      }),
    };
    event.dataTransfer.setData('application/netior-node', JSON.stringify(payload));
    setFileOpenDragData(event, dragPaths.filter((path) =>
      visibleItems.some((item) => item.node.type === 'file' && item.node.path === path),
    ));
    event.dataTransfer.effectAllowed = 'copyMove';
  }, [getActiveSelection, selectedPaths, visibleItems]);

  const handleDragOver = useCallback((event: React.DragEvent, node: FileTreeNode) => {
    event.preventDefault();
    setDropTargetPath(node.type === 'directory' ? node.path : getParentDir(node));
    event.dataTransfer.dropEffect = event.ctrlKey ? 'copy' : 'move';
  }, [getParentDir]);

  const handleDragLeave = useCallback((event: React.DragEvent, _node: FileTreeNode) => {
    event.preventDefault();
    setDropTargetPath(null);
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent, node: FileTreeNode) => {
    event.preventDefault();
    setDropTargetPath(null);

    const rawPayload = event.dataTransfer.getData('application/netior-node');
    if (!rawPayload) return;

    try {
      const payload = JSON.parse(rawPayload) as DragPayload;
      const dragPaths = compactPaths(payload.paths);
      const destinationDir = node.type === 'directory' ? node.path : getParentDir(node);
      const createdPaths: string[] = [];
      const movedPaths: Array<{ from: string; to: string }> = [];

      for (const srcPath of dragPaths) {
        const requestedDestPath = `${normalizePath(destinationDir)}/${getBaseName(srcPath)}`;
        if (!event.ctrlKey && normalizePath(srcPath) === normalizePath(requestedDestPath)) {
          continue;
        }
        const resolvedDestPath = await getNextAvailablePath(requestedDestPath);
        if (event.ctrlKey) {
          await fsService.copyItem(srcPath, resolvedDestPath);
          createdPaths.push(resolvedDestPath);
        } else {
          await fsService.moveItem(srcPath, resolvedDestPath);
          movedPaths.push({ from: srcPath, to: resolvedDestPath });
        }
      }

      if (createdPaths.length > 0) {
        undoStackRef.current.push({ type: 'copy', createdPaths });
      }
      if (movedPaths.length > 0) {
        undoStackRef.current.push({ type: 'move', moves: movedPaths });
      }

      await refreshFileTree();
      const finalPath = createdPaths.at(-1) ?? movedPaths.at(-1)?.to;
      if (finalPath) {
        setSelectedPaths(new Set([finalPath]));
        setFocusedPath(finalPath);
        setSelectionAnchorPath(finalPath);
      }
    } catch (err) {
      console.error('[FileTree] Drag drop failed:', { node, error: err });
      showToast('error', t('fileTree.pasteFailed' as TranslationKey));
    }
  }, [getParentDir, refreshFileTree, t]);

  const buildMenuItems = useCallback((): ContextMenuEntry[] => {
    const node = contextMenu?.node;
    const selection = node
      ? (selectedPaths.has(node.path) ? getActiveSelection() : [node.path])
      : [];

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
      if (clipboard || hasSystemFiles || hasClipboardImage) {
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
      onClick: () => { void handleClipboardAction(selection, 'copy'); },
    });
    items.push({
      label: t('fileTree.cut' as TranslationKey),
      shortcut: 'Ctrl+X',
      onClick: () => { void handleClipboardAction(selection, 'cut'); },
    });

    if (clipboard || hasSystemFiles || hasClipboardImage) {
      items.push({
        label: t('fileTree.paste' as TranslationKey),
        shortcut: 'Ctrl+V',
        onClick: () => handlePaste(node.type === 'directory' ? node.path : parentDir),
      });
    }

    items.push({ type: 'divider' });

    if (node.type === 'directory') {
      items.push({
        label: t('shortcuts.items.global.openTerminalLabel' as TranslationKey),
        onClick: () => {
          const sessionId = `term-${Date.now()}`;
          void useEditorStore.getState().openTab({
            type: 'terminal',
            targetId: sessionId,
            title: makeTerminalTitle(node.path),
            terminalCwd: node.path,
          });
        },
      });
      items.push({ type: 'divider' });
    }

    if (selection.length === 1) {
      items.push({
        label: t('fileTree.rename' as TranslationKey),
        shortcut: 'F2',
        onClick: () => setRenamingPath(selection[0]),
      });
    }

    items.push({
      label: t('fileTree.delete' as TranslationKey),
      danger: true,
      onClick: () => handleDelete(selection),
    });

    items.push({ type: 'divider' });

    items.push({
      label: t('fileTree.revealInExplorer' as TranslationKey),
      onClick: () => fsService.showInExplorer(selection[0] ?? node.path),
    });

    return items;
  }, [contextMenu, clipboard, hasSystemFiles, hasClipboardImage, rootDirs, onFileClick, handleClipboardAction, handlePaste, handleDelete, getParentDir, getActiveSelection, selectedPaths, t]);

  const newInputPlaceholder = newInput?.type === 'file'
    ? t('fileTree.filenamePlaceholder' as TranslationKey)
    : t('fileTree.folderNamePlaceholder' as TranslationKey);

  /** Check if newInput targets a root dir (not handled by any FileTreeItem) */
  const isRootNewInput = newInput != null &&
    rootDirs.some((d) => normalizePath(d) === newInput.parentPath);

  const moveSelection = useCallback((direction: 1 | -1, extendSelection = false) => {
    if (visibleItems.length === 0) return;
    const currentIndex = focusedPath
      ? visibleItems.findIndex((item) => item.node.path === focusedPath)
      : -1;
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Math.max(0, Math.min(visibleItems.length - 1, baseIndex + direction));
    const nextPath = visibleItems[nextIndex].node.path;
    setFocusedPath(nextPath);
    if (extendSelection) {
      setSelectedPaths(new Set(getSelectionRange(visibleItems, selectionAnchorPath ?? focusedPath, nextPath)));
    } else {
      setSelectedPaths(new Set([nextPath]));
      setSelectionAnchorPath(nextPath);
    }
  }, [focusedPath, selectionAnchorPath, visibleItems]);

  const handleSelectionOpen = useCallback(async () => {
    if (!selectedNode) return;
    if (selectedNode.type === 'file') {
      logShortcut('shortcut.fileTree.openSelection');
      onFileClick(selectedNode.path);
      return;
    }
    if (!expandedPaths.has(selectedNode.path) && selectedNode.hasChildren && !selectedNode.children) {
      await useFileStore.getState().loadChildren(selectedNode.path);
    }
    logShortcut('shortcut.fileTree.openSelection');
    toggleExpand(selectedNode);
  }, [selectedNode, onFileClick, expandedPaths, toggleExpand]);

  const handlePasteSelection = useCallback(async () => {
    const destDir = selectedNode
      ? (selectedNode.type === 'directory' ? selectedNode.path : getParentDir(selectedNode))
      : rootDirs[0]?.replace(/\\/g, '/');
    if (!destDir) return;
    logShortcut('shortcut.fileTree.pasteIntoSelection');
    await handlePaste(destDir);
  }, [selectedNode, getParentDir, handlePaste, rootDirs]);

  const handleTreeKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (contextMenu || renamingPath || newInput) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1, e.shiftKey);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1, e.shiftKey);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleSelectionOpen();
      return;
    }
    if (e.key === 'ArrowRight' && selectedNode?.type === 'directory') {
      e.preventDefault();
      if (!expandedPaths.has(selectedNode.path)) {
        await handleSelectionOpen();
      }
      return;
    }
    if (e.key === 'ArrowLeft' && selectedNode?.type === 'directory') {
      e.preventDefault();
      if (expandedPaths.has(selectedNode.path)) {
        toggleExpand(selectedNode);
      }
      return;
    }
    const activeSelection = getActiveSelection();
    if (e.key === 'F2' && activeSelection.length === 1) {
      e.preventDefault();
      logShortcut('shortcut.fileTree.renameSelection');
      setRenamingPath(activeSelection[0]);
      return;
    }
    if (e.key === 'Delete' && activeSelection.length > 0) {
      e.preventDefault();
      logShortcut('shortcut.fileTree.deleteSelection');
      await handleDelete(activeSelection);
      return;
    }
    if (!isPrimaryModifier(e.nativeEvent)) return;

    const key = e.key.toLowerCase();
    if (key === 'a') {
      e.preventDefault();
      const paths = visibleItems.map((item) => item.node.path);
      setSelectedPaths(new Set(paths));
      if (paths.length > 0) {
        setFocusedPath(paths[0]);
        setSelectionAnchorPath(paths[0]);
      }
      return;
    }
    if (key === 'c' && activeSelection.length > 0) {
      e.preventDefault();
      logShortcut('shortcut.fileTree.copySelection');
      await handleClipboardAction(activeSelection, 'copy');
      return;
    }
    if (key === 'x' && activeSelection.length > 0) {
      e.preventDefault();
      logShortcut('shortcut.fileTree.cutSelection');
      await handleClipboardAction(activeSelection, 'cut');
      return;
    }
    if (key === 'v') {
      e.preventDefault();
      await handlePasteSelection();
      return;
    }
    if (key === 'z') {
      e.preventDefault();
      await handleUndo();
    }
  }, [
    contextMenu,
    renamingPath,
    newInput,
    moveSelection,
    handleSelectionOpen,
    selectedNode,
    expandedPaths,
    toggleExpand,
    handleDelete,
    getActiveSelection,
    handleUndo,
    visibleItems,
    handleClipboardAction,
    focusedPath,
    handlePasteSelection,
  ]);

  return (
    <div
      ref={treeRef}
      className="flex flex-1 flex-col gap-0.5 px-1 outline-none"
      tabIndex={0}
      onContextMenu={handleBgContextMenu}
      onKeyDown={handleTreeKeyDown}
      onPaste={handleNativePaste}
      onMouseDown={() => treeRef.current?.focus()}
    >
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
          selectedPaths={selectedPaths}
          focusedPath={focusedPath}
          expandedPaths={expandedPaths}
          onSelect={handleSelect}
          onToggleExpand={toggleExpand}
          renamingPath={renamingPath}
          onRenameSubmit={handleRenameSubmit}
          onRenameCancel={() => setRenamingPath(null)}
          newInput={newInput}
          newInputPlaceholder={newInputPlaceholder}
          onNewSubmit={handleNewSubmit}
          onNewCancel={() => setNewInput(null)}
          cutPaths={cutPaths}
          dropTargetPath={dropTargetPath}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          registerRow={registerRow}
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
