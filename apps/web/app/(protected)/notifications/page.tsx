'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Button, Card } from '@/components/common/ui';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api/users-api';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(1, 50),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <MobileShell
      title="Bildirimler"
      rightAction={
        <button
          type="button"
          className="rounded-full border border-border bg-muted p-2"
          onClick={() => readAllMutation.mutate()}
        >
          <BellRing className="h-4 w-4" />
        </button>
      }
    >
      <Card className="text-sm text-text/75">
        Okunmamis: {notificationsQuery.data?.unreadCount ?? 0}
      </Card>

      {(notificationsQuery.data?.notifications || []).map((item) => (
        <Card key={item.id} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-text/65">{item.message}</p>
            </div>
            <span className="text-[11px] text-text/50">
              {new Date(item.created_at).toLocaleString('tr-TR')}
            </span>
          </div>
          {!item.is_read ? (
            <Button
              type="button"
              className="py-2 text-xs"
              onClick={() => readMutation.mutate(String(item.id))}
              disabled={readMutation.isPending}
            >
              Okundu Isaretle
            </Button>
          ) : null}
        </Card>
      ))}
    </MobileShell>
  );
}
