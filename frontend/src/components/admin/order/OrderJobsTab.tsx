/**
 * Order Jobs Admin Tab
 * View and moderate job postings
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderAPI, OrderJob, OrderJobVisibility } from '@/lib/api/order';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, MoreHorizontal, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';

const VISIBILITY_LABELS: Record<OrderJobVisibility, string> = {
  order_only: 'Order Only',
  order_priority: 'Order Priority',
  public: 'Public',
};

export default function OrderJobsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const pageSize = 25;

  const { data, isLoading, error } = useQuery({
    queryKey: ['orderJobs', page, visibilityFilter, activeFilter],
    queryFn: () => orderAPI.listJobs({
      visibility: visibilityFilter !== 'all' ? visibilityFilter as OrderJobVisibility : undefined,
      active_only: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
      skip: page * pageSize,
      limit: pageSize,
    }),
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ jobId, isActive }: { jobId: number; isActive: boolean }) =>
      orderAPI.updateJob(jobId, { is_active: isActive }),
    onSuccess: () => {
      toast.success('Job updated');
      queryClient.invalidateQueries({ queryKey: ['orderJobs'] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const jobs = data?.jobs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading jobs</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={visibilityFilter} onValueChange={(v) => { setVisibilityFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] bg-charcoal-black border-muted-gray">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Visibility</SelectItem>
            <SelectItem value="order_only">Order Only</SelectItem>
            <SelectItem value="order_priority">Order Priority</SelectItem>
            <SelectItem value="public">Public</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px] bg-charcoal-black border-muted-gray">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-gray flex items-center gap-1">
          <Briefcase className="h-4 w-4" />
          {total} job{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="border border-muted-gray rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-gray py-8">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.location}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{job.job_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{VISIBILITY_LABELS[job.visibility]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-gray">
                    {format(new Date(job.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={job.is_active ? 'default' : 'outline'}>
                      {job.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {job.is_active ? (
                          <DropdownMenuItem onClick={() => updateJobMutation.mutate({ jobId: job.id, isActive: false })}>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateJobMutation.mutate({ jobId: job.id, isActive: true })}>
                            <Eye className="h-4 w-4 mr-2" />
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-gray">Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
