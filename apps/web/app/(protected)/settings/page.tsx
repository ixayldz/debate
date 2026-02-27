'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Settings2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Button, Card, Input } from '@/components/common/ui';
import { logout } from '@/lib/api/auth-api';
import { updateMe } from '@/lib/api/users-api';
import { useAuthStore } from '@/lib/stores/auth-store';

const menuItems = [
  { label: 'Hesap Ayarlari', href: '/profile/me' },
  { label: 'Bildirimler', href: '/notifications' },
  { label: 'Kesfet', href: '/discover' },
  { label: 'Rapor Konsolu', href: '/admin/reports' },
  { label: 'Audit Logs', href: '/admin/audit' },
  { label: 'Yardim ve Destek', href: '/hall' },
];

export default function SettingsPage() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const [bio, setBio] = useState('');

  const updateMutation = useMutation({
    mutationFn: () => updateMe({ language, bio }),
  });

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      clearSession();
      router.replace('/login');
    },
  });

  return (
    <MobileShell title="Ayarlar" rightAction={<Settings2 className="h-5 w-5" />}>
      <Card className="space-y-3">
        {menuItems.map((item) => (
          <Link key={item.label} href={item.href}>
            <div className="flex items-center justify-between rounded-xl border border-border bg-base px-3 py-2 text-sm">
              <span>{item.label}</span>
              <span className="text-text/50">{'>'}</span>
            </div>
          </Link>
        ))}
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Profil Tercihleri</h2>
        <Input
          placeholder={`Bio (${user?.username || 'kullanici'})`}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className={language === 'tr' ? '' : 'bg-muted'}
            onClick={() => setLanguage('tr')}
          >
            Turkce
          </Button>
          <Button
            type="button"
            className={language === 'en' ? '' : 'bg-muted'}
            onClick={() => setLanguage('en')}
          >
            English
          </Button>
        </div>
        <Button type="button" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </Card>

      <Button
        type="button"
        className="flex items-center justify-center gap-2 bg-[#dbcab0]"
        onClick={() => logoutMutation.mutate()}
      >
        <LogOut className="h-4 w-4" />
        Cikis Yap
      </Button>
    </MobileShell>
  );
}
