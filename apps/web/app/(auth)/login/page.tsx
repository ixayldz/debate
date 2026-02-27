'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOAuthUrl, login } from '@/lib/api/auth-api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button, Input } from '@/components/common/ui';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'twitter' | ''>('');
  const [error, setError] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await login({ email, password });
      if (!response.accessToken) {
        setError('Hesap dogrulama tamamlanmadi. Email/telefon onayi gerekli olabilir.');
        return;
      }

      setSession(response.accessToken, response.user);
      router.push('/hall');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Giris basarisiz';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = async (provider: 'google' | 'twitter') => {
    setOauthLoading(provider);
    setError('');
    try {
      const { url } = await getOAuthUrl(provider, 'web_login');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth baslatilamadi');
      setOauthLoading('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl">Giris Yap</h1>
        <p className="text-sm text-text/70">Debate odalarina baglanmak icin giris yap.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          type="email"
          placeholder="E-posta"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Sifre"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Giris yapiliyor...' : 'Giris Yap'}
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="bg-muted"
          disabled={oauthLoading !== ''}
          onClick={() => void startOAuth('google')}
        >
          {oauthLoading === 'google' ? 'Yonlendiriliyor...' : 'Google'}
        </Button>
        <Button
          type="button"
          className="bg-muted"
          disabled={oauthLoading !== ''}
          onClick={() => void startOAuth('twitter')}
        >
          {oauthLoading === 'twitter' ? 'Yonlendiriliyor...' : 'X'}
        </Button>
      </div>

      <div className="grid gap-2 text-center text-sm">
        <Link className="underline underline-offset-2" href="/phone">
          Telefon ile giris
        </Link>
        <Link className="underline underline-offset-2" href="/auth/forgot-password">
          Sifremi unuttum
        </Link>
        <Link className="underline underline-offset-2" href="/register">
          Hesabin yok mu? Kayit ol
        </Link>
      </div>
    </div>
  );
}
