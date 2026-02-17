import { useState } from 'react';
import { useTrialRequests, useApproveTrialRequest, useRejectTrialRequest, useBulkApproveTrials } from '@/hooks/crm/useTrialRequests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, CheckCircle2, XCircle, Loader2, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
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

  const trials = data?.trials || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id);
      toast.success('Trial approved — CRM contact created');
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
                <th className="px-3 py-2 text-left text-bone-white/60 font-medium">Phone</th>
                <th className="px-3 py-2 text-left text-bone-white/60 font-medium">Status</th>
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
                  <td className="px-3 py-2 text-bone-white font-medium">
                    {trial.first_name} {trial.last_name}
                  </td>
                  <td className="px-3 py-2 text-bone-white/70">{trial.email}</td>
                  <td className="px-3 py-2 text-bone-white/70">{trial.phone}</td>
                  <td className="px-3 py-2">{statusBadge(trial.status)}</td>
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
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
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
                      {trial.status === 'approved' && trial.converted_contact_id && (
                        <Link
                          to={`/crm/contacts/${trial.converted_contact_id}`}
                          className="text-accent-yellow hover:underline text-xs flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> View Contact
                        </Link>
                      )}
                      {trial.status === 'rejected' && trial.notes && (
                        <span className="text-bone-white/40 text-xs italic truncate max-w-[200px]" title={trial.notes}>
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
    </div>
  );
};

export default BacklotTrials;
