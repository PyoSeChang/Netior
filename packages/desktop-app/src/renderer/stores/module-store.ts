import { create } from 'zustand';
import type { Module, ModuleCreate, ModuleUpdate, ModuleDirectory, ModuleDirectoryCreate } from '@netior/shared/types';
import { moduleService } from '../services';
import { useFileStore } from './file-store';

interface ModuleStore {
  modules: Module[];
  activeModuleId: string | null;
  directories: ModuleDirectory[];
  loading: boolean;

  loadModules: (projectId: string) => Promise<void>;
  createModule: (data: ModuleCreate) => Promise<Module>;
  updateModule: (id: string, data: ModuleUpdate) => Promise<void>;
  deleteModule: (id: string) => Promise<void>;
  setActiveModule: (moduleId: string) => Promise<void>;

  addDirectory: (data: ModuleDirectoryCreate) => Promise<ModuleDirectory>;
  removeDirectory: (id: string) => Promise<void>;

  clear: () => void;
}

export const useModuleStore = create<ModuleStore>((set, get) => ({
  modules: [],
  activeModuleId: null,
  directories: [],
  loading: false,

  loadModules: async (projectId) => {
    set({ loading: true });
    try {
      const modules = await moduleService.list(projectId);
      set({ modules });
      // Auto-activate first module if none active
      if (modules.length > 0 && !get().activeModuleId) {
        await get().setActiveModule(modules[0].id);
      }
    } finally {
      set({ loading: false });
    }
  },

  createModule: async (data) => {
    const mod = await moduleService.create(data);
    set((s) => ({ modules: [...s.modules, mod] }));
    return mod;
  },

  updateModule: async (id, data) => {
    const updated = await moduleService.update(id, data);
    set((s) => ({
      modules: s.modules.map((m) => (m.id === id ? updated : m)),
    }));
  },

  deleteModule: async (id) => {
    await moduleService.delete(id);
    const { activeModuleId, modules } = get();
    const remaining = modules.filter((m) => m.id !== id);
    set({ modules: remaining });

    if (activeModuleId === id) {
      if (remaining.length > 0) {
        await get().setActiveModule(remaining[0].id);
      } else {
        set({ activeModuleId: null, directories: [] });
      }
    }
  },

  setActiveModule: async (moduleId) => {
    useFileStore.getState().clear();
    set({ activeModuleId: moduleId });
    const directories = await moduleService.dir.list(moduleId);
    set({ directories });
  },

  addDirectory: async (data) => {
    const dir = await moduleService.dir.add(data);
    set((s) => ({ directories: [...s.directories, dir] }));
    return dir;
  },

  removeDirectory: async (id) => {
    await moduleService.dir.remove(id);
    set((s) => ({ directories: s.directories.filter((d) => d.id !== id) }));
  },

  clear: () => set({ modules: [], activeModuleId: null, directories: [], loading: false }),
}));
