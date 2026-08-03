import { create } from "zustand";

interface ModuleNavigationState {
  pendingLevelId: string | null;
  pendingModuleNo: number | null;
  startModuleNavigation: (levelId: string, moduleNo: number) => void;
  clearModuleNavigation: () => void;
}

export const useModuleNavigationStore = create<ModuleNavigationState>((set) => ({
  pendingLevelId: null,
  pendingModuleNo: null,
  startModuleNavigation: (levelId, moduleNo) =>
    set({ pendingLevelId: levelId, pendingModuleNo: moduleNo }),
  clearModuleNavigation: () => set({ pendingLevelId: null, pendingModuleNo: null }),
}));
