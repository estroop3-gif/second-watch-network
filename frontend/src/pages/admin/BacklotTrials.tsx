import { useState } from 'react';
import {
  useTrialRequests, useApproveTrialRequest, useRejectTrialRequest,
  useBulkApproveTrials, useApproveTrialExtension, useDenyTrialExtension,
} from '@/hooks/crm/useTrialRequests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Search, CheckCircle2, XCircle, Loader2, ChevronLeft, ChevronRight,
  ExternalLink, AlertTriangle, RefreshCw, Clock, ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Extension Requested', value: 'extension_requested' },
  { label: 'Extended', value: 'extended' },
  { label: 'Expired', value: 'expired' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
    case 'provisioning':
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Provisioning</Badge>;
    case 'active':
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
    case 'extension_requested':
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Extension Requested</Badge>;
    case 'extended':
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Extended</Badge>;
    case 'expired':
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Expired</Badge>;
    case 'converted':
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Converted</Badge>;
    case 'approved':
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>;
    case 'rejected':
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

const BacklotTrials = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [rejectNotes, setRejectNotes] = useState('');
  const [detailModal, setDetailModal] = useState<{ open: boolean; trial: any }>({ open: false, trial: null });
  const limit = 25;

  const { data, isLoading } = useTrialRequests({
    status: statusFilter || undefined,
    search: search || undefined,
    limit,
    offset: page * limit,
  });

  const approveMutation = useApproveTrialRequest();
  const rejectMutation = useRejectTrialRequest();
  const bulkApproveMutation = useBulkApproveTrials();
  const approveExtensionMutation = useApproveTrialExtension();
  const denyExtensionMutation = useDenyTrialExtension();

  const trials = data?.trials || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id);
      toast.success('Trial approved and provisioned');
      setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({ id: rejectModal.id, notes: rejectNotes || undefined });
      toast.success('Trial rejected');
      setRejectModal({ open: false, id: '' });
      setRejectNotes('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject');
    }
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      const res = await bulkApproveMutation.mutateAsync(ids);
      toast.success(`${res.approved} trial(s) approved`);
      setSelected(new Set());
    } catch (err: any) {
      toast.error(err?.message || 'Bulk approve failed');
    }
  };

  const handleApproveExtension = async (id: string) => {
    try {
      await approveExtensionMutation.mutateAsync(id);
      toast.success('Extension approved — trial extended 30 days');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve extension');
    }
  };

  const handleDenyExtension = async (id: string) => {
    try {
      await denyExtensionMutation.mutateAsync(id);
      toast.success('Extension denied');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deny extension');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    const pendingIds = trials.filter((t: any) => t.status === 'pending').map((t: any) => t.id);
    if (pendingIds.every((id: string) => selected.has(id))) {
      setSelected((s) => { const n = new Set(s); pendingIds.forEach((id: string) => n.delete(id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); pendingIds.forEach((id: string) => n.add(id)); return n; });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(f.value); setPage(0); }}
              className={statusFilter === f.value
                ? 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90'
                : 'border-muted-gray/40 text-bone-white/70 hover:bg-muted-gray/20'}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-gray" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or email..."
              className="pl-9 bg-charcoal-black border-muted-gray/40 text-bone-white w-64"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="border-muted-gray/40 text-bone-white/70">
            Search
          </Button>
        </form>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg px-4 py-2">
          <span className="text-sm text-bone-white/80">{selected.size} selected</span>
          <Button
            size="sm"
            onClick={handleBulkApprove}
            disabled={bulkApproveMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {bulkApproveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
            Approve Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="text-bone-white/60">
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
        </div>
      ) : trials.length === 0 ? (
        <div className="text-center py-12 text-bone-white/50">
          No trial requests found.
        </div>
      ) : (
        <div className="overflow-x-auto border border-muted-gray/20 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-muted-gray/20 bg-gray-900/50">
                <th className="px-3 py-2 text-left w-10">
                  <Checkbox
                    checked={trials.filter((t: any) => t.status === 'pending').length > 0 &&
                      trials.filter((t: any) => t.status === 'pending').every((t: any) => selected.has(t.id))}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-2 text-left text-bone-white/60 font-medium">Name</th>
                <th className="px-3 py-2 text-left text-bone-white/60 font-medium">Email</th>
                <th className="px-3 py-2 text-left text-bone-white/60 font-medium">Company</th>
                <th className="px-3 py-2 text-left text-bone-white/60 font-medium">Status</th>
                <th className="px-3 py-2 text-left text-bone-white/60 font-medium">Trial Ends</th>
                <th className="px-3 py-2 text-left text-bone-white/60 font-medium">Submitted</th>
                <th className="px-3 py-2 text-left text-bone-white/60 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((trial: any) => (
                <tr key={trial.id} className="border-b border-muted-gray/10 hover:bg-gray-900/30">
                  <td className="px-3 py-2">
                    {trial.status === 'pending' && (
                      <Checkbox
                        checked={selected.has(trial.id)}
                        onCheckedChange={() => toggleSelect(trial.id)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setDetailModal({ open: true, trial })}
                      className="text-bone-white font-medium hover:text-accent-yellow transition-colors text-left"
                    >
                      {trial.first_name} {trial.last_name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-bone-white/70">{trial.email}</td>
                  <td className="px-3 py-2 text-bone-white/70 text-xs">
                    {trial.company_name || '-'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {statusBadge(trial.status)}
                      {trial.provisioning_error && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" title={trial.provisioning_error} />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-bone-white/50 text-xs">
                    {trial.trial_ends_at
                      ? new Date(trial.extension_ends_at || trial.trial_ends_at).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-bone-white/50 text-xs">
                    {new Date(trial.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {trial.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApprove(trial.id)}
                            disabled={approveMutation.isPending}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7 px-2"
                          >
                            {trial.provisioning_error ? (
                              <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry</>
                            ) : (
                              <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setRejectModal({ open: true, id: trial.id }); setRejectNotes(''); }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {trial.status === 'extension_requested' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApproveExtension(trial.id)}
                            disabled={approveExtensionMutation.isPending}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7 px-2"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Ext.
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDenyExtension(trial.id)}
                            disabled={denyExtensionMutation.isPending}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Deny Ext.
                          </Button>
                        </>
                      )}
                      {trial.converted_contact_id && (
                        <Link
                          to={`/crm/contacts/${trial.converted_contact_id}`}
                          className="text-accent-yellow hover:underline text-xs flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Contact
                        </Link>
                      )}
                      {trial.provisioned_profile_id && (
                        <Link
                          to={`/admin/users?search=${encodeURIComponent(trial.email)}`}
                          className="text-blue-400 hover:underline text-xs flex items-center gap-1"
                        >
                          <ArrowUpRight className="h-3 w-3" /> Profile
                        </Link>
                      )}
                      {trial.status === 'rejected' && trial.notes && (
                        <span className="text-bone-white/40 text-xs italic truncate max-w-[150px]" title={trial.notes}>
                          {trial.notes}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-bone-white/60">
          <span>{total} total requests</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="border-muted-gray/40 text-bone-white/70 h-7"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span>Page {page + 1} of {totalPages}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="border-muted-gray/40 text-bone-white/70 h-7"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectModal.open} onOpenChange={(open) => { if (!open) setRejectModal({ open: false, id: '' }); }}>
        <DialogContent className="bg-gray-900 border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Reject Trial Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm text-bone-white/70">Notes (optional)</label>
            <Textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Reason for rejection..."
              className="bg-charcoal-black border-muted-gray/40 text-bone-white"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectModal({ open: false, id: '' })} className="text-bone-white/70">
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={detailModal.open} onOpenChange={(open) => { if (!open) setDetailModal({ open: false, trial: null }); }}>
        <DialogContent className="bg-gray-900 border-muted-gray/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Trial Request Details</DialogTitle>
          </DialogHeader>
          {detailModal.trial && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-bone-white/50 text-xs uppercase">Name</span>
                  <p className="text-bone-white">{detailModal.trial.first_name} {detailModal.trial.last_name}</p>
                </div>
                <div>
                  <span className="text-bone-white/50 text-xs uppercase">Email</span>
                  <p className="text-bone-white">{detailModal.trial.email}</p>
                </div>
                <div>
                  <span className="text-bone-white/50 text-xs uppercase">Phone</span>
                  <p className="text-bone-white">{detailModal.trial.phone}</p>
                </div>
                <div>
                  <span className="text-bone-white/50 text-xs uppercase">Status</span>
                  <div className="mt-0.5">{statusBadge(detailModal.trial.status)}</div>
                </div>
                {detailModal.trial.company_name && (
                  <div>
                    <span className="text-bone-white/50 text-xs uppercase">Company</span>
                    <p className="text-bone-white">{detailModal.trial.company_name}</p>
                  </div>
                )}
                {detailModal.trial.job_title && (
                  <div>
                    <span className="text-bone-white/50 text-xs uppercase">Job Title</span>
                    <p className="text-bone-white">{detailModal.trial.job_title}</p>
                  </div>
                )}
                {detailModal.trial.company_size && (
                  <div>
                    <span className="text-bone-white/50 text-xs uppercase">Team Size</span>
                    <p className="text-bone-white">{detailModal.trial.company_size}</p>
                  </div>
                )}
                {detailModal.trial.trial_ends_at && (
                  <div>
                    <span className="text-bone-white/50 text-xs uppercase">Trial Ends</span>
                    <p className="text-bone-white">{new Date(detailModal.trial.extension_ends_at || detailModal.trial.trial_ends_at).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {detailModal.trial.use_case && (
                <div>
                  <span className="text-bone-white/50 text-xs uppercase">Use Case</span>
                  <p className="text-bone-white/80 mt-1">{detailModal.trial.use_case}</p>
                </div>
              )}

              {detailModal.trial.provisioning_error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <span className="text-red-400 text-xs uppercase font-medium">Provisioning Error</span>
                  <p className="text-red-300 mt-1 text-xs font-mono">{detailModal.trial.provisioning_error}</p>
                </div>
              )}

              {(detailModal.trial.provisioned_profile_id || detailModal.trial.provisioned_org_id) && (
                <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                  <span className="text-bone-white/50 text-xs uppercase">Provisioned Resources</span>
                  {detailModal.trial.provisioned_profile_id && (
                    <p className="text-bone-white/70 text-xs">Profile: <code className="text-accent-yellow">{detailModal.trial.provisioned_profile_id}</code></p>
                  )}
                  {detailModal.trial.provisioned_org_id && (
                    <p className="text-bone-white/70 text-xs">Org: <code className="text-accent-yellow">{detailModal.trial.provisioned_org_id}</code></p>
                  )}
                  {detailModal.trial.org_name && (
                    <p className="text-bone-white/70 text-xs">Org Name: {detailModal.trial.org_name}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BacklotTrials;
