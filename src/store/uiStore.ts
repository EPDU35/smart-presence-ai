import { create } from "zustand";

interface UiState {
  sidebarOpen: boolean;
  darkMode: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
}

// Sidebar ouverte par défaut sur desktop
const defaultOpen = typeof window !== "undefined" && window.innerWidth >= 1024;

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: defaultOpen,
  darkMode: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
}));
