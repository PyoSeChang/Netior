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

interface FileStore {
  fileTree: FileTreeNode[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  loading: boolean;

  loadFileTree: (rootDirs: string | string[]) => Promise<void>;
  openFile: (relativePath: string, rootDir: string) => Promise<void>;
  closeFile: (filePath: string) => void;
  setActiveFile: (filePath: string) => void;
  updateContent: (filePath: string, content: string) => void;
  saveFile: (filePath: string) => Promise<void>;
  clear: () => void;
}

export const useFileStore = create<FileStore>((set, get) => ({
  fileTree: [],
  openFiles: [],
  activeFilePath: null,
  loading: false,

  loadFileTree: async (rootDirs) => {
    set({ loading: true });
    try {
      const dirs = Array.isArray(rootDirs) ? rootDirs : [rootDirs];
      const trees = await Promise.all(dirs.map((d) => fsService.readDir(d)));
      // Merge: each directory becomes a top-level node
      const fileTree = dirs.length === 1
        ? trees[0]
        : dirs.map((dirPath, i) => {
            const name = dirPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() || dirPath;
            return {
              name,
              path: dirPath,
              type: 'directory' as const,
              children: trees[i],
            };
          });
      set({ fileTree });
    } finally {
      set({ loading: false });
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
    if (editorType === 'code') {
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

  clear: () => set({ fileTree: [], openFiles: [], activeFilePath: null }),
}));
