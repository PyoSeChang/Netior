import { create } from 'zustand';
import type { Project, FileEntity } from '@netior/shared/types';
import { projectService, moduleService, fileService } from '../services';
import { unwrapIpc } from '../services/ipc';
import { saveProjectState, restoreProjectState, clearAllProjectStores, deleteProjectState } from './project-state-cache';

export interface MissingFileEntry {
  fileEntity: FileEntity;
  /** resolved action: 'reconnect' | 'delete' | 'ignore' */
  action?: 'reconnect' | 'delete' | 'ignore';
  newPath?: string;
}

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  missingPathProject: Project | null;
  missingFiles: MissingFileEntry[];

  loadProjects: () => Promise<void>;
  restoreLastProject: () => Promise<void>;
  createProject: (name: string, rootDir: string) => Promise<Project>;
  openProject: (project: Project) => Promise<void>;
  resolveMissingPath: () => Promise<void>;
  dismissMissingPath: () => void;
  validateFilePaths: (project: Project) => Promise<void>;
  resolveMissingFile: (fileId: string, action: 'reconnect' | 'delete' | 'ignore', newPath?: string) => Promise<void>;
  dismissMissingFiles: () => void;
  closeProject: () => void;
  deleteProject: (id: string) => Promise<void>;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('/') || path.startsWith('\\\\');
}

function resolveFileEntityAbsolutePath(projectRoot: string, filePath: string): string {
  if (isAbsolutePath(filePath)) {
    return filePath;
  }
  const normalizedRoot = normalizePath(projectRoot).replace(/\/+$/, '');
  const normalizedFilePath = normalizePath(filePath).replace(/^\/+/, '');
  return `${normalizedRoot}/${normalizedFilePath}`;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  missingPathProject: null,
  missingFiles: [],

  loadProjects: async () => {
    set({ loading: true });
    try {
      const projects = await projectService.list();
      set({ projects });
    } finally {
      set({ loading: false });
    }
  },

  restoreLastProject: async () => {
    try {
      const lastId = unwrapIpc(await window.electron.config.get('lastProjectId')) as string | null;
      if (!lastId) return;
      const { projects, openProject } = get();
      const project = projects.find((p) => p.id === lastId);
      if (project) {
        await openProject(project);
      }
    } catch {
      // ignore — config may not exist yet
    }
  },

  createProject: async (name, rootDir) => {
    const project = await projectService.create({ name, root_dir: rootDir });
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  openProject: async (project) => {
    // Check if root_dir exists; if not, show missing path dialog
    let resolvedProject = project;
    try {
      const exists = unwrapIpc(await window.electron.fs.exists(project.root_dir));
      if (!exists) {
        set({ missingPathProject: project });
        return;
      }
    } catch {
      // fall through
    }

    const { currentProject } = get();
    if (currentProject && currentProject.id !== resolvedProject.id) {
      saveProjectState(currentProject.id);
    }

    const restored = restoreProjectState(resolvedProject.id);
    if (!restored) {
      clearAllProjectStores();
    }

    set({ currentProject: resolvedProject });
    window.electron.config.set('lastProjectId', resolvedProject.id).catch(() => {});

    // Validate file entity paths in background
    get().validateFilePaths(resolvedProject).catch(() => {});
  },

  validateFilePaths: async (project) => {
    try {
      const files = await fileService.getByProject(project.id);
      const missing: MissingFileEntry[] = [];
      for (const f of files) {
        const absPath = resolveFileEntityAbsolutePath(project.root_dir, f.path);
        const exists = unwrapIpc(await window.electron.fs.exists(absPath));
        if (!exists) {
          missing.push({ fileEntity: f });
        }
      }
      if (missing.length > 0) {
        set({ missingFiles: missing });
      }
    } catch {
      // ignore validation errors
    }
  },

  resolveMissingFile: async (fileId, action, newPath) => {
    if (action === 'delete') {
      await fileService.delete(fileId);
    } else if (action === 'reconnect' && newPath) {
      // Update the file entity path (need to figure out relative path)
      // For now just update metadata — actual path update would need a new API
      // TODO: implement path update in FileRepository
    }
    // Remove from missing list
    set((s) => ({
      missingFiles: s.missingFiles.filter((m) => m.fileEntity.id !== fileId),
    }));
  },

  dismissMissingFiles: () => {
    set({ missingFiles: [] });
  },

  resolveMissingPath: async () => {
    const { missingPathProject, openProject } = get();
    if (!missingPathProject) return;

    const paths = unwrapIpc(await window.electron.fs.openDialog({ properties: ['openDirectory'] })) as string[] | null;
    if (!paths || paths.length === 0) {
      set({ missingPathProject: null });
      return;
    }

    const newPath = paths[0];
    const updated = await projectService.updateRootDir(missingPathProject.id, newPath);

    // Also update module directories that pointed to the old root_dir
    const modules = await moduleService.list(missingPathProject.id);
    for (const mod of modules) {
      const dirs = await moduleService.dir.list(mod.id);
      for (const dir of dirs) {
        if (dir.dir_path === missingPathProject.root_dir) {
          await moduleService.dir.updatePath(dir.id, newPath);
        }
      }
    }

    set((s) => ({
      missingPathProject: null,
      projects: s.projects.map((p) => (p.id === updated.id ? updated : p)),
    }));
    await openProject(updated);
  },

  dismissMissingPath: () => {
    set({ missingPathProject: null });
  },

  closeProject: () => {
    const { currentProject } = get();
    if (currentProject) {
      saveProjectState(currentProject.id);
    }
    clearAllProjectStores();
    set({ currentProject: null });
    window.electron.config.set('lastProjectId', '').catch(() => {});
  },

  deleteProject: async (id) => {
    await projectService.delete(id);
    deleteProjectState(id);
    const lastId = unwrapIpc(await window.electron.config.get('lastProjectId').catch(() => ({ success: true, data: null }))) as string | null;
    if (lastId === id) {
      window.electron.config.set('lastProjectId', '').catch(() => {});
    }
    const wasCurrent = get().currentProject?.id === id;
    if (wasCurrent) {
      clearAllProjectStores();
    }
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      currentProject: wasCurrent ? null : s.currentProject,
    }));
  },
}));
