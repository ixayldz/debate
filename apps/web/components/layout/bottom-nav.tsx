'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Compass, Home, MessageCircle, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const navItems = [
  { href: '/hall', label: 'Hall', icon: Home },
  { href: '/discover', label: 'Kesfet', icon: Compass },
  { href: '/messages', label: 'Mesaj', icon: MessageCircle },
  { href: '/notifications', label: 'Bildirim', icon: Bell },
  { href: '/profile/me', label: 'Profil', icon: User },
  { href: '/settings', label: 'Ayar', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 mt-3 rounded-full border border-border bg-card/95 p-1 backdrop-blur">
      <ul className="grid grid-cols-6 gap-1">
        {navItems.map((item) => {
          const active = item.href === '/profile/me'
            ? pathname?.startsWith('/profile')
            : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center rounded-full px-2 py-2 text-[11px] transition',
                  active ? 'bg-accent text-text font-semibold' : 'text-text/70 hover:bg-muted'
                )}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
