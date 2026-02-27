'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { refreshAccessToken } from '@/lib/api/client';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let active = true;

    const ensureSession = async () => {
      if (accessToken) {
        if (active) {
          setSessionChecked(true);
        }
        return;
      }

      setCheckingSession(true);
      const refreshedToken = await refreshAccessToken();
      if (!active) {
        return;
      }

      setCheckingSession(false);
      setSessionChecked(true);

      if (!refreshedToken) {
        router.replace('/login');
      }
    };

    void ensureSession();

    return () => {
      active = false;
    };
  }, [hydrated, accessToken, router]);

  if (!hydrated || checkingSession || !sessionChecked || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-text/80">
        Oturum kontrol ediliyor...
      </div>
    );
  }

  return <>{children}</>;
}
