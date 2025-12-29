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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Loader2, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  AlertTriangle, MessageSquare, Flag, Ban
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import ForumBanDialog from './ForumBanDialog';

const PAGE_SIZE = 20;

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  spam: { label: 'Spam', color: 'bg-yellow-500' },
  harassment: { label: 'Harassment', color: 'bg-red-500' },
  inappropriate: { label: 'Inappropriate', color: 'bg-orange-500' },
  copyright: { label: 'Copyright', color: 'bg-purple-500' },
  other: { label: 'Other', color: 'bg-gray-500' },
};

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'destructive' },
  resolved: { label: 'Resolved', variant: 'default' },
  dismissed: { label: 'Dismissed', variant: 'secondary' },
};

const ReportsAdminTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [banDialogUser, setBanDialogUser] = useState<{ id: string; name: string } | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['admin-report-stats'],
    queryFn: () => api.getReportStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-community-reports', page, statusFilter, contentTypeFilter],
    queryFn: () => api.listReportsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      content_type: contentTypeFilter !== 'all' ? contentTypeFilter : undefined,
    }),
  });

  const reports = data?.reports || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const resolveMutation = useMutation({
    mutationFn: ({ reportId, notes, action }: { reportId: string; notes?: string; action?: string }) =>
      api.resolveContentReportAdmin(reportId, notes, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-stats'] });
      toast.success('Report resolved');
      setSelectedReport(null);
      setResolutionNotes('');
      setActionTaken('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resolve report');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ reportId, notes }: { reportId: string; notes?: string }) =>
      api.dismissContentReportAdmin(reportId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-stats'] });
      toast.success('Report dismissed');
      setSelectedReport(null);
      setResolutionNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to dismiss report');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.resolved || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Dismissed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-400">{stats?.dismissed || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats?.total || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-xl font-semibold text-white">Content Reports</h2>
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={contentTypeFilter} onValueChange={(v) => {
            setContentTypeFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Content Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="thread">Threads</SelectItem>
              <SelectItem value="reply">Comments</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">Type</TableHead>
              <TableHead className="text-zinc-400">Reason</TableHead>
              <TableHead className="text-zinc-400">Reported By</TableHead>
              <TableHead className="text-zinc-400">Content Author</TableHead>
              <TableHead className="text-zinc-400">Reported</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-zinc-500">
                  <Flag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No reports found
                </TableCell>
              </TableRow>
            ) : reports.map((report) => (
              <TableRow key={report.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    <MessageSquare className="h-3 w-3" />
                    {report.content_type === 'thread' ? 'Thread' : 'Comment'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={REASON_LABELS[report.reason]?.color || 'bg-gray-500'}>
                    {REASON_LABELS[report.reason]?.label || report.reason}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-400">
                  {report.reporter?.full_name || report.reporter?.username || 'Unknown'}
                </TableCell>
                <TableCell className="text-zinc-400">
                  {report.content_author?.full_name || report.content_author?.username || 'Unknown'}
                </TableCell>
                <TableCell className="text-zinc-400">
                  {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGES[report.status]?.variant || 'outline'}>
                    {STATUS_BADGES[report.status]?.label || report.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {report.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                          title="Review Report"
                        >
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setBanDialogUser({
                            id: report.content_author_id,
                            name: report.content_author?.full_name || report.content_author?.username || 'Unknown'
                          })}
                          title="Ban User"
                        >
                          <Ban className="h-4 w-4 text-orange-500" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedReport(report)}
                      title="View Details"
                    >
                      View
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          Showing {total > 0 ? ((page - 1) * PAGE_SIZE) + 1 : 0} - {Math.min(page * PAGE_SIZE, total)} of {total}
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
            Page {page} of {totalPages || 1}
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

      {/* Report Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-red-500" />
              Report Details
            </DialogTitle>
            <DialogDescription>
              Review and take action on this content report
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-zinc-400">Content Type</Label>
                  <p className="text-white capitalize">{selectedReport.content_type}</p>
                </div>
                <div>
                  <Label className="text-zinc-400">Reason</Label>
                  <Badge className={REASON_LABELS[selectedReport.reason]?.color || 'bg-gray-500'}>
                    {REASON_LABELS[selectedReport.reason]?.label || selectedReport.reason}
                  </Badge>
                </div>
                <div>
                  <Label className="text-zinc-400">Reported By</Label>
                  <p className="text-white">
                    {selectedReport.reporter?.full_name || selectedReport.reporter?.username}
                  </p>
                </div>
                <div>
                  <Label className="text-zinc-400">Content Author</Label>
                  <p className="text-white">
                    {selectedReport.content_author?.full_name || selectedReport.content_author?.username}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-zinc-400">Reported At</Label>
                  <p className="text-white">
                    {format(new Date(selectedReport.created_at), 'PPpp')}
                  </p>
                </div>
              </div>

              {selectedReport.details && (
                <div>
                  <Label className="text-zinc-400">Reporter's Details</Label>
                  <p className="text-white mt-1 p-3 bg-zinc-800 rounded-md">
                    {selectedReport.details}
                  </p>
                </div>
              )}

              {selectedReport.content_preview && (
                <div>
                  <Label className="text-zinc-400">Content Preview</Label>
                  <p className="text-white mt-1 p-3 bg-zinc-800 rounded-md line-clamp-4">
                    {selectedReport.content_preview}
                  </p>
                </div>
              )}

              {selectedReport.status === 'pending' && (
                <>
                  <div>
                    <Label htmlFor="actionTaken">Action Taken</Label>
                    <Select value={actionTaken} onValueChange={setActionTaken}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select action..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="content_removed">Content Removed</SelectItem>
                        <SelectItem value="user_warned">User Warned</SelectItem>
                        <SelectItem value="user_banned">User Banned from Forum</SelectItem>
                        <SelectItem value="no_action">No Action Needed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="notes">Resolution Notes</Label>
                    <Textarea
                      id="notes"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Add notes about the resolution..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              {selectedReport.status !== 'pending' && selectedReport.resolution_notes && (
                <div>
                  <Label className="text-zinc-400">Resolution Notes</Label>
                  <p className="text-white mt-1 p-3 bg-zinc-800 rounded-md">
                    {selectedReport.resolution_notes}
                  </p>
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
                  variant="secondary"
                  onClick={() => dismissMutation.mutate({
                    reportId: selectedReport.id,
                    notes: resolutionNotes,
                  })}
                  disabled={dismissMutation.isPending}
                >
                  {dismissMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss
                </Button>
                <Button
                  onClick={() => resolveMutation.mutate({
                    reportId: selectedReport.id,
                    notes: resolutionNotes,
                    action: actionTaken,
                  })}
                  disabled={resolveMutation.isPending}
                >
                  {resolveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forum Ban Dialog */}
      {banDialogUser && (
        <ForumBanDialog
          open={!!banDialogUser}
          onOpenChange={(open) => !open && setBanDialogUser(null)}
          userId={banDialogUser.id}
          userName={banDialogUser.name}
          onSuccess={() => {
            setBanDialogUser(null);
            queryClient.invalidateQueries({ queryKey: ['admin-community-reports'] });
          }}
        />
      )}
    </div>
  );
};

export default ReportsAdminTab;
