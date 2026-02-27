'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeOAuthCode } from '@/lib/api/auth-api';
import { getMe } from '@/lib/api/users-api';
import { useAuthStore } from '@/lib/stores/auth-store';

export function OAuthCallbackClient() {
  const params = useSearchParams();
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [status, setStatus] = useState('Authorizing...');

  useEffect(() => {
    const oauthError = params.get('error');
    if (oauthError) {
      setStatus(oauthError);
      return;
    }

    const code = params.get('code');

    if (!code) {
      setStatus('OAuth code is missing.');
      return;
    }

    let active = true;

    const completeOAuth = async () => {
      try {
        const tokens = await exchangeOAuthCode(code);
        if (!active) {
          return;
        }

        setSession(tokens.accessToken, null);

        try {
          const me = await getMe();
          if (!active) {
            return;
          }
          setSession(tokens.accessToken, {
            id: me.id,
            username: me.username,
            displayName: me.displayName,
            email: me.email,
            avatarUrl: me.avatarUrl,
            language: me.language,
          });
        } catch {
          // Session is already set with tokens, UI can fetch profile lazily.
        }

        router.replace('/hall');
      } catch (error) {
        if (!active) {
          return;
        }
        setStatus(error instanceof Error ? error.message : 'OAuth login failed.');
      }
    };

    void completeOAuth();

    return () => {
      active = false;
    };
  }, [params, router, setSession]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[450px] items-center justify-center px-4">
      <div className="soft-card w-full p-6 text-center">
        <h1 className="font-display text-2xl">OAuth</h1>
        <p className="mt-2 text-sm text-text/75">{status}</p>
      </div>
    </div>
  );
}
