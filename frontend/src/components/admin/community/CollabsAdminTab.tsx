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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Star, StarOff, Power, PowerOff, Loader2, Search, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, AlertCircle, Clock, Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const PAGE_SIZE = 25;

const CollabsAdminTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [featuredFilter, setFeaturedFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [rejectingCollab, setRejectingCollab] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Main collabs query
  const { data, isLoading } = useQuery({
    queryKey: ['admin-community-collabs', page, search, statusFilter, featuredFilter, approvalFilter],
    queryFn: () => api.listCollabsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
      is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      is_featured: featuredFilter === 'all' ? undefined : featuredFilter === 'featured',
      approval_status: approvalFilter === 'all' ? undefined : approvalFilter,
    }),
  });

  // Pending collabs count query
  const { data: pendingData } = useQuery({
    queryKey: ['admin-community-collabs-pending-count'],
    queryFn: () => api.listPendingCollabsAdmin({ limit: 1 }),
  });

  // Approval setting query
  const { data: approvalSetting } = useQuery({
    queryKey: ['admin-collab-approval-setting'],
    queryFn: () => api.getCollabApprovalSetting(),
  });

  const collabs = data?.collabs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const featureMutation = useMutation({
    mutationFn: ({ collabId, isFeatured }: { collabId: string; isFeatured: boolean }) =>
      api.featureCollabAdmin(collabId, isFeatured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs'] });
      toast.success('Collab updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update collab');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (collabId: string) => api.deactivateCollabAdmin(collabId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs'] });
      toast.success('Collab deactivated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deactivate collab');
    },
  });

  const bulkDeactivateMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeactivateCollabsAdmin(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs'] });
      toast.success(`Deactivated ${data.deactivated_count} collabs`);
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deactivate collabs');
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (collabId: string) => api.approveCollabAdmin(collabId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs-pending-count'] });
      toast.success('Collab approved');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve collab');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ collabId, reason }: { collabId: string; reason: string }) =>
      api.rejectCollabAdmin(collabId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-community-collabs-pending-count'] });
      toast.success('Collab rejected');
      setRejectingCollab(null);
      setRejectionReason('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject collab');
    },
  });

  // Update approval setting mutation
  const updateApprovalSettingMutation = useMutation({
    mutationFn: (enabled: boolean) => api.updateCollabApprovalSetting(enabled),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-collab-approval-setting'] });
      toast.success(`Collab approval ${data.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update setting');
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === collabs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(collabs.map(c => c.id));
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'job': 'bg-blue-500/20 text-blue-400',
      'collaboration': 'bg-green-500/20 text-green-400',
      'gig': 'bg-purple-500/20 text-purple-400',
      'volunteer': 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[type] || 'bg-zinc-500/20 text-zinc-400';
  };

  const getApprovalStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-400">
            {status || 'Unknown'}
          </Badge>
        );
    }
  };

  const pendingCount = pendingData?.total || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Approval Alert */}
      {pendingCount > 0 && (
        <Alert className="bg-yellow-500/10 border-yellow-500/30">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-500">Pending Approvals</AlertTitle>
          <AlertDescription className="text-yellow-400/80">
            {pendingCount} collab{pendingCount !== 1 ? 's' : ''} waiting for approval.{' '}
            <Button
              variant="link"
              size="sm"
              className="text-yellow-400 p-0 h-auto"
              onClick={() => {
                setApprovalFilter('pending');
                setPage(1);
              }}
            >
              View pending
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center gap-4">
        <h2 className="text-xl font-semibold text-white">Community Collabs</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search collabs..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10 w-64 bg-zinc-800 border-zinc-700"
            />
          </div>
          <Select value={approvalFilter} onValueChange={(v) => {
            setApprovalFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Approval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Approval</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={featuredFilter} onValueChange={(v) => {
            setFeaturedFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-36 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Featured" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="regular">Not Featured</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettingsDialog(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-zinc-800 rounded-lg">
          <span className="text-sm text-zinc-400">
            {selectedIds.length} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Deactivate ${selectedIds.length} collabs?`)) {
                bulkDeactivateMutation.mutate(selectedIds);
              }
            }}
            disabled={bulkDeactivateMutation.isPending}
          >
            {bulkDeactivateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Deactivate Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear Selection
          </Button>
        </div>
      )}

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === collabs.length && collabs.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-zinc-400">Title</TableHead>
              <TableHead className="text-zinc-400">Type</TableHead>
              <TableHead className="text-zinc-400">Posted By</TableHead>
              <TableHead className="text-zinc-400">Created</TableHead>
              <TableHead className="text-zinc-400 text-center">Approval</TableHead>
              <TableHead className="text-zinc-400 text-center">Status</TableHead>
              <TableHead className="text-zinc-400 text-center">Featured</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collabs.map((collab) => (
              <TableRow key={collab.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(collab.id)}
                    onCheckedChange={() => toggleSelect(collab.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-white max-w-xs truncate">
                  {collab.title}
                </TableCell>
                <TableCell>
                  <Badge className={getTypeBadge(collab.type)}>
                    {collab.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-400">
                  {collab.profiles?.full_name || collab.profiles?.username || 'Unknown'}
                </TableCell>
                <TableCell className="text-zinc-400">
                  {formatDistanceToNow(new Date(collab.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-center">
                  {getApprovalStatusBadge(collab.approval_status || 'approved')}
                </TableCell>
                <TableCell className="text-center">
                  {collab.is_active ? (
                    <Badge variant="outline" className="border-green-500 text-green-500">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-zinc-500 text-zinc-500">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {collab.is_featured && (
                    <Star className="h-4 w-4 text-yellow-500 mx-auto fill-yellow-500" />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {/* Approve/Reject buttons for pending collabs */}
                    {collab.approval_status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => approveMutation.mutate(collab.id)}
                          disabled={approveMutation.isPending}
                          title="Approve"
                          className="text-green-500 hover:text-green-400 hover:bg-green-500/10"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRejectingCollab(collab)}
                          title="Reject"
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => featureMutation.mutate({
                        collabId: collab.id,
                        isFeatured: !collab.is_featured
                      })}
                      title={collab.is_featured ? 'Unfeature' : 'Feature'}
                    >
                      {collab.is_featured ? (
                        <StarOff className="h-4 w-4" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </Button>
                    {collab.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Deactivate this collab?')) {
                            deactivateMutation.mutate(collab.id);
                          }
                        }}
                        title="Deactivate"
                      >
                        <PowerOff className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
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

      {/* Reject Collab Dialog */}
      <Dialog open={!!rejectingCollab} onOpenChange={(open) => !open && setRejectingCollab(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Collab</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Provide a reason for rejecting "{rejectingCollab?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingCollab(null);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectingCollab && rejectionReason.trim()) {
                  rejectMutation.mutate({
                    collabId: rejectingCollab.id,
                    reason: rejectionReason.trim(),
                  });
                }
              }}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Collab Settings</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Configure community collab moderation settings
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="require-approval" className="text-white">
                  Require Admin Approval
                </Label>
                <p className="text-sm text-zinc-400">
                  When enabled, new collab postings must be approved by an admin before they appear publicly.
                </p>
              </div>
              <Switch
                id="require-approval"
                checked={approvalSetting?.enabled || false}
                onCheckedChange={(checked) => updateApprovalSettingMutation.mutate(checked)}
                disabled={updateApprovalSettingMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollabsAdminTab;
