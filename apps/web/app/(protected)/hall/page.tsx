'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import {
  createRoom,
  getCategories,
  getFeaturedRooms,
  getTrendingRooms,
  listRooms,
} from '@/lib/api/rooms-api';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Button, Card, Input } from '@/components/common/ui';

export default function HallPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');

  const roomsQuery = useQuery({
    queryKey: ['rooms', search, category],
    queryFn: () => listRooms({ page: 1, limit: 20, category: category || undefined }),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const categoriesQuery = useQuery({
    queryKey: ['rooms', 'categories'],
    queryFn: () => getCategories(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const featuredQuery = useQuery({
    queryKey: ['rooms', 'featured'],
    queryFn: () => getFeaturedRooms(6),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const trendingQuery = useQuery({
    queryKey: ['rooms', 'trending'],
    queryFn: () => getTrendingRooms(6),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createRoom({
        title: newRoomTitle.trim(),
        language: 'tr',
        visibility: 'public',
        maxSpeakers: 6,
        micRequestsEnabled: true,
        category: category || undefined,
      }),
    onSuccess: (room) => {
      setNewRoomTitle('');
      setShowCreate(false);
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'featured'] });
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'trending'] });
      if (room?.id) {
        router.push(`/room/${room.id}`);
      }
    },
  });

  const filteredRooms = useMemo(() => {
    const items = roomsQuery.data?.data || [];
    if (!search.trim()) {
      return items;
    }
    const q = search.toLowerCase();
    return items.filter((room) => room.title.toLowerCase().includes(q));
  }, [roomsQuery.data, search]);

  return (
    <MobileShell
      title="Ana Sayfa"
      rightAction={
        <button
          onClick={() => setShowCreate((prev) => !prev)}
          className="rounded-full border border-border bg-muted p-2"
          type="button"
        >
          <Plus className="h-4 w-4" />
        </button>
      }
    >
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-text/70" />
          <Input
            className="border-none bg-transparent p-0 focus:ring-0"
            placeholder="Oda ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className="w-full rounded-full border border-border bg-card px-4 py-3 text-sm outline-none focus:border-text/40 focus:ring-2 focus:ring-accent/50"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">Tum kategoriler</option>
          {(categoriesQuery.data || []).map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </Card>

      {showCreate ? (
        <Card className="space-y-2">
          <h2 className="font-semibold">Yeni Oda Ac</h2>
          <Input
            placeholder="Oda basligi"
            value={newRoomTitle}
            onChange={(event) => setNewRoomTitle(event.target.value)}
          />
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !newRoomTitle.trim()}
          >
            {createMutation.isPending ? 'Olusturuluyor...' : 'Oda Ac'}
          </Button>
        </Card>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-xl">Canli Odalar</h2>
        {roomsQuery.isLoading ? <Card>Yukleniyor...</Card> : null}
        {filteredRooms.map((room) => (
          <Link key={room.id} href={`/room/${room.id}`}>
            <Card className="transition hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{room.title}</p>
                  <p className="text-xs text-text/65">
                    {(room.category || 'Genel')} | {(room.language || 'tr').toUpperCase()} | {room.status}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[11px]">{room.visibility}</span>
              </div>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">One Cikanlar</h2>
        <div className="grid grid-cols-1 gap-2">
          {(featuredQuery.data || []).map((item) => (
            <Link key={`featured-${item.id}`} href={`/room/${item.id}`}>
              <Card className="text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-text/65">
                  {(item.category || 'Genel')} | owner: {(item.createdBy?.displayName || item.createdBy?.display_name || 'unknown')}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Trend</h2>
        <div className="grid grid-cols-1 gap-2">
          {(trendingQuery.data || []).map((item) => (
            <Link key={`trending-${item.id}`} href={`/room/${item.id}`}>
              <Card className="text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-text/65">{item.status} | {(item.category || 'Genel')}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </MobileShell>
  );
}
