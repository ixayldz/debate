'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Card, Input } from '@/components/common/ui';
import { searchUsers } from '@/lib/api/users-api';

export default function MessagesPage() {
  const [query, setQuery] = useState('');

  const usersQuery = useQuery({
    queryKey: ['messages', 'user-search', query],
    queryFn: () => searchUsers(query || 'a', 20),
  });

  return (
    <MobileShell title="Ozel Mesajlar">
      <Card className="space-y-2">
        <h2 className="font-semibold">Mesajlar</h2>
        <Input
          placeholder="Kisi ara"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      <Card className="space-y-2">
        <p className="text-sm text-text/70">
          Bu backend surumunde dogrudan mesaj endpointi tanimli degil. Bu ekran sadece mevcut
          kullanici listesinden kisi kesfi icin kullanilir.
        </p>
        {(usersQuery.data || []).slice(0, 8).map((user) => (
          <div key={String(user.id)} className="rounded-2xl border border-border bg-base px-3 py-2">
            <p className="text-sm font-medium">{String(user.displayName || user.display_name || 'Kullanici')}</p>
            <p className="text-xs text-text/60">@{String(user.username || '')}</p>
          </div>
        ))}
      </Card>
    </MobileShell>
  );
}
