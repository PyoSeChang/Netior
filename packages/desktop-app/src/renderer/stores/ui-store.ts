import { create } from 'zustand';

export type CanvasMode = 'browse' | 'edit';
export type RenderingMode = 'canvas';
type SidebarView = 'canvases' | 'files' | 'archetypes';

interface UIStore {
  canvasMode: CanvasMode;
  sidebarView: SidebarView;
  sidebarOpen: boolean;
  sidebarWidth: number;
  showSettings: boolean;
  showShortcutOverlay: boolean;

  setCanvasMode: (mode: CanvasMode) => void;
  setSidebarView: (view: SidebarView) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setShowSettings: (show: boolean) => void;
  setShowShortcutOverlay: (show: boolean) => void;
}

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 224; // w-56

export const useUIStore = create<UIStore>((set) => ({
  canvasMode: 'browse',
  sidebarView: 'canvases',
  sidebarOpen: true,
  sidebarWidth: SIDEBAR_DEFAULT,
  showSettings: false,
  showShortcutOverlay: false,

  setCanvasMode: (mode) => set({ canvasMode: mode }),
  setSidebarView: (view) => set({ sidebarView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, width)) }),
  setShowSettings: (show) => set({ showSettings: show }),
  setShowShortcutOverlay: (show) => set({ showShortcutOverlay: show }),
}));
