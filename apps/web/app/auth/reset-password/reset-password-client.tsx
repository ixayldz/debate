'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPasswordReset } from '@/lib/api/auth-api';
import { Button, Input } from '@/components/common/ui';

export function ResetPasswordClient({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setStatus('Token eksik veya gecersiz.');
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      await confirmPasswordReset(token, password);
      setStatus('Sifre guncellendi. Giris sayfasina yonlendiriliyorsun...');
      setTimeout(() => router.replace('/login'), 1000);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Sifre sifirlama basarisiz.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl">Yeni Sifre</h1>
        <p className="text-sm text-text/70">Hesabin icin yeni sifreni belirle.</p>
      </div>

      <form className="space-y-3" onSubmit={submit}>
        <Input
          type="password"
          placeholder="Yeni sifre"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {status ? <p className="text-xs text-text/70">{status}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Kaydediliyor...' : 'Sifreyi Guncelle'}
        </Button>
      </form>

      <div className="text-center text-sm">
        <Link href="/login" className="underline underline-offset-2">
          Giris sayfasina don
        </Link>
      </div>
    </div>
  );
}
