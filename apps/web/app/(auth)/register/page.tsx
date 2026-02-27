'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getOAuthUrl, register } from '@/lib/api/auth-api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button, Input } from '@/components/common/ui';

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [form, setForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'twitter' | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const username = form.username.trim();
    const displayName = form.displayName.trim();
    const email = form.email.trim();
    const password = form.password;

    if (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Kullanici adi 3-30 karakter olmali; sadece harf, rakam ve _ kullanilabilir.');
      setLoading(false);
      return;
    }

    if (displayName.length < 1 || displayName.length > 50) {
      setError('Gorunen ad 1-50 karakter olmali.');
      setLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Gecerli bir e-posta adresi gir.');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Sifre en az 8 karakter olmali.');
      setLoading(false);
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError('Sifre buyuk harf, kucuk harf ve rakam icermeli.');
      setLoading(false);
      return;
    }

    try {
      const response = await register({
        username,
        displayName,
        email,
        password,
        language: 'tr',
      });

      if (response.accessToken) {
        setSession(response.accessToken, response.user);
        router.push('/hall');
        return;
      }

      setMessage('Kayit tamamlandi. E-posta dogrulamasi gerekiyorsa gelen kutunu kontrol et.');
    } catch (err) {
      const backendMessage = err instanceof Error ? err.message : 'Kayit islemi basarisiz';
      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = async (provider: 'google' | 'twitter') => {
    setOauthLoading(provider);
    setError('');
    try {
      const { url } = await getOAuthUrl(provider, 'web_register');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth baslatilamadi');
      setOauthLoading('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl">Kayit Ol</h1>
        <p className="text-sm text-text/70">Debate hesabini olustur.</p>
        <p className="text-xs text-text/60">E-posta ile kayit olustur.</p>
      </div>

      <form className="space-y-3" onSubmit={onSubmit}>
        <Input
          placeholder="Kullanici adi"
          autoComplete="username"
          value={form.username}
          onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
          required
        />
        <Input
          placeholder="Gorunen ad"
          autoComplete="name"
          value={form.displayName}
          onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
          required
        />
        <Input
          type="email"
          placeholder="E-posta"
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          required
        />
        <Input
          type="password"
          placeholder="Sifre"
          autoComplete="new-password"
          minLength={8}
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          required
        />
        <p className="text-[11px] text-text/60">
          Sifre en az 8 karakter olmali ve buyuk harf, kucuk harf, rakam icermeli.
        </p>
        {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Kaydediliyor...' : 'Kayit Ol'}
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

      <div className="text-center text-sm">
        <Link href="/login" className="underline underline-offset-2">
          Zaten hesabin var mi? Giris yap
        </Link>
      </div>
    </div>
  );
}
