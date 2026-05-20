import { create } from "zustand";

interface RegisterState {
  mode: "create" | "join" | null;
  fullname: string;
  email: string;
  password: string;
  companyName: string;
  companyLocation: string;
  companyLat: number;
  companyLng: number;
  joinCode: string;
  setMode: (mode: "create" | "join" | null) => void;
  setField: <K extends keyof Omit<RegisterState, "setMode" | "setField" | "reset">>(key: K, value: RegisterState[K]) => void;
  reset: () => void;
}

const initial = {
  mode: null as "create" | "join" | null,
  fullname: "",
  email: "",
  password: "",
  companyName: "",
  companyLocation: "",
  companyLat: 0,
  companyLng: 0,
  joinCode: "",
};

export const useRegisterStore = create<RegisterState>((set) => ({
  ...initial,
  setMode: (mode) => set({ mode }),
  setField: (key, value) => set({ [key]: value } as Partial<RegisterState>),
  reset: () => set(initial),
}));
