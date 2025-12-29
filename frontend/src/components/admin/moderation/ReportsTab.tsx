import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const PAGE_SIZE = 25;

interface ContentReport {
  id: string;
  content_type: string;
  content_id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  profiles?: {
    full_name: string;
    username: string;
  };
}

const ReportsTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-content-reports', page, statusFilter],
    queryFn: () => api.listContentReportsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  });

  const reports = data?.reports || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const resolveMutation = useMutation({
    mutationFn: ({ reportId, notes }: { reportId: string; notes?: string }) =>
      api.resolveContentReportAdmin(reportId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-content-reports'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      toast.success('Report resolved');
      setSelectedReport(null);
      setResolutionNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resolve report');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ reportId, notes }: { reportId: string; notes?: string }) =>
      api.dismissContentReportAdmin(reportId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-content-reports'] });
      queryClient.invalidateQueries({ queryKey: ['report-stats'] });
      toast.success('Report dismissed');
      setSelectedReport(null);
      setResolutionNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to dismiss report');
    },
  });

  const getReasonBadge = (reason: string) => {
    const colors: Record<string, string> = {
      'spam': 'bg-orange-500/20 text-orange-400',
      'harassment': 'bg-red-500/20 text-red-400',
      'inappropriate': 'bg-yellow-500/20 text-yellow-400',
      'copyright': 'bg-blue-500/20 text-blue-400',
      'other': 'bg-zinc-500/20 text-zinc-400',
    };
    return colors[reason] || 'bg-zinc-500/20 text-zinc-400';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
      'reviewing': 'bg-blue-500/20 text-blue-400 border-blue-500',
      'resolved': 'bg-green-500/20 text-green-400 border-green-500',
      'dismissed': 'bg-zinc-500/20 text-zinc-400 border-zinc-500',
    };
    return colors[status] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Content Reports</h2>
        <Select value={statusFilter} onValueChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}>
          <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">Content Type</TableHead>
              <TableHead className="text-zinc-400">Reason</TableHead>
              <TableHead className="text-zinc-400">Reported By</TableHead>
              <TableHead className="text-zinc-400">Reported</TableHead>
              <TableHead className="text-zinc-400 text-center">Status</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-zinc-400">
                  No reports found
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.id} className="border-zinc-800 hover:bg-zinc-900/50">
                  <TableCell className="font-medium text-white capitalize">
                    {report.content_type}
                  </TableCell>
                  <TableCell>
                    <Badge className={getReasonBadge(report.reason)}>
                      {report.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {report.profiles?.full_name || report.profiles?.username || 'Anonymous'}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={getStatusBadge(report.status)}>
                      {report.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedReport(report)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {report.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resolveMutation.mutate({ reportId: report.id })}
                            title="Resolve"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismissMutation.mutate({ reportId: report.id })}
                            title="Dismiss"
                          >
                            <XCircle className="h-4 w-4 text-zinc-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">
            Showing {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Report Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Report Details</DialogTitle>
            <DialogDescription>
              Review the report and take action
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-400">Content Type:</span>
                  <p className="text-white capitalize">{selectedReport.content_type}</p>
                </div>
                <div>
                  <span className="text-zinc-400">Reason:</span>
                  <Badge className={getReasonBadge(selectedReport.reason)}>
                    {selectedReport.reason}
                  </Badge>
                </div>
                <div>
                  <span className="text-zinc-400">Reported By:</span>
                  <p className="text-white">{selectedReport.profiles?.full_name || 'Anonymous'}</p>
                </div>
                <div>
                  <span className="text-zinc-400">Status:</span>
                  <Badge variant="outline" className={getStatusBadge(selectedReport.status)}>
                    {selectedReport.status}
                  </Badge>
                </div>
              </div>

              {selectedReport.details && (
                <div>
                  <span className="text-zinc-400 text-sm">Details:</span>
                  <p className="text-white bg-zinc-800 p-3 rounded mt-1">
                    {selectedReport.details}
                  </p>
                </div>
              )}

              {selectedReport.status === 'pending' && (
                <div className="space-y-2">
                  <Label htmlFor="notes">Resolution Notes</Label>
                  <Textarea
                    id="notes"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Add notes about the action taken..."
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              Close
            </Button>
            {selectedReport?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => dismissMutation.mutate({
                    reportId: selectedReport.id,
                    notes: resolutionNotes
                  })}
                  disabled={dismissMutation.isPending}
                >
                  Dismiss
                </Button>
                <Button
                  onClick={() => resolveMutation.mutate({
                    reportId: selectedReport.id,
                    notes: resolutionNotes
                  })}
                  disabled={resolveMutation.isPending}
                >
                  {resolveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Resolve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsTab;
