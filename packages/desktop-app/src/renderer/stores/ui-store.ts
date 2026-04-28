import { create } from 'zustand';

export type WorkspaceMode = 'browse' | 'edit';
export type SidebarView =
  | 'projects'
  | 'ontology'
  | 'networks'
  | 'concepts'
  | 'schemas'
  | 'models'
  | 'relationTypes'
  | 'contexts'
  | 'objects'
  | 'files'
  | 'sessions'
  | 'bookmarkedNetwork';

interface UIStore {
  workspaceMode: WorkspaceMode;
  sidebarView: SidebarView;
  bookmarkedSidebarNetworkId: string | null;
  sidebarOpen: boolean;
  sidebarWidth: number;
  showSettings: boolean;
  showShortcutOverlay: boolean;

  setWorkspaceMode: (mode: WorkspaceMode) => void;
  setSidebarView: (view: SidebarView) => void;
  setBookmarkedSidebarNetworkId: (networkId: string | null) => void;
  openBookmarkedSidebar: (networkId: string) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setShowSettings: (show: boolean) => void;
  setShowShortcutOverlay: (show: boolean) => void;
}

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 224; // w-56

export const useUIStore = create<UIStore>((set) => ({
  workspaceMode: 'browse',
  sidebarView: 'networks',
  bookmarkedSidebarNetworkId: null,
  sidebarOpen: true,
  sidebarWidth: SIDEBAR_DEFAULT,
  showSettings: false,
  showShortcutOverlay: false,

  setWorkspaceMode: (mode) => set({ workspaceMode: mode }),
  setSidebarView: (view) => set({ sidebarView: view }),
  setBookmarkedSidebarNetworkId: (networkId) => set({ bookmarkedSidebarNetworkId: networkId }),
  openBookmarkedSidebar: (networkId) => set({
    sidebarView: 'bookmarkedNetwork',
    bookmarkedSidebarNetworkId: networkId,
  }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, width)) }),
  setShowSettings: (show) => set({ showSettings: show }),
  setShowShortcutOverlay: (show) => set({ showShortcutOverlay: show }),
}));
