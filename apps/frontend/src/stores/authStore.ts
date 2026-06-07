import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ILoginUser } from '@noteapp/shared';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: ILoginUser | null;
  setAuth: (accessToken: string, refreshToken: string, user: ILoginUser) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'noteapp-auth' },
  ),
);
