import { useState } from 'react';
import {
  useScrapeSources,
  useCreateScrapeSource,
  useUpdateScrapeSource,
  useDeleteScrapeSource,
  useScrapeJobs,
  useCreateScrapeJob,
  useScrapeJob,
  useScrapedLeads,
  useBulkApproveLeads,
  useBulkRejectLeads,
  useMergeScrapedLead,
} from '@/hooks/crm/useDataScraping';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Database,
  Plus,
  Play,
  Trash2,
  Pencil,
  Loader2,
  Check,
  X,
  ExternalLink,
  Search,
  Globe,
  Mail,
  Phone,
  Eye,
  Merge,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const TABS = ['Sources', 'Jobs', 'Staged Leads'] as const;
type Tab = typeof TABS[number];

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  merged: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-muted-gray/30 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-muted-gray">{score}</span>
    </div>
  );
}

// ============================================================================
// Sources Tab
// ============================================================================

function SourcesTab() {
  const { toast } = useToast();
  const { data, isLoading } = useScrapeSources();
  const createSource = useCreateScrapeSource();
  const updateSource = useUpdateScrapeSource();
  const deleteSource = useDeleteScrapeSource();

  const [showDialog, setShowDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    base_url: '',
    source_type: 'directory',
    selectors: '{}',
    max_pages: 10,
    rate_limit_ms: 2000,
    enabled: true,
    notes: '',
  });

  const sources = data?.sources || [];

  const openNew = () => {
    setEditingSource(null);
    setForm({ name: '', base_url: '', source_type: 'directory', selectors: '{}', max_pages: 10, rate_limit_ms: 2000, enabled: true, notes: '' });
    setShowDialog(true);
  };

  const openEdit = (source: any) => {
    setEditingSource(source);
    setForm({
      name: source.name,
      base_url: source.base_url,
      source_type: source.source_type,
      selectors: typeof source.selectors === 'string' ? source.selectors : JSON.stringify(source.selectors, null, 2),
      max_pages: source.max_pages,
      rate_limit_ms: source.rate_limit_ms,
      enabled: source.enabled,
      notes: source.notes || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      let selectors;
      try {
        selectors = JSON.parse(form.selectors);
      } catch {
        toast({ title: 'Invalid JSON in selectors', variant: 'destructive' });
        return;
      }

      const payload = { ...form, selectors };

      if (editingSource) {
        await updateSource.mutateAsync({ id: editingSource.id, data: payload });
        toast({ title: 'Source updated' });
      } else {
        await createSource.mutateAsync(payload);
        toast({ title: 'Source created' });
      }
      setShowDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSource.mutateAsync(id);
      toast({ title: 'Source deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading sources...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-gray">{sources.length} source{sources.length !== 1 ? 's' : ''} configured</p>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Source</Button>
      </div>

      <div className="space-y-3">
        {sources.map((source: any) => (
          <div key={source.id} className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-bone-white truncate">{source.name}</h3>
                  <Badge variant="outline" className="text-xs">{source.source_type}</Badge>
                  {!source.enabled && <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400">Disabled</Badge>}
                </div>
                <p className="text-xs text-muted-gray truncate">{source.base_url}</p>
                <p className="text-xs text-muted-gray mt-1">
                  Max {source.max_pages} pages, {source.rate_limit_ms}ms delay
                </p>
                {source.notes && <p className="text-xs text-muted-gray/70 mt-1 italic">{source.notes}</p>}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(source)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleDelete(source.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {sources.length === 0 && (
          <div className="text-center py-12 text-muted-gray">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No scrape sources configured yet.</p>
            <p className="text-sm mt-1">Add a source to start finding leads.</p>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSource ? 'Edit Source' : 'New Scrape Source'}</DialogTitle>
            <DialogDescription>Configure a website to scrape for B2B leads.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. ProductionHub Directory" />
            </div>
            <div>
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://example.com/directory" />
            </div>
            <div>
              <Label>Source Type</Label>
              <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="directory">Directory</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="sitemap">Sitemap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CSS Selectors (JSON)</Label>
              <Textarea
                className="font-mono text-xs"
                rows={8}
                value={form.selectors}
                onChange={(e) => setForm({ ...form, selectors: e.target.value })}
                placeholder={'{\n  "list_item": "div.company-card",\n  "company_name": "h3.name",\n  "website": "a.website@href",\n  "email": "a[href^=mailto]@href"\n}'}
              />
              <p className="text-xs text-muted-gray mt-1">Use @attr suffix for attributes (e.g. a.link@href)</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Pages</Label>
                <Input type="number" value={form.max_pages} onChange={(e) => setForm({ ...form, max_pages: parseInt(e.target.value) || 10 })} />
              </div>
              <div>
                <Label>Rate Limit (ms)</Label>
                <Input type="number" value={form.rate_limit_ms} onChange={(e) => setForm({ ...form, rate_limit_ms: parseInt(e.target.value) || 2000 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <Label>Enabled</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.base_url || createSource.isPending || updateSource.isPending}>
              {(createSource.isPending || updateSource.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingSource ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Jobs Tab
// ============================================================================

function JobsTab() {
  const { toast } = useToast();
  const { data: sourcesData } = useScrapeSources();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [newJobSourceId, setNewJobSourceId] = useState('');
  const [newJobMaxPages, setNewJobMaxPages] = useState('');

  const { data, isLoading } = useScrapeJobs({
    source_id: sourceFilter !== 'all' ? sourceFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const { data: jobDetailData } = useScrapeJob(selectedJobId || undefined);
  const createJob = useCreateScrapeJob();

  const sources = sourcesData?.sources || [];
  const enabledSources = sources.filter((s: any) => s.enabled);
  const jobs = data?.jobs || [];
  const selectedJob = jobDetailData?.job || null;

  const handleCreateJob = async () => {
    if (!newJobSourceId) return;
    try {
      const filters: any = {};
      if (newJobMaxPages) filters.max_pages = parseInt(newJobMaxPages);
      await createJob.mutateAsync({ source_id: newJobSourceId, filters });
      toast({ title: 'Scrape job queued' });
      setShowCreateDialog(false);
      setNewJobSourceId('');
      setNewJobMaxPages('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading jobs...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm" disabled={enabledSources.length === 0}>
          <Play className="h-4 w-4 mr-1" /> New Job
        </Button>
      </div>

      <div className="space-y-2">
        {jobs.map((job: any) => {
          const stats = typeof job.stats === 'string' ? JSON.parse(job.stats) : (job.stats || {});
          return (
            <div key={job.id} className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4 cursor-pointer hover:border-muted-gray/40 transition-colors" onClick={() => setSelectedJobId(job.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge className={STATUS_COLORS[job.status] || ''}>{job.status}</Badge>
                  <span className="text-sm text-bone-white truncate">{job.source_name}</span>
                  {job.lead_count > 0 && <span className="text-xs text-muted-gray">{job.lead_count} leads</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-gray">
                  {stats.pages_scraped > 0 && <span>{stats.pages_scraped} pages</span>}
                  <span>{new Date(job.created_at).toLocaleString()}</span>
                  <Eye className="h-3.5 w-3.5" />
                </div>
              </div>
              {job.status === 'running' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-blue-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Scraping... {stats.pages_scraped || 0} pages, {stats.leads_found || 0} leads found
                </div>
              )}
              {job.error_message && <p className="text-xs text-red-400 mt-2 truncate">{job.error_message}</p>}
            </div>
          );
        })}
        {jobs.length === 0 && (
          <div className="text-center py-12 text-muted-gray">
            <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No scrape jobs yet.</p>
          </div>
        )}
      </div>

      {/* Create Job Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Scrape Job</DialogTitle>
            <DialogDescription>Launch an ECS Fargate task to scrape a source.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Source</Label>
              <Select value={newJobSourceId} onValueChange={setNewJobSourceId}>
                <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                <SelectContent>
                  {enabledSources.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max Pages (override)</Label>
              <Input type="number" value={newJobMaxPages} onChange={(e) => setNewJobMaxPages(e.target.value)} placeholder="Use source default" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateJob} disabled={!newJobSourceId || createJob.isPending}>
              {createJob.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Launch Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Detail Dialog */}
      <Dialog open={!!selectedJobId} onOpenChange={(open) => { if (!open) setSelectedJobId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>Scrape job information and stats.</DialogDescription>
          </DialogHeader>
          {selectedJob && (() => {
            const stats = typeof selectedJob.stats === 'string' ? JSON.parse(selectedJob.stats) : (selectedJob.stats || {});
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-gray">Source:</span>
                    <p className="text-bone-white">{selectedJob.source_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-gray">Status:</span>
                    <div><Badge className={STATUS_COLORS[selectedJob.status] || ''}>{selectedJob.status}</Badge></div>
                  </div>
                  <div>
                    <span className="text-muted-gray">Created by:</span>
                    <p className="text-bone-white">{selectedJob.created_by_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-gray">Created:</span>
                    <p className="text-bone-white text-xs">{new Date(selectedJob.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="border-t border-muted-gray/20 pt-3">
                  <h4 className="text-sm font-medium text-bone-white mb-2">Stats</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted-gray/10 rounded p-2">
                      <p className="text-muted-gray text-xs">Pages Scraped</p>
                      <p className="text-bone-white text-lg font-medium">{stats.pages_scraped || 0}</p>
                    </div>
                    <div className="bg-muted-gray/10 rounded p-2">
                      <p className="text-muted-gray text-xs">Leads Found</p>
                      <p className="text-bone-white text-lg font-medium">{stats.leads_found || 0}</p>
                    </div>
                    <div className="bg-muted-gray/10 rounded p-2">
                      <p className="text-muted-gray text-xs">Duplicates Skipped</p>
                      <p className="text-bone-white text-lg font-medium">{stats.duplicates_skipped || 0}</p>
                    </div>
                    <div className="bg-muted-gray/10 rounded p-2">
                      <p className="text-muted-gray text-xs">Leads Total</p>
                      <p className="text-bone-white text-lg font-medium">{selectedJob.lead_count || 0}</p>
                    </div>
                  </div>
                  {(selectedJob.pending_count > 0 || selectedJob.approved_count > 0 || selectedJob.rejected_count > 0) && (
                    <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                      <div className="text-center"><span className="text-amber-400">{selectedJob.pending_count}</span> <span className="text-muted-gray text-xs">pending</span></div>
                      <div className="text-center"><span className="text-green-400">{selectedJob.approved_count}</span> <span className="text-muted-gray text-xs">approved</span></div>
                      <div className="text-center"><span className="text-red-400">{selectedJob.rejected_count}</span> <span className="text-muted-gray text-xs">rejected</span></div>
                    </div>
                  )}
                </div>
                {selectedJob.error_message && (
                  <div className="border-t border-muted-gray/20 pt-3">
                    <p className="text-xs text-red-400">{selectedJob.error_message}</p>
                  </div>
                )}
                {selectedJob.ecs_task_arn && (
                  <div className="border-t border-muted-gray/20 pt-3">
                    <p className="text-xs text-muted-gray break-all">ECS: {selectedJob.ecs_task_arn}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Staged Leads Tab
// ============================================================================

function StagedLeadsTab() {
  const { toast } = useToast();
  const { data: jobsData } = useScrapeJobs();
  const [jobFilter, setJobFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [countryFilter, setCountryFilter] = useState('');
  const [hasEmailFilter, setHasEmailFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sortBy, setSortBy] = useState('match_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [extraTags, setExtraTags] = useState('');
  const [enrollSequence, setEnrollSequence] = useState(false);

  const PAGE_SIZE = 50;

  const { data, isLoading } = useScrapedLeads({
    job_id: jobFilter !== 'all' ? jobFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    min_score: minScore ? parseInt(minScore) : undefined,
    country: countryFilter || undefined,
    has_email: hasEmailFilter === 'all' ? undefined : hasEmailFilter === 'yes',
    search: search || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const approveLeads = useBulkApproveLeads();
  const rejectLeads = useBulkRejectLeads();

  const leads = data?.leads || [];
  const total = data?.total || 0;
  const jobs = jobsData?.jobs || [];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l: any) => l.id)));
    }
  };

  const handleApprove = async () => {
    if (selectedIds.size === 0) return;
    try {
      const tags = extraTags ? extraTags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      const result = await approveLeads.mutateAsync({
        lead_ids: Array.from(selectedIds),
        tags,
      });
      toast({ title: `Approved ${result.approved} leads into contacts` });
      setSelectedIds(new Set());
      setShowApproveDialog(false);
      setExtraTags('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (selectedIds.size === 0) return;
    try {
      const result = await rejectLeads.mutateAsync({ lead_ids: Array.from(selectedIds) });
      toast({ title: `Rejected ${result.rejected} leads` });
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-gray" />
          <Input className="pl-8 w-[200px]" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={jobFilter} onValueChange={(v) => { setJobFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All jobs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All jobs</SelectItem>
            {jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.source_name} ({new Date(j.created_at).toLocaleDateString()})</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="merged">Merged</SelectItem>
          </SelectContent>
        </Select>
        <Input className="w-[80px]" placeholder="Min score" type="number" value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(0); }} />
        <Input className="w-[90px]" placeholder="Country" value={countryFilter} onChange={(e) => { setCountryFilter(e.target.value); setPage(0); }} />
        <Select value={hasEmailFilter} onValueChange={(v) => { setHasEmailFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Has email" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any email</SelectItem>
            <SelectItem value="yes">Has email</SelectItem>
            <SelectItem value="no">No email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-accent-yellow/10 rounded-lg border border-accent-yellow/20">
          <span className="text-sm text-accent-yellow font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => setShowApproveDialog(true)}>
            <Check className="h-3.5 w-3.5 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={handleReject} disabled={rejectLeads.isPending}>
            <X className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-gray" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading leads...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted-gray/20 text-left text-xs text-muted-gray">
                  <th className="p-2 w-8">
                    <Checkbox checked={leads.length > 0 && selectedIds.size === leads.length} onCheckedChange={toggleAll} />
                  </th>
                  <th className="p-2 cursor-pointer hover:text-bone-white" onClick={() => { setSortBy('company_name'); setSortOrder(sortBy === 'company_name' && sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    Company {sortBy === 'company_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-2">Website</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2 cursor-pointer hover:text-bone-white" onClick={() => { setSortBy('country'); setSortOrder(sortBy === 'country' && sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    Country {sortBy === 'country' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-2 cursor-pointer hover:text-bone-white" onClick={() => { setSortBy('match_score'); setSortOrder(sortBy === 'match_score' && sortOrder === 'desc' ? 'asc' : 'desc'); }}>
                    Score {sortBy === 'match_score' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: any) => (
                  <tr key={lead.id} className="border-b border-muted-gray/10 hover:bg-muted-gray/5">
                    <td className="p-2">
                      <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                    </td>
                    <td className="p-2 text-bone-white font-medium max-w-[200px] truncate">{lead.company_name}</td>
                    <td className="p-2">
                      {lead.website ? (
                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 text-xs truncate max-w-[160px]">
                          <Globe className="h-3 w-3 flex-shrink-0" />
                          {lead.website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : <span className="text-muted-gray/50">-</span>}
                    </td>
                    <td className="p-2">
                      {lead.email ? (
                        <span className="flex items-center gap-1 text-xs text-muted-gray">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate max-w-[140px]">{lead.email}</span>
                        </span>
                      ) : <span className="text-muted-gray/50">-</span>}
                    </td>
                    <td className="p-2">
                      {lead.phone ? (
                        <span className="flex items-center gap-1 text-xs text-muted-gray">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          {lead.phone}
                        </span>
                      ) : <span className="text-muted-gray/50">-</span>}
                    </td>
                    <td className="p-2 text-xs text-muted-gray">{lead.country || '-'}</td>
                    <td className="p-2"><ScoreBar score={lead.match_score} /></td>
                    <td className="p-2"><Badge className={`text-xs ${STATUS_COLORS[lead.status] || ''}`}>{lead.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {leads.length === 0 && (
            <div className="text-center py-12 text-muted-gray">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No leads found matching filters.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-gray">
              <span>Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">Page {page + 1} of {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>Create contacts from selected leads.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Extra Tags (comma-separated)</Label>
              <Input value={extraTags} onChange={(e) => setExtraTags(e.target.value)} placeholder="e.g. Q1 2026, Film" />
              <p className="text-xs text-muted-gray mt-1">All leads auto-tagged "Backlot Prospect" + source name</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approveLeads.isPending}>
              {approveLeads.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Approve & Create Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

const AdminScraping = () => {
  const [activeTab, setActiveTab] = useState<Tab>('Sources');

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Database className="h-5 w-5 text-accent-yellow" />
        <h2 className="text-lg font-heading text-bone-white">Data Scraping</h2>
      </div>

      <div className="flex gap-1 mb-6 border-b border-muted-gray/20 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-accent-yellow text-accent-yellow'
                : 'border-transparent text-muted-gray hover:text-bone-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Sources' && <SourcesTab />}
      {activeTab === 'Jobs' && <JobsTab />}
      {activeTab === 'Staged Leads' && <StagedLeadsTab />}
    </div>
  );
};

export default AdminScraping;
