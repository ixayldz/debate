'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthUser } from '@/lib/api/types';

interface AuthState {
  accessToken?: string;
  user?: AuthUser | null;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setSession: (accessToken: string, user?: AuthUser | null) => void;
  updateAccessToken: (accessToken: string) => void;
  updateUser: (user: AuthUser | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: undefined,
      user: null,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setSession: (accessToken, user = null) =>
        set({
          accessToken,
          user,
        }),
      updateAccessToken: (accessToken) => set({ accessToken }),
      updateUser: (user) => set({ user }),
      clearSession: () =>
        set({
          accessToken: undefined,
          user: null,
        }),
    }),
    {
      name: 'debate-web-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
