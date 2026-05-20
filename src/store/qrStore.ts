import { create } from "zustand";

interface QrState {
  currentToken: string | null;
  expiresAt: string | null;
  isRefreshing: boolean;
  setToken: (token: string, expiresAt: string) => void;
  clearToken: () => void;
  setRefreshing: (v: boolean) => void;
}

export const useQrStore = create<QrState>((set) => ({
  currentToken: null,
  expiresAt: null,
  isRefreshing: false,
  setToken: (token, expiresAt) => set({ currentToken: token, expiresAt }),
  clearToken: () => set({ currentToken: null, expiresAt: null }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
}));
