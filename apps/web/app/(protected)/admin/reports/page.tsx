'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Button, Card } from '@/components/common/ui';
import { dismissReport, listReports, resolveReport } from '@/lib/api/moderation-api';
import type { ReportStatus } from '@/lib/api/types';

const statusOptions: Array<ReportStatus | 'all'> = ['all', 'pending', 'under_review', 'resolved', 'dismissed'];

export default function AdminReportsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus | 'all'>('pending');
  const [message, setMessage] = useState('');

  const reportsQuery = useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => listReports({ status: status === 'all' ? undefined : status, page: 1, limit: 50 }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveReport(id),
    onSuccess: () => {
      setMessage('Report resolved.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Resolve failed.');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissReport(id),
    onSuccess: () => {
      setMessage('Report dismissed.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Dismiss failed.');
    },
  });

  return (
    <MobileShell title="Admin Reports">
      <Card className="space-y-2">
        <h2 className="font-semibold">Status Filter</h2>
        <div className="grid grid-cols-3 gap-2">
          {statusOptions.map((item) => (
            <Button
              key={item}
              type="button"
              className={status === item ? '' : 'bg-muted'}
              onClick={() => setStatus(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </Card>

      {message ? <Card className="text-xs text-text/70">{message}</Card> : null}

      {reportsQuery.isLoading ? <Card>Loading reports...</Card> : null}

      {(reportsQuery.data?.reports || []).map((report) => (
        <Card key={report.id} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">#{report.id} | {report.reason}</p>
              <p className="text-xs text-text/65">
                Status: {report.status} | Reporter: {report.reporterUsername || report.reporterId}
              </p>
              <p className="text-xs text-text/65">
                Target: {report.reportedUsername || (report.reportedUserId ? `user:${report.reportedUserId}` : 'room')}
              </p>
            </div>
            <span className="text-[11px] text-text/50">
              {new Date(report.createdAt).toLocaleString('tr-TR')}
            </span>
          </div>
          {report.description ? <p className="text-xs text-text/75">{report.description}</p> : null}

          {report.status === 'pending' || report.status === 'under_review' ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="py-2 text-xs"
                onClick={() => resolveMutation.mutate(String(report.id))}
                disabled={resolveMutation.isPending}
              >
                Resolve
              </Button>
              <Button
                type="button"
                className="py-2 text-xs bg-muted"
                onClick={() => dismissMutation.mutate(String(report.id))}
                disabled={dismissMutation.isPending}
              >
                Dismiss
              </Button>
            </div>
          ) : null}
        </Card>
      ))}

      {!reportsQuery.isLoading && (reportsQuery.data?.reports || []).length === 0 ? (
        <Card>No reports found for selected status.</Card>
      ) : null}
    </MobileShell>
  );
}
