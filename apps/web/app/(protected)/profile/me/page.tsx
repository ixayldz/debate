'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Button, Card, Input } from '@/components/common/ui';
import { getMe, getMyRooms, updateMe } from '@/lib/api/users-api';

export default function MyProfilePage() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe(),
  });
  const myRoomsQuery = useQuery({
    queryKey: ['me', 'rooms'],
    queryFn: () => getMyRooms(),
  });

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!meQuery.data) {
      return;
    }
    setDisplayName(meQuery.data.displayName || '');
    setBio(meQuery.data.bio || '');
  }, [meQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => updateMe({ displayName: displayName || undefined, bio: bio || undefined }),
    onSuccess: () => {
      setStatus('Profile updated.');
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error) => {
      setStatus(error instanceof Error ? error.message : 'Profile update failed.');
    },
  });

  const user = meQuery.data;

  return (
    <MobileShell title="Profil">
      <Card className="space-y-2 text-center">
        <div className="mx-auto h-20 w-20 rounded-full border border-border bg-muted" />
        <h2 className="font-display text-2xl">{user?.displayName || 'Kullanici'}</h2>
        <p className="text-sm text-text/65">@{user?.username || 'username'}</p>
        <p className="text-sm text-text/70">{user?.bio || 'Profil biyografisi henuz girilmedi.'}</p>
      </Card>

      <Card className="space-y-2">
        <h3 className="font-semibold">Profili Duzenle</h3>
        <Input
          placeholder="Gorunen ad"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <Input
          placeholder="Bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
        {status ? <p className="text-xs text-text/70">{status}</p> : null}
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Kaydediliyor...' : 'Guncelle'}
        </Button>
      </Card>

      <Card className="space-y-2">
        <h3 className="font-semibold">Acdigim Odalar</h3>
        {(myRoomsQuery.data || []).map((room) => (
          <Link key={String(room.id)} href={`/room/${String(room.id)}`}>
            <div className="rounded-xl border border-border bg-base px-3 py-2">
              <p className="text-sm font-medium">{String(room.title)}</p>
              <p className="text-xs text-text/65">{String(room.status || '')}</p>
            </div>
          </Link>
        ))}
      </Card>
    </MobileShell>
  );
}
