'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function HomePage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (accessToken) {
      router.replace('/hall');
    } else {
      router.replace('/login');
    }
  }, [hydrated, accessToken, router]);

  return <div className="flex min-h-screen items-center justify-center text-text">Yukleniyor...</div>;
}
