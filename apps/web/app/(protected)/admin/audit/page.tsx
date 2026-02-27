'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Button, Card, Input } from '@/components/common/ui';
import { getRoomAudit, getUserAudit } from '@/lib/api/moderation-api';
import type { AuditLogItem } from '@/lib/api/types';

type AuditMode = 'room' | 'user';

export default function AdminAuditPage() {
  const [mode, setMode] = useState<AuditMode>('room');
  const [targetId, setTargetId] = useState('');
  const [limit, setLimit] = useState('100');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [errorText, setErrorText] = useState('');

  const fetchMutation = useMutation({
    mutationFn: async () => {
      const parsedLimit = Number(limit) || 100;
      if (mode === 'room') {
        return getRoomAudit(targetId, parsedLimit);
      }
      return getUserAudit(targetId, parsedLimit);
    },
    onSuccess: (data) => {
      setErrorText('');
      setLogs(data);
    },
    onError: (error) => {
      setLogs([]);
      setErrorText(error instanceof Error ? error.message : 'Audit lookup failed.');
    },
  });

  return (
    <MobileShell title="Admin Audit">
      <Card className="space-y-2">
        <h2 className="font-semibold">Audit Query</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className={mode === 'room' ? '' : 'bg-muted'}
            onClick={() => setMode('room')}
          >
            Room Logs
          </Button>
          <Button
            type="button"
            className={mode === 'user' ? '' : 'bg-muted'}
            onClick={() => setMode('user')}
          >
            User Logs
          </Button>
        </div>
        <Input
          placeholder={mode === 'room' ? 'Room id' : 'User id'}
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        />
        <Input
          placeholder="Limit (max 100)"
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
        />
        <Button
          type="button"
          onClick={() => fetchMutation.mutate()}
          disabled={fetchMutation.isPending || !targetId.trim()}
        >
          {fetchMutation.isPending ? 'Loading...' : 'Fetch Logs'}
        </Button>
        {errorText ? <p className="text-xs text-red-600">{errorText}</p> : null}
      </Card>

      {logs.map((entry) => (
        <Card key={entry.id} className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{entry.action}</p>
            <span className="text-[11px] text-text/50">
              {new Date(entry.createdAt).toLocaleString('tr-TR')}
            </span>
          </div>
          <p className="text-xs text-text/65">
            actor: {entry.actorUsername || entry.actorId || 'system'} | target: {entry.targetUsername || entry.targetId || '-'}
          </p>
          <p className="text-xs text-text/65">room: {entry.roomTitle || entry.roomId || '-'}</p>
          {entry.metadata ? (
            <pre className="overflow-x-auto rounded-xl border border-border bg-base p-2 text-[11px]">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          ) : null}
        </Card>
      ))}

      {!fetchMutation.isPending && logs.length === 0 && !errorText ? (
        <Card>No audit logs loaded yet.</Card>
      ) : null}
    </MobileShell>
  );
}
