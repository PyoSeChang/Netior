import { create } from 'zustand';
import type { Context, ContextCreate, ContextUpdate, ContextMember } from '@netior/shared/types';
import { contextService } from '../services';

interface ContextStore {
  contexts: Context[];
  loading: boolean;

  loadContexts: (networkId: string) => Promise<void>;
  createContext: (data: ContextCreate) => Promise<Context>;
  updateContext: (id: string, data: ContextUpdate) => Promise<void>;
  deleteContext: (id: string) => Promise<void>;
  addMember: (contextId: string, memberType: 'object' | 'edge', memberId: string) => Promise<ContextMember>;
  removeMember: (id: string) => Promise<void>;
  clear: () => void;
}

export const useContextStore = create<ContextStore>((set) => ({
  contexts: [],
  loading: false,

  loadContexts: async (networkId) => {
    set({ loading: true });
    try {
      const contexts = await contextService.list(networkId);
      set({ contexts });
    } finally {
      set({ loading: false });
    }
  },

  createContext: async (data) => {
    const context = await contextService.create(data);
    set((s) => ({ contexts: [...s.contexts, context] }));
    return context;
  },

  updateContext: async (id, data) => {
    const updated = await contextService.update(id, data);
    set((s) => ({
      contexts: s.contexts.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteContext: async (id) => {
    await contextService.delete(id);
    set((s) => ({
      contexts: s.contexts.filter((c) => c.id !== id),
    }));
  },

  addMember: async (contextId, memberType, memberId) => {
    return contextService.addMember(contextId, memberType, memberId);
  },

  removeMember: async (id) => {
    await contextService.removeMember(id);
  },

  clear: () => set({ contexts: [], loading: false }),
}));
