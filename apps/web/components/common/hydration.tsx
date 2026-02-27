'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { refreshAccessToken } from '@/lib/api/client';
import { getMe } from '@/lib/api/users-api';

export function HydrationMarker() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  useEffect(() => {
    // Wait until persist rehydration finishes before deciding auth restore flow.
    if (!hydrated) {
      return;
    }

    let active = true;

    const restoreSession = async () => {
      // Avoid noisy refresh attempts for brand-new visitors with no prior session signal.
      if (!accessToken && user) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          try {
            const me = await getMe();
            if (!active) {
              return;
            }

            updateUser({
              id: me.id,
              username: me.username,
              displayName: me.displayName,
              email: me.email,
              avatarUrl: me.avatarUrl,
              language: me.language,
            });
          } catch {
            // profile can be fetched lazily by pages if needed
          }
        }
      }
    };

    void restoreSession();

    return () => {
      active = false;
    };
  }, [accessToken, hydrated, updateUser, user]);

  return null;
}
