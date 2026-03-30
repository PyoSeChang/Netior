import { create } from 'zustand';
import type { FileTreeNode } from '@moc/shared/types';
import { fsService } from '../services';
import { getEditorType, type EditorType } from '../components/editor/editor-utils';

export type { EditorType };

export interface OpenFile {
  filePath: string;
  absolutePath: string;
  editorType: EditorType;
  content: string;
  isDirty: boolean;
}

export type ClipboardAction = 'copy' | 'cut';

interface ClipboardState {
  path: string;
  action: ClipboardAction;
}

interface FileStore {
  fileTree: FileTreeNode[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  loading: boolean;
  loadingPaths: Set<string>;
  clipboard: ClipboardState | null;
  rootDirs: string[];

  loadFileTree: (rootDirs: string | string[]) => Promise<void>;
  loadChildren: (dirPath: string) => Promise<void>;
  refreshFileTree: () => Promise<void>;
  openFile: (relativePath: string, rootDir: string) => Promise<void>;
  closeFile: (filePath: string) => void;
  setActiveFile: (filePath: string) => void;
  updateContent: (filePath: string, content: string) => void;
  saveFile: (filePath: string) => Promise<void>;
  setClipboard: (path: string, action: ClipboardAction) => void;
  clearClipboard: () => void;
  clear: () => void;
}

export const useFileStore = create<FileStore>((set, get) => ({
  fileTree: [],
  openFiles: [],
  activeFilePath: null,
  loading: false,
  loadingPaths: new Set(),
  clipboard: null,
  rootDirs: [],

  loadFileTree: async (rootDirs) => {
    const dirs = Array.isArray(rootDirs) ? rootDirs : [rootDirs];
    set({ loading: true, rootDirs: dirs });
    try {
      const trees = await Promise.all(dirs.map((d) => fsService.readDirShallow(d, 2)));
      const fileTree = dirs.length === 1
        ? trees[0]
        : dirs.map((dirPath, i) => {
            const name = dirPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() || dirPath;
            return {
              name,
              path: dirPath.replace(/\\/g, '/'),
              type: 'directory' as const,
              children: trees[i],
            };
          });
      set({ fileTree });
    } finally {
      set({ loading: false });
    }
  },

  loadChildren: async (dirPath) => {
    const { loadingPaths } = get();
    if (loadingPaths.has(dirPath)) return;

    set({ loadingPaths: new Set([...loadingPaths, dirPath]) });
    try {
      const children = await fsService.readDirShallow(dirPath, 1);

      // Merge children into existing tree
      const mergeChildren = (nodes: FileTreeNode[]): FileTreeNode[] =>
        nodes.map((node) => {
          if (node.path === dirPath && node.type === 'directory') {
            return { ...node, children, hasChildren: undefined };
          }
          if (node.children) {
            return { ...node, children: mergeChildren(node.children) };
          }
          return node;
        });

      set((s) => ({ fileTree: mergeChildren(s.fileTree) }));
    } finally {
      const updated = new Set(get().loadingPaths);
      updated.delete(dirPath);
      set({ loadingPaths: updated });
    }
  },

  refreshFileTree: async () => {
    const { rootDirs } = get();
    if (rootDirs.length > 0) {
      await get().loadFileTree(rootDirs);
    }
  },

  openFile: async (relativePath, rootDir) => {
    const { openFiles } = get();
    const existing = openFiles.find((f) => f.filePath === relativePath);
    if (existing) {
      set({ activeFilePath: relativePath });
      return;
    }

    const absolutePath = rootDir.replace(/\\/g, '/') + '/' + relativePath;
    const editorType = getEditorType(relativePath);

    let content = '';
    if (editorType === 'code' || editorType === 'markdown') {
      try {
        content = await fsService.readFile(absolutePath);
      } catch {
        content = '';
      }
    }

    const file: OpenFile = { filePath: relativePath, absolutePath, editorType, content, isDirty: false };
    set((s) => ({
      openFiles: [...s.openFiles, file],
      activeFilePath: relativePath,
    }));
  },

  closeFile: (filePath) => {
    set((s) => {
      const openFiles = s.openFiles.filter((f) => f.filePath !== filePath);
      const activeFilePath =
        s.activeFilePath === filePath
          ? openFiles.length > 0 ? openFiles[openFiles.length - 1].filePath : null
          : s.activeFilePath;
      return { openFiles, activeFilePath };
    });
  },

  setActiveFile: (filePath) => set({ activeFilePath: filePath }),

  updateContent: (filePath, content) => {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.filePath === filePath ? { ...f, content, isDirty: true } : f,
      ),
    }));
  },

  saveFile: async (filePath) => {
    const file = get().openFiles.find((f) => f.filePath === filePath);
    if (!file) return;
    await fsService.writeFile(file.absolutePath, file.content);
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.filePath === filePath ? { ...f, isDirty: false } : f,
      ),
    }));
  },

  setClipboard: (path, action) => set({ clipboard: { path, action } }),
  clearClipboard: () => set({ clipboard: null }),

  clear: () => set({ fileTree: [], openFiles: [], activeFilePath: null, clipboard: null, rootDirs: [], loadingPaths: new Set() }),
}));
