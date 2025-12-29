import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users } from 'lucide-react';
import ViewOrderApplicationModal from './ViewOrderApplicationModal';

export interface OrderApplication {
  id: number;
  user_id: string;
  primary_track: string;
  city?: string;
  region?: string;
  portfolio_links?: string;
  statement?: string;
  years_experience?: number;
  current_role?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_id?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  applicant_name?: string;
  applicant_email?: string;
}

const TRACK_LABELS: Record<string, string> = {
  director: 'Director',
  producer: 'Producer',
  cinematographer: 'Cinematographer',
  editor: 'Editor',
  writer: 'Writer',
  sound: 'Sound',
  production_design: 'Production Design',
  vfx: 'VFX',
  music: 'Music',
  actor: 'Actor',
  other: 'Other',
};

const OrderApplicationsTab = () => {
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<OrderApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['orderApplications', statusFilter],
    queryFn: () => api.listOrderApplications(statusFilter === 'all' ? undefined : statusFilter),
  });

  const applications = response?.applications || [];

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.approveOrderApplication(id),
    onSuccess: () => {
      toast.success('Application approved successfully');
      queryClient.invalidateQueries({ queryKey: ['orderApplications'] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      api.rejectOrderApplication(id, reason),
    onSuccess: () => {
      toast.success('Application rejected');
      queryClient.invalidateQueries({ queryKey: ['orderApplications'] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const filteredApplications = applications.filter((app) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      app.applicant_name?.toLowerCase().includes(term) ||
      app.applicant_email?.toLowerCase().includes(term) ||
      app.primary_track?.toLowerCase().includes(term)
    );
  });

  if (isLoading) {
    return (
      <div className="mt-4 space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 mt-4">
        Error loading applications: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mt-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            placeholder="Search by name, email, or track..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-charcoal-black border-muted-gray"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-charcoal-black border-muted-gray">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 mb-4 text-muted-gray text-sm">
        <Users className="h-4 w-4" />
        <span>
          {filteredApplications.length} application{filteredApplications.length !== 1 ? 's' : ''}
          {statusFilter !== 'all' && ` (${statusFilter})`}
        </span>
      </div>

      {/* Table */}
      <div className="border border-muted-gray rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Primary Track</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApplications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-gray py-8">
                  No applications found
                </TableCell>
              </TableRow>
            ) : (
              filteredApplications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">
                    {app.applicant_name || 'Unknown'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {app.applicant_email || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {TRACK_LABELS[app.primary_track] || app.primary_track}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(app.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        app.status === 'approved'
                          ? 'default'
                          : app.status === 'rejected'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="capitalize"
                    >
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedApp(app)}
                    >
                      View
                    </Button>
                    {app.status === 'pending' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => approveMutation.mutate(app.id)}
                          disabled={approveMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => rejectMutation.mutate({ id: app.id })}
                          disabled={rejectMutation.isPending}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Modal */}
      {selectedApp && (
        <ViewOrderApplicationModal
          application={selectedApp}
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          onApprove={() => {
            approveMutation.mutate(selectedApp.id);
            setSelectedApp(null);
          }}
          onReject={(reason) => {
            rejectMutation.mutate({ id: selectedApp.id, reason });
            setSelectedApp(null);
          }}
        />
      )}
    </>
  );
};

export default OrderApplicationsTab;
