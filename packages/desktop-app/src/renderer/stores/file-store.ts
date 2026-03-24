import { create } from 'zustand';
import type { FileTreeNode } from '@moc/shared/types';
import { fsService } from '../services';

export type EditorType = 'markdown' | 'plain-text' | 'image' | 'pdf' | 'unsupported';

export interface OpenFile {
  filePath: string;
  absolutePath: string;
  editorType: EditorType;
  content: string;
  isDirty: boolean;
}

const EDITOR_MAP: Record<string, EditorType> = {
  md: 'markdown', mdx: 'markdown',
  txt: 'plain-text', json: 'plain-text', yaml: 'plain-text', yml: 'plain-text',
  csv: 'plain-text', xml: 'plain-text', html: 'plain-text', css: 'plain-text',
  js: 'plain-text', ts: 'plain-text', tsx: 'plain-text', jsx: 'plain-text',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image',
  pdf: 'pdf',
};

function getEditorType(filePath: string): EditorType {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EDITOR_MAP[ext] ?? 'unsupported';
}

interface FileStore {
  fileTree: FileTreeNode[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  loading: boolean;

  loadFileTree: (rootDir: string) => Promise<void>;
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

  loadFileTree: async (rootDir) => {
    set({ loading: true });
    try {
      const tree = await fsService.readDir(rootDir);
      set({ fileTree: tree });
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
    if (editorType === 'markdown' || editorType === 'plain-text') {
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
