'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Card, Input } from '@/components/common/ui';
import { searchRooms } from '@/lib/api/rooms-api';
import { searchUsers } from '@/lib/api/users-api';

export default function DiscoverPage() {
  const [query, setQuery] = useState('');

  const roomResults = useQuery({
    queryKey: ['discover', 'rooms', query],
    queryFn: () => searchRooms({ q: query || 'debate', page: 1, limit: 10 }),
  });

  const userResults = useQuery({
    queryKey: ['discover', 'users', query],
    queryFn: () => searchUsers(query || 'a', 10),
  });

  return (
    <MobileShell title="Kesfet">
      <Card>
        <Input
          placeholder="Konu, oda veya kullanici ara"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Odalar</h2>
        {(roomResults.data?.rooms || []).map((room) => (
          <Link key={room.id} href={`/room/${room.id}`}>
            <Card>
              <p className="font-semibold">{room.title}</p>
              <p className="text-xs text-text/65">
                {String(room.category_name || room.category || 'Genel')}
              </p>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Kisiler</h2>
        {(userResults.data || []).map((user) => (
          <Link
            key={String(user.id)}
            href={`/profile/${encodeURIComponent(String(user.username || 'unknown'))}`}
          >
            <Card>
              <p className="font-semibold">{String(user.displayName || user.display_name || 'Kullanici')}</p>
              <p className="text-xs text-text/65">@{String(user.username || '')}</p>
            </Card>
          </Link>
        ))}
      </section>
    </MobileShell>
  );
}
