import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PartnerApplication } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ViewPartnerApplicationModal from './ViewPartnerApplicationModal';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

type StatusFilter = 'all' | 'new' | 'under_review' | 'approved' | 'rejected';

const fetchApplications = async ({ queryKey }: any): Promise<{ rows: PartnerApplication[]; total: number }> => {
  const [_key, { status, search, page, pageSize }] = queryKey;
  const data = await api.listPartnerApplications({ status: status === 'all' ? undefined : status, search, page, pageSize });
  return { rows: data?.rows || data?.data || [], total: data?.total || (data?.data?.length || 0) };
};

const PartnerApplicationsTab = () => {
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<PartnerApplication | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['partnerApplications', { status, search, page, pageSize }],
    queryFn: fetchApplications,
    keepPreviousData: true,
  });

  // Polling for new applications (replaces real-time)
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['partnerApplications'] });
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [queryClient]);

  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Exclude<StatusFilter, 'all'> }) => {
      return api.updatePartnerApplicationStatus(id, status);
    },
    onSuccess: () => {
      toast.success('Status updated.');
      queryClient.invalidateQueries({ queryKey: ['partnerApplications'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Error updating status'),
  });

  const total = data?.total || 0;
  const rows = data?.rows || [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const statusBadge = (s: PartnerApplication['status']) => {
    const variant = s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary';
    return <Badge variant={variant} className="capitalize">{s.replace('_', ' ')}</Badge>;
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-2">
          {(['all', 'new', 'under_review', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
            <Button
              key={s}
              variant={status === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatus(s); setPage(0); }}
              className="capitalize"
            >
              {s.replace('_', ' ')}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Input
            placeholder="Search name, company, email"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-64"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4">
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <div className="text-red-500 mt-4">Error loading applications: {(error as any).message}</div>
      ) : (
        <>
          <div className="mt-4 border border-muted-gray rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>{app.company_name || app.brand_name}</TableCell>
                    <TableCell>
                      {(app.full_name || app.contact_name) || '—'}
                      {app.contact_email ? ` (${app.contact_email})` : ''}
                    </TableCell>
                    <TableCell>{format(new Date(app.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{statusBadge(app.status)}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedApp(app)}>View</Button>
                      {app.status !== 'approved' && app.status !== 'rejected' && (
                        <>
                          <Button variant="default" size="sm" onClick={() => mutation.mutate({ id: app.id, status: 'under_review' })} disabled={isFetching}>Under Review</Button>
                          <Button variant="default" size="sm" onClick={() => mutation.mutate({ id: app.id, status: 'approved' })} disabled={isFetching}>Approve</Button>
                          <Button variant="destructive" size="sm" onClick={() => mutation.mutate({ id: app.id, status: 'rejected' })} disabled={isFetching}>Reject</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">Total: {total}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
              <div className="text-sm">Page {page + 1} of {totalPages}</div>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page + 1 >= totalPages}>Next</Button>
            </div>
          </div>
        </>
      )}

      {selectedApp && (
        <ViewPartnerApplicationModal
          application={selectedApp}
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ['partnerApplications'] })}
        />
      )}
    </>
  );
};

export default PartnerApplicationsTab;
