import { create } from 'zustand';

export type NetworkObjectSelectionType = 'network' | 'project' | 'concept' | 'archetype' | 'relation_type' | 'context';

export interface NetworkObjectSelection {
  objectType: NetworkObjectSelectionType;
  id: string;
  title?: string;
}

interface NetworkObjectSelectionStore {
  selection: NetworkObjectSelection | null;
  selectedItems: NetworkObjectSelection[];
  setSelection: (selection: NetworkObjectSelection | null) => void;
  setSelectionState: (state: { selection: NetworkObjectSelection | null; selectedItems: NetworkObjectSelection[] }) => void;
  clearSelection: () => void;
}

export const useNetworkObjectSelectionStore = create<NetworkObjectSelectionStore>((set) => ({
  selection: null,
  selectedItems: [],
  setSelection: (selection) => set({
    selection,
    selectedItems: selection ? [selection] : [],
  }),
  setSelectionState: ({ selection, selectedItems }) => set({
    selection,
    selectedItems,
  }),
  clearSelection: () => set({ selection: null, selectedItems: [] }),
}));
