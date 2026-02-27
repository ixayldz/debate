'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { refreshAccessToken } from '@/lib/api/client';
import { getMe } from '@/lib/api/users-api';

export function HydrationMarker() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const updateUser = useAuthStore((state) => state.updateUser);

  useEffect(() => {
    if (hydrated) {
      return;
    }

    let active = true;

    const restoreSession = async () => {
      if (!accessToken) {
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

      if (active) {
        setHydrated(true);
      }
    };

    void restoreSession();

    return () => {
      active = false;
    };
  }, [accessToken, hydrated, setHydrated, updateUser]);

  return null;
}
