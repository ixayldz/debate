'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { verifyEmail } from '@/lib/api/auth-api';
import { Button } from '@/components/common/ui';

export function VerifyEmailClient({ token }: { token: string }) {
  const [status, setStatus] = useState('Email dogrulaniyor...');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    const execute = async () => {
      if (!token) {
        setStatus('Dogrulama tokeni bulunamadi.');
        return;
      }

      try {
        await verifyEmail(token);
        if (!active) {
          return;
        }
        setDone(true);
        setStatus('Email dogrulandi. Artik giris yapabilirsin.');
      } catch (error) {
        if (!active) {
          return;
        }
        setStatus(error instanceof Error ? error.message : 'Email dogrulama basarisiz.');
      }
    };

    void execute();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-1">
        <h1 className="font-display text-3xl">Email Dogrulama</h1>
        <p className="text-sm text-text/70">{status}</p>
      </div>
      <Button type="button" className={done ? '' : 'bg-muted'}>
        <Link href="/login">Giris Sayfasina Git</Link>
      </Button>
    </div>
  );
}
