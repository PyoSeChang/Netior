import { create } from 'zustand';
import type {
  TypeGroup,
  TypeGroupCreate,
  TypeGroupKind,
  TypeGroupUpdate,
} from '@netior/shared/types';
import { typeGroupService } from '../services';

type GroupsByKind = Record<TypeGroupKind, TypeGroup[]>;

interface TypeGroupStore {
  groupsByKind: GroupsByKind;
  loading: boolean;

  loadByProject: (projectId: string) => Promise<void>;
  loadKind: (projectId: string, kind: TypeGroupKind) => Promise<void>;
  createGroup: (data: TypeGroupCreate) => Promise<TypeGroup>;
  updateGroup: (id: string, data: TypeGroupUpdate) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  clear: () => void;
}

const EMPTY_GROUPS: GroupsByKind = {
  schema: [],
  relation_type: [],
};

export const useTypeGroupStore = create<TypeGroupStore>((set, get) => ({
  groupsByKind: EMPTY_GROUPS,
  loading: false,

  loadByProject: async (projectId) => {
    set({ loading: true });
    try {
      const [schemaGroups, relationTypeGroups] = await Promise.all([
        typeGroupService.list(projectId, 'schema'),
        typeGroupService.list(projectId, 'relation_type'),
      ]);
      set({
        groupsByKind: {
          schema: schemaGroups,
          relation_type: relationTypeGroups,
        },
      });
    } finally {
      set({ loading: false });
    }
  },

  loadKind: async (projectId, kind) => {
    const groups = await typeGroupService.list(projectId, kind);
    set((state) => ({
      groupsByKind: {
        ...state.groupsByKind,
        [kind]: groups,
      },
    }));
  },

  createGroup: async (data) => {
    const group = await typeGroupService.create(data);
    set((state) => ({
      groupsByKind: {
        ...state.groupsByKind,
        [group.kind]: [...state.groupsByKind[group.kind], group],
      },
    }));
    return group;
  },

  updateGroup: async (id, data) => {
    const existing = (Object.values(get().groupsByKind).flat()).find((group) => group.id === id);
    if (!existing) return;

    const updated = await typeGroupService.update(id, data);
    set((state) => ({
      groupsByKind: {
        ...state.groupsByKind,
        [existing.kind]: state.groupsByKind[existing.kind].map((group) => (
          group.id === id ? updated : group
        )),
      },
    }));
  },

  deleteGroup: async (id) => {
    const existing = (Object.values(get().groupsByKind).flat()).find((group) => group.id === id);
    if (!existing) return;

    await typeGroupService.delete(id);
    set((state) => ({
      groupsByKind: {
        ...state.groupsByKind,
        [existing.kind]: state.groupsByKind[existing.kind].filter((group) => group.id !== id),
      },
    }));
  },

  clear: () => set({ groupsByKind: EMPTY_GROUPS, loading: false }),
}));
