'use client';

import Link from 'next/link';
import { useState } from 'react';
import { requestPasswordReset } from '@/lib/api/auth-api';
import { Button, Input } from '@/components/common/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus('');
    try {
      await requestPasswordReset(email);
      setStatus('If this email exists, reset instructions were sent.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl">Sifre Sifirla</h1>
        <p className="text-sm text-text/70">E-posta adresini gir, sifirlama linki gonderelim.</p>
      </div>

      <form className="space-y-3" onSubmit={submit}>
        <Input
          type="email"
          placeholder="E-posta"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {status ? <p className="text-xs text-text/70">{status}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Gonderiliyor...' : 'Link Gonder'}
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
