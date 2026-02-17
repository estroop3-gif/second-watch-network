import { useState, useRef, useCallback } from 'react';
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
  useExportLeads,
  useBulkImportContacts,
  useRescrapeLeads,
  useScrapeProfiles,
  useCreateScrapeProfile,
  useUpdateScrapeProfile,
  useDeleteScrapeProfile,
  useDiscoveryProfiles,
  useCreateDiscoveryProfile,
  useUpdateDiscoveryProfile,
  useDeleteDiscoveryProfile,
  useDiscoveryRuns,
  useCreateDiscoveryRun,
  useDiscoveryRun,
  useDiscoveryRunSites,
  useStartDiscoveryScraping,
  useScrapingSettings,
  useUpdateScrapingSettings,
  useRetryScrapeJob,
  useCancelScrapeJob,
  useLeadLists,
  useLeadList,
  useCreateLeadList,
  useUpdateLeadList,
  useDeleteLeadList,
  useLeadListLeads,
  useAddLeadsToList,
  useRemoveLeadsFromList,
  useExportLeadList,
  useImportToLeadList,
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
  EyeOff,
  Save,
  Merge,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Copy,
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Compass,
  Settings2,
  ArrowRight,
  MapPin,
  Zap,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  ListPlus,
  FolderOpen,
  Filter,
  StopCircle,
} from 'lucide-react';

const TABS = ['Discovery', 'Scrape Profiles', 'Jobs', 'Staged Leads', 'Lead Lists', 'Sources', 'Settings'] as const;
type Tab = typeof TABS[number];

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
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
// Discovery Tab — 3-level drill-down
// ============================================================================

function DiscoveryTab({ onNavigateToJobs }: { onNavigateToJobs?: () => void } = {}) {
  const { toast } = useToast();
  const { data: profilesData, isLoading: loadingProfiles } = useDiscoveryProfiles();
  const { data: scrapeProfilesData } = useScrapeProfiles();
  const createProfile = useCreateDiscoveryProfile();
  const updateProfile = useUpdateDiscoveryProfile();
  const deleteProfile = useDeleteDiscoveryProfile();
  const createRun = useCreateDiscoveryRun();
  const startScraping = useStartDiscoveryScraping();

  // Navigation state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Dialog state
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [showScrapingDialog, setShowScrapingDialog] = useState(false);
  const [scrapingProfileId, setScrapingProfileId] = useState('');
  const [scrapingMinScore, setScrapingMinScore] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [siteMinScore, setSiteMinScore] = useState('');
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    name: '', description: '', search_keywords: '',
    locations: '', source_types: 'google_search',
    search_radius_miles: 50, must_have_website: true,
    required_keywords: '', excluded_keywords: '', excluded_domains: '',
    max_results_per_query: 100, auto_start_scraping: false,
    default_scrape_profile_id: '', min_discovery_score: 0, enabled: true,
  });

  const profiles = profilesData?.profiles || [];
  const scrapeProfiles = scrapeProfilesData?.profiles || [];

  // Runs for selected profile
  const { data: runsData, isLoading: loadingRuns } = useDiscoveryRuns(
    selectedProfileId ? { profile_id: selectedProfileId } : undefined
  );
  const runs = runsData?.runs || [];

  // Run detail with polling
  const { data: runDetailData } = useDiscoveryRun(selectedRunId || undefined);
  const selectedRun = runDetailData?.run;

  // Sites for selected run (polls while running)
  const { data: sitesData, isLoading: loadingSites } = useDiscoveryRunSites(
    selectedRunId || undefined,
    selectedRun?.status,
    {
      min_score: siteMinScore ? parseInt(siteMinScore) : undefined,
      search: siteSearch || undefined,
    }
  );
  const sites = sitesData?.sites || [];
  const sitesTotal = sitesData?.total || 0;

  const resetForm = () => setForm({
    name: '', description: '', search_keywords: '',
    locations: '', source_types: 'google_search',
    search_radius_miles: 50, must_have_website: true,
    required_keywords: '', excluded_keywords: '', excluded_domains: '',
    max_results_per_query: 100, auto_start_scraping: false,
    default_scrape_profile_id: '', min_discovery_score: 0, enabled: true,
  });

  const openNewProfile = () => {
    setEditingProfile(null);
    resetForm();
    setShowProfileDialog(true);
  };

  const openEditProfile = (p: any) => {
    setEditingProfile(p);
    setForm({
      name: p.name, description: p.description || '',
      search_keywords: (p.search_keywords || []).join(', '),
      locations: (p.locations || []).join(', '),
      source_types: (p.source_types || ['google_search']).join(', '),
      search_radius_miles: p.search_radius_miles || 50,
      must_have_website: p.must_have_website !== false,
      required_keywords: (p.required_keywords || []).join(', '),
      excluded_keywords: (p.excluded_keywords || []).join(', '),
      excluded_domains: (p.excluded_domains || []).join(', '),
      max_results_per_query: p.max_results_per_query || 100,
      auto_start_scraping: p.auto_start_scraping || false,
      default_scrape_profile_id: p.default_scrape_profile_id || '',
      min_discovery_score: p.min_discovery_score || 0,
      enabled: p.enabled !== false,
    });
    setShowProfileDialog(true);
  };

  const splitCSV = (s: string) => s.split(',').map(v => v.trim()).filter(Boolean);

  const handleSaveProfile = async () => {
    try {
      const payload = {
        ...form,
        search_keywords: splitCSV(form.search_keywords),
        locations: splitCSV(form.locations),
        source_types: splitCSV(form.source_types),
        required_keywords: splitCSV(form.required_keywords),
        excluded_keywords: splitCSV(form.excluded_keywords),
        excluded_domains: splitCSV(form.excluded_domains),
        default_scrape_profile_id: form.default_scrape_profile_id || null,
      };
      if (editingProfile) {
        await updateProfile.mutateAsync({ id: editingProfile.id, data: payload });
        toast({ title: 'Discovery profile updated' });
      } else {
        await createProfile.mutateAsync(payload);
        toast({ title: 'Discovery profile created' });
      }
      setShowProfileDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await deleteProfile.mutateAsync(id);
      toast({ title: 'Profile deleted' });
      if (selectedProfileId === id) setSelectedProfileId(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRunDiscovery = async (profileId: string) => {
    try {
      const result = await createRun.mutateAsync(profileId);
      toast({ title: 'Discovery run queued' });
      setSelectedProfileId(profileId);
      if (result?.run?.id) setSelectedRunId(result.run.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleStartScraping = async () => {
    if (!selectedRunId || !scrapingProfileId) return;
    try {
      const result = await startScraping.mutateAsync({
        runId: selectedRunId,
        data: {
          scrape_profile_id: scrapingProfileId,
          site_ids: selectedSiteIds.size > 0 ? Array.from(selectedSiteIds) : undefined,
          min_score: scrapingMinScore ? parseInt(scrapingMinScore) : undefined,
        },
      });
      toast({ title: `Scraping started: ${result.sites_selected} sites selected`, description: 'Switching to Jobs tab to track progress...' });
      setShowScrapingDialog(false);
      setSelectedSiteIds(new Set());
      if (onNavigateToJobs) onNavigateToJobs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Breadcrumb
  const selectedProfile = profiles.find((p: any) => p.id === selectedProfileId);
  const breadcrumbs = [
    { label: 'Discovery', onClick: () => { setSelectedProfileId(null); setSelectedRunId(null); } },
    ...(selectedProfile ? [{ label: selectedProfile.name, onClick: () => setSelectedRunId(null) }] : []),
    ...(selectedRun ? [{ label: `Run ${new Date(selectedRun.created_at).toLocaleDateString()}`, onClick: () => {} }] : []),
  ];

  // Level 3: Sites list
  if (selectedRunId) {
    return (
      <div>
        <div className="flex items-center gap-1 mb-4 text-sm">
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-gray" />}
              <button onClick={bc.onClick} className={i === breadcrumbs.length - 1 ? 'text-bone-white font-medium' : 'text-muted-gray hover:text-bone-white'}>
                {bc.label}
              </button>
            </span>
          ))}
        </div>

        {selectedRun && (
          <div className={`border rounded-lg p-4 mb-4 ${selectedRun.status === 'failed' ? 'bg-red-500/5 border-red-500/30' : 'bg-charcoal-black border-muted-gray/20'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge className={STATUS_COLORS[selectedRun.status] || ''}>{selectedRun.status}</Badge>
                {(selectedRun.status === 'queued' || selectedRun.status === 'running') && (
                  <span className="flex items-center gap-1.5 text-xs text-blue-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {selectedRun.status === 'queued' ? 'Waiting for worker to start...' : 'Discovering sites...'}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-gray">{new Date(selectedRun.created_at).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-muted-gray">Sites found:</span> <span className="text-bone-white">{selectedRun.sites_found_count}</span></div>
              <div><span className="text-muted-gray">Selected:</span> <span className="text-bone-white">{selectedRun.sites_selected_count}</span></div>
              <div><span className="text-muted-gray">Created by:</span> <span className="text-bone-white">{selectedRun.created_by_name}</span></div>
            </div>
            {selectedRun.error_message && (
              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                <strong>Error:</strong> {selectedRun.error_message}
              </div>
            )}
            {selectedRun.source_stats && typeof selectedRun.source_stats === 'object' && Object.keys(selectedRun.source_stats).length > 0 && (
              <div className="mt-2 flex gap-4 text-xs text-muted-gray">
                {Object.entries(selectedRun.source_stats).map(([source, stats]: [string, any]) => (
                  <span key={source}>{source}: {stats.queries} queries, {stats.results} results, {stats.inserted} new, {stats.filtered} filtered</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-gray" />
              <Input className="pl-8 w-[200px]" placeholder="Search sites..." value={siteSearch} onChange={(e) => setSiteSearch(e.target.value)} />
            </div>
            <Input className="w-[100px]" placeholder="Min score" type="number" value={siteMinScore} onChange={(e) => setSiteMinScore(e.target.value)} />
            <span className="text-xs text-muted-gray">{sitesTotal} sites</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedSiteIds.size > 0 && (
              <span className="text-xs text-accent-yellow">{selectedSiteIds.size} selected</span>
            )}
            <Button size="sm" onClick={() => {
              setScrapingProfileId('');
              setScrapingMinScore('');
              setShowScrapingDialog(true);
            }} disabled={selectedRun?.status !== 'completed'}>
              <Zap className="h-4 w-4 mr-1" /> Start Scraping
            </Button>
          </div>
        </div>

        {loadingSites ? (
          <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading sites...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted-gray/20 text-left text-xs text-muted-gray">
                  <th className="p-2 w-8">
                    <Checkbox
                      checked={sites.length > 0 && selectedSiteIds.size === sites.length}
                      onCheckedChange={() => {
                        if (selectedSiteIds.size === sites.length) setSelectedSiteIds(new Set());
                        else setSelectedSiteIds(new Set(sites.map((s: any) => s.id)));
                      }}
                    />
                  </th>
                  <th className="p-2">Domain</th>
                  <th className="p-2">Company</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Location</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Selected</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site: any) => (
                  <tr key={site.id} className="border-b border-muted-gray/10 hover:bg-muted-gray/5">
                    <td className="p-2">
                      <Checkbox
                        checked={selectedSiteIds.has(site.id)}
                        onCheckedChange={() => {
                          setSelectedSiteIds(prev => {
                            const next = new Set(prev);
                            if (next.has(site.id)) next.delete(site.id); else next.add(site.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <a href={site.homepage_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs flex items-center gap-1">
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        {site.domain}
                      </a>
                    </td>
                    <td className="p-2 text-bone-white text-xs max-w-[200px] truncate">{site.company_name || '-'}</td>
                    <td className="p-2"><Badge variant="outline" className="text-xs">{site.source_type}</Badge></td>
                    <td className="p-2 text-xs text-muted-gray max-w-[150px] truncate">{site.location || '-'}</td>
                    <td className="p-2"><ScoreBar score={site.match_score} /></td>
                    <td className="p-2">
                      {site.is_selected_for_scraping && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sites.length === 0 && (
              <div className="text-center py-12 text-muted-gray">
                {selectedRun?.status === 'queued' ? (
                  <>
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-blue-400" />
                    <p className="text-bone-white font-medium mb-1">Starting discovery worker...</p>
                    <p className="text-xs">The ECS task is launching. This usually takes 30-60 seconds.</p>
                  </>
                ) : selectedRun?.status === 'running' ? (
                  <>
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-blue-400" />
                    <p className="text-bone-white font-medium mb-1">Searching for sites...</p>
                    <p className="text-xs">Results will appear here as they're discovered. This page auto-refreshes.</p>
                  </>
                ) : selectedRun?.status === 'failed' ? (
                  <>
                    <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-red-400" />
                    <p className="text-red-400 font-medium mb-1">Discovery run failed</p>
                    <p className="text-xs">Check the error message above for details.</p>
                  </>
                ) : (
                  <>
                    <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No sites found.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Start Scraping Dialog */}
        <Dialog open={showScrapingDialog} onOpenChange={setShowScrapingDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Start Scraping</DialogTitle>
              <DialogDescription>
                {selectedSiteIds.size > 0
                  ? `Scrape ${selectedSiteIds.size} selected sites`
                  : 'Scrape all qualifying sites from this run'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Scrape Profile</Label>
                <Select value={scrapingProfileId} onValueChange={setScrapingProfileId}>
                  <SelectTrigger><SelectValue placeholder="Select profile..." /></SelectTrigger>
                  <SelectContent>
                    {scrapeProfiles.map((sp: any) => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedSiteIds.size === 0 && (
                <div>
                  <Label>Min Score Filter</Label>
                  <Input type="number" value={scrapingMinScore} onChange={(e) => setScrapingMinScore(e.target.value)} placeholder="Include all scores" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScrapingDialog(false)}>Cancel</Button>
              <Button onClick={handleStartScraping} disabled={!scrapingProfileId || startScraping.isPending}>
                {startScraping.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Start Scraping
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Level 2: Runs list
  if (selectedProfileId) {
    return (
      <div>
        <div className="flex items-center gap-1 mb-4 text-sm">
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-gray" />}
              <button onClick={bc.onClick} className={i === breadcrumbs.length - 1 ? 'text-bone-white font-medium' : 'text-muted-gray hover:text-bone-white'}>
                {bc.label}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-gray">{runs.length} run{runs.length !== 1 ? 's' : ''}</p>
          <Button size="sm" onClick={() => handleRunDiscovery(selectedProfileId)} disabled={createRun.isPending}>
            {createRun.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <Play className="h-4 w-4 mr-1" /> Run Discovery
          </Button>
        </div>

        {loadingRuns ? (
          <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading runs...</div>
        ) : (
          <div className="space-y-2">
            {runs.map((run: any) => {
              const stats = typeof run.source_stats === 'string' ? JSON.parse(run.source_stats) : (run.source_stats || {});
              return (
                <div key={run.id} className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4 cursor-pointer hover:border-muted-gray/40 transition-colors" onClick={() => setSelectedRunId(run.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={STATUS_COLORS[run.status] || ''}>{run.status}</Badge>
                      <span className="text-sm text-bone-white">{run.sites_found_count} sites found</span>
                      {run.sites_selected_count > 0 && (
                        <span className="text-xs text-green-400">{run.sites_selected_count} selected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-gray">
                      <span>{new Date(run.created_at).toLocaleString()}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  {run.status === 'running' && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Running discovery...
                    </div>
                  )}
                  {run.error_message && <p className="text-xs text-red-400 mt-2 truncate">{run.error_message}</p>}
                </div>
              );
            })}
            {runs.length === 0 && (
              <div className="text-center py-12 text-muted-gray">
                <Compass className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No runs yet. Click "Run Discovery" to start.</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Level 1: Profiles list
  if (loadingProfiles) return <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading discovery profiles...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-gray">{profiles.length} discovery profile{profiles.length !== 1 ? 's' : ''}</p>
        <Button onClick={openNewProfile} size="sm"><Plus className="h-4 w-4 mr-1" /> New Profile</Button>
      </div>

      <div className="space-y-3">
        {profiles.map((p: any) => (
          <div key={p.id} className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedProfileId(p.id)}>
                <div className="flex items-center gap-2 mb-1">
                  <Compass className="h-4 w-4 text-accent-yellow flex-shrink-0" />
                  <h3 className="text-sm font-medium text-bone-white truncate">{p.name}</h3>
                  {!p.enabled && <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400">Disabled</Badge>}
                  {p.auto_start_scraping && <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400">Auto-start</Badge>}
                </div>
                {p.description && <p className="text-xs text-muted-gray mb-1">{p.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-gray">
                  <span>Keywords: {(p.search_keywords || []).slice(0, 3).join(', ')}{(p.search_keywords || []).length > 3 ? '...' : ''}</span>
                  {(p.locations || []).length > 0 && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{(p.locations || []).slice(0, 2).join(', ')}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-gray">
                  <span>{p.run_count || 0} runs</span>
                  <span>{p.total_sites_found || 0} sites found</span>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRunDiscovery(p.id); }} disabled={createRun.isPending || !p.enabled}>
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditProfile(p); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {profiles.length === 0 && (
          <div className="text-center py-12 text-muted-gray">
            <Compass className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No discovery profiles yet.</p>
            <p className="text-sm mt-1">Create a profile to find business websites automatically.</p>
          </div>
        )}
      </div>

      {/* Profile Create/Edit Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Edit Discovery Profile' : 'New Discovery Profile'}</DialogTitle>
            <DialogDescription>Configure automated website discovery.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. US Film Production Companies" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description..." />
            </div>
            <div>
              <Label>Search Keywords (comma-separated)</Label>
              <Textarea value={form.search_keywords} onChange={(e) => setForm({ ...form, search_keywords: e.target.value })} placeholder="film production company, post production house, video production" rows={2} />
            </div>
            <div>
              <Label>Locations (comma-separated)</Label>
              <Input value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} placeholder="Los Angeles, New York, Atlanta" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source Types</Label>
                <Input value={form.source_types} onChange={(e) => setForm({ ...form, source_types: e.target.value })} placeholder="google_search, google_maps" />
              </div>
              <div>
                <Label>Max Results / Query</Label>
                <Input type="number" value={form.max_results_per_query} onChange={(e) => setForm({ ...form, max_results_per_query: parseInt(e.target.value) || 100 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Search Radius (miles)</Label>
                <Input type="number" value={form.search_radius_miles} onChange={(e) => setForm({ ...form, search_radius_miles: parseInt(e.target.value) || 50 })} />
              </div>
              <div>
                <Label>Min Discovery Score</Label>
                <Input type="number" value={form.min_discovery_score} onChange={(e) => setForm({ ...form, min_discovery_score: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Required Keywords (comma-separated)</Label>
              <Input value={form.required_keywords} onChange={(e) => setForm({ ...form, required_keywords: e.target.value })} placeholder="Must match at least one" />
            </div>
            <div>
              <Label>Excluded Keywords (comma-separated)</Label>
              <Input value={form.excluded_keywords} onChange={(e) => setForm({ ...form, excluded_keywords: e.target.value })} placeholder="Auto-reject if found" />
            </div>
            <div>
              <Label>Excluded Domains (comma-separated)</Label>
              <Input value={form.excluded_domains} onChange={(e) => setForm({ ...form, excluded_domains: e.target.value })} placeholder="facebook.com, yelp.com" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.must_have_website} onCheckedChange={(v) => setForm({ ...form, must_have_website: v })} />
              <Label>Must have website</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.auto_start_scraping} onCheckedChange={(v) => setForm({ ...form, auto_start_scraping: v })} />
              <Label>Auto-start scraping on completion</Label>
            </div>
            {form.auto_start_scraping && (
              <div>
                <Label>Default Scrape Profile</Label>
                <Select value={form.default_scrape_profile_id} onValueChange={(v) => setForm({ ...form, default_scrape_profile_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select scrape profile..." /></SelectTrigger>
                  <SelectContent>
                    {scrapeProfiles.map((sp: any) => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} disabled={!form.name || !form.search_keywords || createProfile.isPending || updateProfile.isPending}>
              {(createProfile.isPending || updateProfile.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingProfile ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ============================================================================
// Scrape Profiles Tab
// ============================================================================

function ScrapeProfilesTab() {
  const { toast } = useToast();
  const { data, isLoading } = useScrapeProfiles();
  const createProfile = useCreateScrapeProfile();
  const updateProfile = useUpdateScrapeProfile();
  const deleteProfile = useDeleteScrapeProfile();

  const [showDialog, setShowDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', description: '',
    max_pages_per_site: 5, paths_to_visit: '/about, /contact, /team',
    data_to_extract: 'emails, phones, social_links',
    follow_internal_links: false, max_depth: 2,
    concurrency: 1, delay_ms: 2000, respect_robots_txt: true,
    user_agent: '', min_match_score: 0,
    require_email: false, require_phone: false, require_website: false,
    excluded_domains: '', scoring_rules: '{}', keywords: '',
  });

  const profiles = data?.profiles || [];

  const resetForm = () => setForm({
    name: '', description: '',
    max_pages_per_site: 5, paths_to_visit: '/about, /contact, /team',
    data_to_extract: 'emails, phones, social_links',
    follow_internal_links: false, max_depth: 2,
    concurrency: 1, delay_ms: 2000, respect_robots_txt: true,
    user_agent: '', min_match_score: 0,
    require_email: false, require_phone: false, require_website: false,
    excluded_domains: '', scoring_rules: '{}', keywords: '',
  });

  const openNew = () => {
    setEditingProfile(null);
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (p: any) => {
    setEditingProfile(p);
    setForm({
      name: p.name, description: p.description || '',
      max_pages_per_site: p.max_pages_per_site || 5,
      paths_to_visit: (p.paths_to_visit || []).join(', '),
      data_to_extract: (p.data_to_extract || []).join(', '),
      follow_internal_links: p.follow_internal_links || false,
      max_depth: p.max_depth || 2,
      concurrency: p.concurrency || 1,
      delay_ms: p.delay_ms || 2000,
      respect_robots_txt: p.respect_robots_txt !== false,
      user_agent: p.user_agent || '',
      min_match_score: p.min_match_score || 0,
      require_email: p.require_email || false,
      require_phone: p.require_phone || false,
      require_website: p.require_website || false,
      excluded_domains: (p.excluded_domains || []).join(', '),
      scoring_rules: typeof p.scoring_rules === 'string' ? p.scoring_rules : JSON.stringify(p.scoring_rules || {}, null, 2),
      keywords: (p.keywords || []).join(', '),
    });
    setShowDialog(true);
  };

  const openDuplicate = (p: any) => {
    openEdit({ ...p, name: `${p.name} (copy)`, id: undefined });
    setEditingProfile(null); // treat as new
  };

  const splitCSV = (s: string) => s.split(',').map(v => v.trim()).filter(Boolean);

  const handleSave = async () => {
    try {
      let scoringRules;
      try {
        scoringRules = JSON.parse(form.scoring_rules);
      } catch {
        toast({ title: 'Invalid JSON in scoring rules', variant: 'destructive' });
        return;
      }

      const payload = {
        ...form,
        paths_to_visit: splitCSV(form.paths_to_visit),
        data_to_extract: splitCSV(form.data_to_extract),
        excluded_domains: splitCSV(form.excluded_domains),
        keywords: splitCSV(form.keywords),
        scoring_rules: scoringRules,
        user_agent: form.user_agent || null,
      };

      if (editingProfile) {
        await updateProfile.mutateAsync({ id: editingProfile.id, data: payload });
        toast({ title: 'Scrape profile updated' });
      } else {
        await createProfile.mutateAsync(payload);
        toast({ title: 'Scrape profile created' });
      }
      setShowDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProfile.mutateAsync(id);
      toast({ title: 'Profile deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading scrape profiles...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-gray">{profiles.length} scrape profile{profiles.length !== 1 ? 's' : ''}</p>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> New Profile</Button>
      </div>

      <div className="space-y-3">
        {profiles.map((p: any) => (
          <div key={p.id} className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Settings2 className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <h3 className="text-sm font-medium text-bone-white truncate">{p.name}</h3>
                </div>
                {p.description && <p className="text-xs text-muted-gray mb-1">{p.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-gray">
                  <span>{p.max_pages_per_site} pages/site</span>
                  <span>{p.delay_ms}ms delay</span>
                  {p.require_email && <span className="text-amber-400">Require email</span>}
                  {p.require_phone && <span className="text-amber-400">Require phone</span>}
                  {p.min_match_score > 0 && <span>Min score: {p.min_match_score}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-gray">
                  <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{p.total_jobs || 0} jobs</span>
                  <span>{p.total_leads || 0} leads</span>
                  {Number(p.avg_match_score) > 0 && <span>Avg score: {Math.round(Number(p.avg_match_score))}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button variant="ghost" size="sm" onClick={() => openDuplicate(p)} title="Duplicate">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {profiles.length === 0 && (
          <div className="text-center py-12 text-muted-gray">
            <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No scrape profiles yet.</p>
            <p className="text-sm mt-1">Create reusable scraping configs for discovery-sourced jobs.</p>
          </div>
        )}
      </div>

      {/* Profile Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Edit Scrape Profile' : 'New Scrape Profile'}</DialogTitle>
            <DialogDescription>Configure how sites are scraped and scored.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard B2B Scrape" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional..." />
            </div>

            <div className="text-xs text-muted-gray font-medium uppercase tracking-wider pt-2">Scraping Behavior</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Pages / Site</Label>
                <Input type="number" value={form.max_pages_per_site} onChange={(e) => setForm({ ...form, max_pages_per_site: parseInt(e.target.value) || 5 })} />
              </div>
              <div>
                <Label>Delay (ms)</Label>
                <Input type="number" value={form.delay_ms} onChange={(e) => setForm({ ...form, delay_ms: parseInt(e.target.value) || 2000 })} />
              </div>
            </div>
            <div>
              <Label>Paths to Visit (comma-separated)</Label>
              <Input value={form.paths_to_visit} onChange={(e) => setForm({ ...form, paths_to_visit: e.target.value })} placeholder="/about, /contact, /team" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Depth</Label>
                <Input type="number" value={form.max_depth} onChange={(e) => setForm({ ...form, max_depth: parseInt(e.target.value) || 2 })} />
              </div>
              <div>
                <Label>Concurrency</Label>
                <Input type="number" value={form.concurrency} onChange={(e) => setForm({ ...form, concurrency: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.follow_internal_links} onCheckedChange={(v) => setForm({ ...form, follow_internal_links: v })} />
                <Label className="text-xs">Follow links</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.respect_robots_txt} onCheckedChange={(v) => setForm({ ...form, respect_robots_txt: v })} />
                <Label className="text-xs">Respect robots.txt</Label>
              </div>
            </div>
            <div>
              <Label>Custom User Agent</Label>
              <Input value={form.user_agent} onChange={(e) => setForm({ ...form, user_agent: e.target.value })} placeholder="Leave empty for default" />
            </div>

            <div className="text-xs text-muted-gray font-medium uppercase tracking-wider pt-2">Quality Filters</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Min Score</Label>
                <Input type="number" value={form.min_match_score} onChange={(e) => setForm({ ...form, min_match_score: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.require_email} onCheckedChange={(v) => setForm({ ...form, require_email: v })} />
                <Label className="text-xs">Require email</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.require_phone} onCheckedChange={(v) => setForm({ ...form, require_phone: v })} />
                <Label className="text-xs">Require phone</Label>
              </div>
            </div>
            <div>
              <Label>Excluded Domains</Label>
              <Input value={form.excluded_domains} onChange={(e) => setForm({ ...form, excluded_domains: e.target.value })} placeholder="facebook.com, yelp.com" />
            </div>
            <div>
              <Label>Keywords (comma-separated)</Label>
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="film production, post house" />
            </div>
            <div>
              <Label>Scoring Rules (JSON)</Label>
              <Textarea className="font-mono text-xs" rows={4} value={form.scoring_rules} onChange={(e) => setForm({ ...form, scoring_rules: e.target.value })} placeholder='{"keywords": {"high": [...], "medium": [...]}, "weights": {"keywords": 35}}' />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || createProfile.isPending || updateProfile.isPending}>
              {(createProfile.isPending || updateProfile.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingProfile ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const retryJob = useRetryScrapeJob();
  const cancelJob = useCancelScrapeJob();

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryJob.mutateAsync(jobId);
      toast({ title: 'Retry job created', description: 'A new scrape job has been launched for remaining sites.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCancelJob = async (jobId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await cancelJob.mutateAsync(jobId);
      toast({ title: 'Job cancelled' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const sources = sourcesData?.sources || [];
  const enabledSources = sources.filter((s: any) => s.enabled);
  const jobs = data?.jobs || [];
  const selectedJob = jobDetailData?.job || null;

  const activeCount = jobs.filter((j: any) => j.status === 'queued' || j.status === 'running').length;

  const formatElapsed = (createdAt: string, finishedAt?: string) => {
    const start = new Date(createdAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const secs = Math.floor((end - start) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    if (mins < 60) return `${mins}m ${remainSecs}s`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

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
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {activeCount > 0 && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              {activeCount} active
            </Badge>
          )}
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm" disabled={enabledSources.length === 0}>
          <Play className="h-4 w-4 mr-1" /> New Job
        </Button>
      </div>

      <div className="space-y-2">
        {jobs.map((job: any) => {
          const stats = typeof job.stats === 'string' ? JSON.parse(job.stats) : (job.stats || {});
          const isDiscovery = !!job.discovery_profile_name;
          const isActive = job.status === 'queued' || job.status === 'running';
          const progressPct = isDiscovery && job.total_sites > 0
            ? Math.round(((job.sites_scraped || 0) / job.total_sites) * 100)
            : 0;
          return (
            <div key={job.id} className={`bg-charcoal-black border rounded-lg p-4 cursor-pointer transition-colors ${
              isActive ? 'border-blue-500/40 hover:border-blue-500/60' : job.status === 'failed' ? 'border-red-500/30 hover:border-red-500/50' : 'border-muted-gray/20 hover:border-muted-gray/40'
            }`} onClick={() => setSelectedJobId(job.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge className={STATUS_COLORS[job.status] || ''}>{job.status}</Badge>
                  <span className="text-sm text-bone-white truncate">
                    {isDiscovery ? (
                      <span className="flex items-center gap-1">
                        <Compass className="h-3.5 w-3.5 text-accent-yellow" />
                        {job.discovery_profile_name}
                      </span>
                    ) : (
                      job.source_name || 'Unknown Source'
                    )}
                  </span>
                  {job.scrape_profile_name && (
                    <Badge variant="outline" className="text-xs">{job.scrape_profile_name}</Badge>
                  )}
                  {job.lead_count > 0 && <span className="text-xs text-muted-gray">{job.lead_count} leads</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-gray">
                  {isDiscovery && job.total_sites > 0 && (
                    <span>{job.sites_scraped || 0}/{job.total_sites} sites</span>
                  )}
                  {stats.pages_scraped > 0 && <span>{stats.pages_scraped} pages</span>}
                  {isActive && <span className="text-blue-400">{formatElapsed(job.created_at)}</span>}
                  <span>{new Date(job.created_at).toLocaleString()}</span>
                  <Eye className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Queued state */}
              {job.status === 'queued' && (
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-amber-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Launching ECS task... waiting for container to start
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                    onClick={(e) => handleCancelJob(job.id, e)} disabled={cancelJob.isPending}>
                    <StopCircle className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                </div>
              )}

              {/* Running state with progress */}
              {job.status === 'running' && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-blue-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {isDiscovery
                        ? `Scraping... ${job.sites_scraped || 0}/${job.total_sites} sites (${stats.leads_found || 0} leads, ${stats.sites_skipped || 0} skipped)`
                        : `Scraping... ${stats.pages_scraped || 0} pages, ${stats.leads_found || 0} leads found`
                      }
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                      onClick={(e) => handleCancelJob(job.id, e)} disabled={cancelJob.isPending}>
                      <StopCircle className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  </div>
                  {isDiscovery && job.total_sites > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-muted-gray/20 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.max(progressPct, 2)}%` }} />
                    </div>
                  )}
                </div>
              )}

              {/* Completed state summary */}
              {job.status === 'completed' && (stats.leads_found > 0 || stats.sites_scraped > 0) && (
                <div className="mt-2 flex items-center gap-3 text-xs text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {isDiscovery
                    ? `${stats.sites_scraped || 0} sites scraped, ${stats.leads_found || 0} leads, ${stats.sites_skipped || 0} skipped`
                    : `${stats.leads_found || 0} leads found, ${stats.duplicates_skipped || 0} duplicates skipped`
                  }
                  {job.finished_at && <span className="text-muted-gray">({formatElapsed(job.created_at, job.finished_at)})</span>}
                </div>
              )}

              {/* Failed state */}
              {job.status === 'failed' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate flex-1">{job.error_message || 'Job failed — check CloudWatch logs for details'}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleRetryJob(job.id); }}
                    disabled={retryJob.isPending}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              )}

              {/* Cancelled state */}
              {job.status === 'cancelled' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-orange-400">
                  <StopCircle className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate flex-1">Cancelled by user</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleRetryJob(job.id); }}
                    disabled={retryJob.isPending}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {jobs.length === 0 && (
          <div className="text-center py-12 text-muted-gray">
            <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No scrape jobs yet.</p>
            <p className="text-xs mt-1">Start scraping from the Discovery tab, or create a manual job from a source.</p>
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
        <DialogContent className="max-w-md max-h-[70vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>Scrape job information and stats.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 -mx-6 px-6">
          {selectedJob && (() => {
            const stats = typeof selectedJob.stats === 'string' ? JSON.parse(selectedJob.stats) : (selectedJob.stats || {});
            const isDiscovery = !!selectedJob.discovery_profile_name;
            const isActive = selectedJob.status === 'queued' || selectedJob.status === 'running';
            const progressPct = isDiscovery && selectedJob.total_sites > 0
              ? Math.round(((selectedJob.sites_scraped || 0) / selectedJob.total_sites) * 100)
              : 0;
            return (
              <div className="space-y-3">
                {/* Status banner for active jobs */}
                {isActive && (
                  <div className={`rounded-lg p-3 ${selectedJob.status === 'queued' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className={`h-4 w-4 animate-spin ${selectedJob.status === 'queued' ? 'text-amber-400' : 'text-blue-400'}`} />
                      <span className={selectedJob.status === 'queued' ? 'text-amber-400' : 'text-blue-400'}>
                        {selectedJob.status === 'queued'
                          ? 'Launching ECS Fargate task...'
                          : isDiscovery
                            ? `Scraping ${selectedJob.sites_scraped || 0} of ${selectedJob.total_sites} sites...`
                            : `Scraping... ${stats.pages_scraped || 0} pages processed`
                        }
                      </span>
                    </div>
                    {selectedJob.status === 'running' && isDiscovery && selectedJob.total_sites > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="w-full h-2 rounded-full bg-muted-gray/20 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.max(progressPct, 2)}%` }} />
                        </div>
                        <p className="text-xs text-muted-gray text-right">{progressPct}% complete</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-gray">Elapsed: {formatElapsed(selectedJob.created_at)} &middot; Auto-refreshing every 5s</p>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                        onClick={() => handleCancelJob(selectedJob.id)} disabled={cancelJob.isPending}>
                        <StopCircle className="h-3.5 w-3.5 mr-1" /> Cancel Job
                      </Button>
                    </div>
                  </div>
                )}

                {/* Cancelled banner */}
                {selectedJob.status === 'cancelled' && (
                  <div className="rounded-lg p-3 bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-2 text-sm text-orange-400">
                      <StopCircle className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">Job Cancelled</span>
                    </div>
                    {selectedJob.finished_at && (
                      <p className="text-xs text-muted-gray mt-1">Cancelled after {formatElapsed(selectedJob.created_at, selectedJob.finished_at)}</p>
                    )}
                  </div>
                )}

                {/* Failed banner */}
                {selectedJob.status === 'failed' && (
                  <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">Job Failed</span>
                    </div>
                    <p className="text-xs text-red-300 mt-1 break-words">{selectedJob.error_message || 'Unknown error — check CloudWatch logs at /ecs/swn-scraper'}</p>
                    {selectedJob.finished_at && (
                      <p className="text-xs text-muted-gray mt-1">Failed after {formatElapsed(selectedJob.created_at, selectedJob.finished_at)}</p>
                    )}
                  </div>
                )}

                {/* Completed banner */}
                {selectedJob.status === 'completed' && (
                  <div className="rounded-lg p-3 bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Job Completed</span>
                    </div>
                    {selectedJob.finished_at && (
                      <p className="text-xs text-muted-gray mt-1">Finished in {formatElapsed(selectedJob.created_at, selectedJob.finished_at)}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-gray">Source:</span>
                    <p className="text-bone-white">{isDiscovery ? selectedJob.discovery_profile_name : selectedJob.source_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-gray">Status:</span>
                    <div><Badge className={STATUS_COLORS[selectedJob.status] || ''}>{selectedJob.status}</Badge></div>
                  </div>
                  {selectedJob.scrape_profile_name && (
                    <div>
                      <span className="text-muted-gray">Scrape Profile:</span>
                      <p className="text-bone-white">{selectedJob.scrape_profile_name}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-gray">Created by:</span>
                    <p className="text-bone-white">{selectedJob.created_by_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-gray">Created:</span>
                    <p className="text-bone-white text-xs">{new Date(selectedJob.created_at).toLocaleString()}</p>
                  </div>
                  {selectedJob.started_at && (
                    <div>
                      <span className="text-muted-gray">Started:</span>
                      <p className="text-bone-white text-xs">{new Date(selectedJob.started_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
                <div className="border-t border-muted-gray/20 pt-3">
                  <h4 className="text-sm font-medium text-bone-white mb-2">Stats</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {isDiscovery && (
                      <div className="bg-muted-gray/10 rounded p-2">
                        <p className="text-muted-gray text-xs">Sites Scraped</p>
                        <p className="text-bone-white text-lg font-medium">{selectedJob.sites_scraped || 0}/{selectedJob.total_sites || 0}</p>
                      </div>
                    )}
                    <div className="bg-muted-gray/10 rounded p-2">
                      <p className="text-muted-gray text-xs">Pages Scraped</p>
                      <p className="text-bone-white text-lg font-medium">{stats.pages_scraped || 0}</p>
                    </div>
                    <div className="bg-muted-gray/10 rounded p-2">
                      <p className="text-muted-gray text-xs">Leads Found</p>
                      <p className="text-bone-white text-lg font-medium">{stats.leads_found || 0}</p>
                    </div>
                    {isDiscovery && (
                      <div className="bg-muted-gray/10 rounded p-2">
                        <p className="text-muted-gray text-xs">Sites Skipped</p>
                        <p className="text-bone-white text-lg font-medium">{stats.sites_skipped || 0}</p>
                      </div>
                    )}
                    {isDiscovery && (
                      <div className="bg-muted-gray/10 rounded p-2">
                        <p className="text-muted-gray text-xs">Pages Failed</p>
                        <p className={`text-lg font-medium ${(stats.pages_failed || 0) > 0 ? 'text-amber-400' : 'text-bone-white'}`}>{stats.pages_failed || 0}</p>
                      </div>
                    )}
                    {isDiscovery && (
                      <div className="bg-muted-gray/10 rounded p-2">
                        <p className="text-muted-gray text-xs">Filtered Out</p>
                        <p className="text-bone-white text-lg font-medium">{stats.leads_filtered || 0}</p>
                      </div>
                    )}
                    {!isDiscovery && (
                      <div className="bg-muted-gray/10 rounded p-2">
                        <p className="text-muted-gray text-xs">Duplicates Skipped</p>
                        <p className="text-bone-white text-lg font-medium">{stats.duplicates_skipped || 0}</p>
                      </div>
                    )}
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
                {selectedJob.ecs_task_arn && (
                  <div className="border-t border-muted-gray/20 pt-3">
                    <p className="text-xs text-muted-gray break-all">ECS: {selectedJob.ecs_task_arn}</p>
                  </div>
                )}

                {/* Retry button for failed/completed/cancelled jobs */}
                {(selectedJob.status === 'failed' || selectedJob.status === 'completed' || selectedJob.status === 'cancelled') && (
                  <div className="border-t border-muted-gray/20 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleRetryJob(selectedJob.id)}
                      disabled={retryJob.isPending}
                    >
                      {retryJob.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                      {selectedJob.status === 'failed' ? 'Retry Failed Sites' : 'Re-scrape Remaining Sites'}
                    </Button>
                    <p className="text-xs text-muted-gray mt-1 text-center">
                      Creates a new job targeting sites that weren't successfully scraped
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
          </div>
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
  const { data: scrapeProfilesData } = useScrapeProfiles();
  const { data: leadListsData } = useLeadLists();
  const [jobFilter, setJobFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [countryFilter, setCountryFilter] = useState('');
  const [hasEmailFilter, setHasEmailFilter] = useState<string>('all');
  const [hasPhoneFilter, setHasPhoneFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sortBy, setSortBy] = useState('match_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRescrapeDialog, setShowRescrapeDialog] = useState(false);
  const [showAddToListDialog, setShowAddToListDialog] = useState(false);
  const [rescrapeProfileId, setRescrapeProfileId] = useState('');
  const [rescrapeThouroughness, setRescrapeThouroughness] = useState('standard');
  const [rescrapePreset, setRescrapePreset] = useState('');
  const [rescrapeFilters, setRescrapeFilters] = useState<Record<string, boolean>>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [extraTags, setExtraTags] = useState('');
  const [enrollSequence, setEnrollSequence] = useState(false);
  const [addToListId, setAddToListId] = useState('');
  const [newListName, setNewListName] = useState('');

  const PAGE_SIZE = 50;

  const { data, isLoading } = useScrapedLeads({
    job_id: jobFilter !== 'all' ? jobFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    min_score: minScore ? parseInt(minScore) : undefined,
    country: countryFilter || undefined,
    has_email: hasEmailFilter === 'all' ? undefined : hasEmailFilter === 'yes',
    has_phone: hasPhoneFilter === 'all' ? undefined : hasPhoneFilter === 'yes',
    search: search || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const approveLeads = useBulkApproveLeads();
  const rejectLeads = useBulkRejectLeads();
  const rescrapeLeads = useRescrapeLeads();
  const createLeadList = useCreateLeadList();
  const addLeadsToList = useAddLeadsToList();

  const leads = data?.leads || [];
  const total = data?.total || 0;
  const jobs = jobsData?.jobs || [];
  const scrapeProfiles = scrapeProfilesData?.profiles || [];
  const existingLists = leadListsData?.lists || [];
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

  const handleRescrape = async () => {
    if (!rescrapeProfileId) return;
    try {
      const filters: Record<string, any> = { ...rescrapeFilters, status: 'pending' };
      const result = await rescrapeLeads.mutateAsync({
        scrape_profile_id: rescrapeProfileId,
        lead_ids: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
        filters: selectedIds.size === 0 ? filters : undefined,
        thoroughness: rescrapeThouroughness,
      });
      toast({ title: `Re-scrape job created for ${result.leads_count} sites` });
      setSelectedIds(new Set());
      setShowRescrapeDialog(false);
      setRescrapeProfileId('');
      setRescrapeThouroughness('standard');
      setRescrapePreset('');
      setRescrapeFilters({});
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddToList = async () => {
    if (selectedIds.size === 0) return;
    try {
      let targetListId = addToListId;
      if (targetListId === 'new' && newListName) {
        const result = await createLeadList.mutateAsync({
          name: newListName,
          lead_ids: Array.from(selectedIds),
        });
        toast({ title: `Created list "${newListName}" with ${selectedIds.size} leads` });
        setSelectedIds(new Set());
        setShowAddToListDialog(false);
        setNewListName('');
        setAddToListId('');
        return;
      }
      if (!targetListId || targetListId === 'new') return;
      const result = await addLeadsToList.mutateAsync({
        listId: targetListId,
        leadIds: Array.from(selectedIds),
      });
      toast({ title: `Added ${result.added} leads to list` });
      setSelectedIds(new Set());
      setShowAddToListDialog(false);
      setAddToListId('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const applyRescrapePreset = (preset: string) => {
    if (rescrapePreset === preset) {
      setRescrapePreset('');
      setRescrapeFilters({});
      return;
    }
    setRescrapePreset(preset);
    switch (preset) {
      case 'missing_contact':
        setRescrapeFilters({ has_email: false, has_phone: false });
        break;
      case 'missing_email':
        setRescrapeFilters({ has_email: false });
        break;
      case 'missing_phone':
        setRescrapeFilters({ has_phone: false });
        break;
      case 'missing_address':
        setRescrapeFilters({ has_address: false });
        break;
      case 'low_quality':
        setRescrapeFilters({ max_score: 40 });
        break;
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
            {jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{(j.source_name || j.discovery_profile_name || 'Job')} ({new Date(j.created_at).toLocaleDateString()})</SelectItem>)}
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
        <Select value={hasPhoneFilter} onValueChange={(v) => { setHasPhoneFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Has phone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any phone</SelectItem>
            <SelectItem value="yes">Has phone</SelectItem>
            <SelectItem value="no">No phone</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => { setSelectedIds(new Set()); setRescrapeProfileId(''); setRescrapePreset(''); setRescrapeFilters({}); setShowRescrapeDialog(true); }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-scrape Batch
        </Button>
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
          <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => { setRescrapeProfileId(''); setShowRescrapeDialog(true); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-scrape
          </Button>
          <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => { setAddToListId(''); setShowAddToListDialog(true); }}>
            <ListPlus className="h-3.5 w-3.5 mr-1" /> Add to List
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
                  <th className="p-2">Source</th>
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
                        <div className="flex flex-col gap-0.5">
                          {lead.email.split('\n').map((e: string, i: number) => (
                            <span key={i} className="flex items-center gap-1 text-xs text-muted-gray">
                              {i === 0 && <Mail className="h-3 w-3 flex-shrink-0" />}
                              {i > 0 && <span className="w-3" />}
                              <span className="truncate max-w-[180px]">{e}</span>
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-muted-gray/50">-</span>}
                    </td>
                    <td className="p-2">
                      {lead.phone ? (
                        <div className="flex flex-col gap-0.5">
                          {lead.phone.split('\n').map((p: string, i: number) => (
                            <span key={i} className="flex items-center gap-1 text-xs text-muted-gray">
                              {i === 0 && <Phone className="h-3 w-3 flex-shrink-0" />}
                              {i > 0 && <span className="w-3" />}
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-muted-gray/50">-</span>}
                    </td>
                    <td className="p-2 text-xs text-muted-gray">{lead.country || '-'}</td>
                    <td className="p-2"><ScoreBar score={lead.match_score} /></td>
                    <td className="p-2 text-xs text-muted-gray max-w-[120px] truncate">{lead.source_name || '-'}</td>
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

      {/* Enhanced Re-scrape Dialog */}
      <Dialog open={showRescrapeDialog} onOpenChange={setShowRescrapeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Re-scrape Leads</DialogTitle>
            <DialogDescription>
              {selectedIds.size > 0
                ? `Re-scrape ${selectedIds.size} selected lead${selectedIds.size !== 1 ? 's' : ''} with deeper extraction`
                : 'Re-scrape leads matching filter criteria'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Smart filter presets — only show when no specific leads selected */}
            {selectedIds.size === 0 && (
              <div>
                <Label className="text-xs text-muted-gray mb-2 block">Quick Filters</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'missing_contact', label: 'Missing Contact Info', icon: '📭' },
                    { id: 'missing_email', label: 'Missing Email Only', icon: '✉️' },
                    { id: 'missing_phone', label: 'Missing Phone Only', icon: '📱' },
                    { id: 'missing_address', label: 'Missing Address', icon: '📍' },
                    { id: 'low_quality', label: 'Low Quality (<40)', icon: '⚠️' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyRescrapePreset(p.id)}
                      className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                        rescrapePreset === p.id
                          ? 'bg-accent-yellow/20 border-accent-yellow/40 text-accent-yellow'
                          : 'bg-muted-gray/5 border-muted-gray/20 text-muted-gray hover:text-bone-white hover:border-muted-gray/40'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Advanced filters toggle */}
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center gap-1 text-xs text-muted-gray hover:text-bone-white mt-2"
                >
                  <Filter className="h-3 w-3" />
                  {showAdvancedFilters ? 'Hide' : 'Show'} advanced filters
                </button>
                {showAdvancedFilters && (
                  <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                    {[
                      { key: 'has_email', label: 'Missing email', value: false },
                      { key: 'has_phone', label: 'Missing phone', value: false },
                      { key: 'has_address', label: 'Missing address', value: false },
                    ].map((f) => (
                      <label key={f.key} className="flex items-center gap-2 text-xs text-muted-gray cursor-pointer">
                        <Checkbox
                          checked={rescrapeFilters[f.key] === f.value}
                          onCheckedChange={(checked) => {
                            setRescrapePreset('');
                            setRescrapeFilters((prev) => {
                              const next = { ...prev };
                              if (checked) next[f.key] = f.value;
                              else delete next[f.key];
                              return next;
                            });
                          }}
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Thoroughness selector */}
            <div>
              <Label className="text-xs text-muted-gray mb-2 block">Thoroughness</Label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'quick', label: 'Quick', desc: '3 pages' },
                  { id: 'standard', label: 'Standard', desc: '5 pages' },
                  { id: 'thorough', label: 'Thorough', desc: '10p + links' },
                  { id: 'deep', label: 'Deep Crawl', desc: '20p recursive' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setRescrapeThouroughness(t.id)}
                    className={`px-2 py-2 rounded-md border text-center transition-colors ${
                      rescrapeThouroughness === t.id
                        ? 'bg-accent-yellow/20 border-accent-yellow/40 text-accent-yellow'
                        : 'bg-muted-gray/5 border-muted-gray/20 text-muted-gray hover:text-bone-white'
                    }`}
                  >
                    <div className="text-xs font-medium">{t.label}</div>
                    <div className="text-[10px] opacity-70">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scrape profile selector */}
            <div>
              <Label className="text-xs text-muted-gray">Scrape Profile</Label>
              <Select value={rescrapeProfileId} onValueChange={setRescrapeProfileId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select profile..." /></SelectTrigger>
                <SelectContent>
                  {scrapeProfiles.map((sp: any) => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray/60 mt-1">Thoroughness overrides page/depth settings from profile</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRescrapeDialog(false)}>Cancel</Button>
            <Button onClick={handleRescrape} disabled={!rescrapeProfileId || rescrapeLeads.isPending}>
              {rescrapeLeads.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <RefreshCw className="h-4 w-4 mr-1" /> Start Re-scrape
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to List Dialog */}
      <Dialog open={showAddToListDialog} onOpenChange={setShowAddToListDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''} to List</DialogTitle>
            <DialogDescription>Choose an existing list or create a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select List</Label>
              <Select value={addToListId} onValueChange={(v) => { setAddToListId(v); setNewListName(''); }}>
                <SelectTrigger><SelectValue placeholder="Choose a list..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ Create New List</SelectItem>
                  {existingLists.map((ll: any) => (
                    <SelectItem key={ll.id} value={ll.id}>{ll.name} ({ll.actual_count || ll.lead_count} leads)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {addToListId === 'new' && (
              <div>
                <Label>New List Name</Label>
                <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="e.g. Q1 2026 Outreach" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddToListDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAddToList}
              disabled={(!addToListId || (addToListId === 'new' && !newListName)) || addLeadsToList.isPending || createLeadList.isPending}
            >
              {(addLeadsToList.isPending || createLeadList.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <ListPlus className="h-4 w-4 mr-1" /> Add to List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Lead Lists Tab (replaces Clean & Import)
// ============================================================================

const CHATGPT_PROMPT = `You are a B2B lead-data cleaning assistant for a film/TV production SaaS company called Backlot (by Second Watch Network).

I'm going to paste a CSV or table of scraped company leads. For each row, please:

1. **Standardise the company name** — proper casing, remove trailing "Inc.", "LLC" etc. unless it's clearly part of the brand.
2. **Find a real contact person** — search the company's website or LinkedIn to fill in "contact_name" (Full Name) and "contact_title" (e.g. Head of Post, EP, Owner). If you can't find one, leave blank.
3. **Validate / find email** — if the email column is empty or is a generic info@ address, try to find a direct business email for the contact person. If uncertain, leave blank rather than guess.
4. **Validate phone** — format as +1 (XXX) XXX-XXXX for US numbers. Remove extensions or invalid numbers.
5. **Normalise address fields** — split into address_line1, city, state_region, postal_code, country (ISO 2-letter). Fix obvious typos.
6. **Normalise website** — ensure it starts with https://, remove trailing slashes.
7. **Add tags** — suggest 1-3 comma-separated tags from this list that best describe the company: "Production Company", "Post House", "VFX Studio", "Animation Studio", "Rental House", "Broadcaster", "Streaming", "Agency", "Faith-Based", "Independent", "Studio/Major"
8. **Flag duplicates** — if two rows look like the same company, mark the duplicate row with tag "DUPLICATE".
9. **Remove junk rows** — if a row is clearly not a real company (e.g. a navigation link, footer text, or personal blog), delete it entirely.

Output a clean table with these exact columns (in this order):
company_name, contact_name, contact_title, email, phone, website, address_line1, city, state_region, postal_code, country, tags, source_url, notes, import_source

Keep import_source as "scraped" for all rows. Put the original website in source_url.

Here is the data:

[PASTE YOUR EXPORTED DATA HERE]`;

const LIST_STATUS_COLORS: Record<string, string> = {
  raw: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
  exported: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  cleaning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  cleaned: 'bg-green-500/20 text-green-400 border-green-500/30',
  imported: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const LIST_TYPE_COLORS: Record<string, string> = {
  manual: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
  auto_export: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  auto_rescrape: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

function LeadListsTab() {
  const { toast } = useToast();
  const { data: listsData, isLoading: loadingLists } = useLeadLists();
  const createList = useCreateLeadList();
  const deleteList = useDeleteLeadList();
  const updateList = useUpdateLeadList();
  const exportList = useExportLeadList();
  const importToList = useImportToLeadList();
  const removeLeads = useRemoveLeadsFromList();
  const addLeads = useAddLeadsToList();
  const { data: stagedData } = useScrapedLeads({ status: 'pending', limit: 200 });

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showAddLeadsDialog, setShowAddLeadsDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [renameListId, setRenameListId] = useState('');
  const [renameName, setRenameName] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [addLeadSearch, setAddLeadSearch] = useState('');
  const [addLeadSelected, setAddLeadSelected] = useState<Set<string>>(new Set());
  const [listPage, setListPage] = useState(0);
  const [copied, setCopied] = useState(false);
  const [importTags, setImportTags] = useState('Backlot Prospect');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number; skipped: number; errors: string[]; total_rows: number;
  } | null>(null);

  const LIST_PAGE_SIZE = 50;
  const lists = listsData?.lists || [];
  const selectedList = lists.find((l: any) => l.id === selectedListId);

  const { data: listLeadsData, isLoading: loadingLeads } = useLeadListLeads(
    selectedListId || undefined,
    { limit: LIST_PAGE_SIZE, offset: listPage * LIST_PAGE_SIZE }
  );

  const listLeads = listLeadsData?.leads || [];
  const listLeadsTotal = listLeadsData?.total || 0;
  const listTotalPages = Math.ceil(listLeadsTotal / LIST_PAGE_SIZE);
  const stagedLeads = stagedData?.leads || [];

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createList.mutateAsync({ name: newName.trim(), description: newDesc.trim() || undefined });
      toast({ title: `List "${newName}" created` });
      setShowCreateDialog(false);
      setNewName('');
      setNewDesc('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRename = async () => {
    if (!renameName.trim() || !renameListId) return;
    try {
      await updateList.mutateAsync({ id: renameListId, data: { name: renameName.trim() } });
      toast({ title: 'List renamed' });
      setShowRenameDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteList.mutateAsync(id);
      toast({ title: 'List deleted' });
      if (selectedListId === id) setSelectedListId(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleExport = async () => {
    if (!selectedListId) return;
    try {
      const blob = await exportList.mutateAsync(selectedListId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(selectedList?.name || 'lead_list').replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'List exported to Excel' });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(CHATGPT_PROMPT);
    setCopied(true);
    toast({ title: 'ChatGPT prompt copied to clipboard' });
    setTimeout(() => setCopied(false), 3000);
  }, [toast]);

  const handleMarkCleaning = async () => {
    if (!selectedListId) return;
    try {
      await updateList.mutateAsync({ id: selectedListId, data: { status: 'cleaning' } });
      toast({ title: 'List marked as cleaning' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast({ title: 'Invalid file type', description: 'Please upload an .xlsx file', variant: 'destructive' });
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedListId) return;
    try {
      const result = await importToList.mutateAsync({
        listId: selectedListId,
        file: selectedFile,
        tags: importTags || undefined,
      });
      setImportResult(result);
      toast({
        title: `Imported ${result.created} contacts`,
        description: result.skipped > 0 ? `${result.skipped} rows skipped` : undefined,
      });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedLeadIds.size === 0 || !selectedListId) return;
    try {
      const result = await removeLeads.mutateAsync({
        listId: selectedListId,
        leadIds: Array.from(selectedLeadIds),
      });
      toast({ title: `Removed ${result.removed} leads from list` });
      setSelectedLeadIds(new Set());
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddLeads = async () => {
    if (addLeadSelected.size === 0 || !selectedListId) return;
    try {
      const result = await addLeads.mutateAsync({
        listId: selectedListId,
        leadIds: Array.from(addLeadSelected),
      });
      toast({ title: `Added ${result.added} leads to list` });
      setShowAddLeadsDialog(false);
      setAddLeadSelected(new Set());
      setAddLeadSearch('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Detail view for a selected list
  if (selectedListId && selectedList) {
    const status = selectedList.status;

    return (
      <div>
        {/* Breadcrumb */}
        <button onClick={() => { setSelectedListId(null); setSelectedLeadIds(new Set()); setListPage(0); }} className="flex items-center gap-1 text-sm text-muted-gray hover:text-bone-white mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to lists
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-accent-yellow" />
            <h3 className="text-lg font-heading text-bone-white">{selectedList.name}</h3>
            <Badge className={`text-xs ${LIST_STATUS_COLORS[status] || ''}`}>{status}</Badge>
            <Badge className={`text-xs ${LIST_TYPE_COLORS[selectedList.list_type] || ''}`}>
              {selectedList.list_type === 'auto_export' ? 'Auto (Export)' : selectedList.list_type === 'auto_rescrape' ? 'Auto (Re-scrape)' : 'Manual'}
            </Badge>
            <span className="text-sm text-muted-gray">{selectedList.actual_count || selectedList.lead_count} leads</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAddLeadsDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Leads
            </Button>
            {selectedLeadIds.size > 0 && (
              <Button size="sm" variant="outline" className="border-red-500/30 text-red-400" onClick={handleRemoveSelected}>
                <X className="h-3.5 w-3.5 mr-1" /> Remove {selectedLeadIds.size}
              </Button>
            )}
          </div>
        </div>

        {/* Pipeline actions based on status */}
        <div className="mb-4 p-3 bg-muted-gray/5 border border-muted-gray/10 rounded-lg">
          {status === 'raw' && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-gray">Export this list to Excel for ChatGPT cleaning.</p>
              <Button size="sm" onClick={handleExport} disabled={exportList.isPending}>
                {exportList.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Export to Excel
              </Button>
            </div>
          )}
          {status === 'exported' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-gray">Copy the ChatGPT prompt, clean your data, then mark as cleaning.</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyPrompt}>
                    {copied ? <><Check className="h-3.5 w-3.5 mr-1" /> Copied!</> : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy Prompt</>}
                  </Button>
                  <Button size="sm" onClick={handleMarkCleaning}>Mark as Cleaning</Button>
                </div>
              </div>
            </div>
          )}
          {status === 'cleaning' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-gray">Upload your ChatGPT-cleaned .xlsx file to import as CRM contacts.</p>
              <div className="flex items-center gap-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-muted-gray/30 rounded-lg p-4 text-center cursor-pointer hover:border-accent-yellow/40 transition-colors"
                >
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-green-400" />
                      <span className="text-sm text-bone-white">{selectedFile.name}</span>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-gray"><Upload className="h-4 w-4 inline mr-1" /> Select cleaned .xlsx file</p>
                  )}
                </div>
                <div className="w-[200px]">
                  <Input value={importTags} onChange={(e) => setImportTags(e.target.value)} placeholder="Tags" className="text-sm" />
                </div>
                <Button onClick={handleImport} disabled={!selectedFile || importToList.isPending}>
                  {importToList.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Import
                </Button>
              </div>
            </div>
          )}
          {status === 'imported' && importResult && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-500/10 rounded p-3 text-center">
                <p className="text-xl font-bold text-green-400">{importResult.created}</p>
                <p className="text-xs text-muted-gray">Created</p>
              </div>
              <div className="bg-amber-500/10 rounded p-3 text-center">
                <p className="text-xl font-bold text-amber-400">{importResult.skipped}</p>
                <p className="text-xs text-muted-gray">Skipped</p>
              </div>
              <div className="bg-red-500/10 rounded p-3 text-center">
                <p className="text-xl font-bold text-red-400">{importResult.errors.length}</p>
                <p className="text-xs text-muted-gray">Errors</p>
              </div>
            </div>
          )}
          {status === 'imported' && !importResult && (
            <p className="text-sm text-green-400 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> This list has been imported into CRM contacts.</p>
          )}
        </div>

        {/* Leads table */}
        {loadingLeads ? (
          <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading leads...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted-gray/20 text-left text-xs text-muted-gray">
                    <th className="p-2 w-8">
                      <Checkbox
                        checked={listLeads.length > 0 && selectedLeadIds.size === listLeads.length}
                        onCheckedChange={() => {
                          if (selectedLeadIds.size === listLeads.length) setSelectedLeadIds(new Set());
                          else setSelectedLeadIds(new Set(listLeads.map((l: any) => l.id)));
                        }}
                      />
                    </th>
                    <th className="p-2">Company</th>
                    <th className="p-2">Website</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Phone</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {listLeads.map((lead: any) => (
                    <tr key={lead.id} className="border-b border-muted-gray/10 hover:bg-muted-gray/5">
                      <td className="p-2">
                        <Checkbox
                          checked={selectedLeadIds.has(lead.id)}
                          onCheckedChange={() => {
                            setSelectedLeadIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(lead.id)) next.delete(lead.id);
                              else next.add(lead.id);
                              return next;
                            });
                          }}
                        />
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
                      <td className="p-2 text-xs text-muted-gray max-w-[180px] truncate">
                        {lead.email ? lead.email.split('\n')[0] : <span className="text-muted-gray/50">-</span>}
                      </td>
                      <td className="p-2 text-xs text-muted-gray">
                        {lead.phone ? lead.phone.split('\n')[0] : <span className="text-muted-gray/50">-</span>}
                      </td>
                      <td className="p-2"><ScoreBar score={lead.match_score} /></td>
                      <td className="p-2"><Badge className={`text-xs ${STATUS_COLORS[lead.status] || ''}`}>{lead.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {listLeads.length === 0 && (
              <div className="text-center py-8 text-muted-gray">
                <p>No leads in this list yet.</p>
              </div>
            )}
            {listTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-muted-gray">
                <span>{listPage * LIST_PAGE_SIZE + 1}-{Math.min((listPage + 1) * LIST_PAGE_SIZE, listLeadsTotal)} of {listLeadsTotal}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={listPage === 0} onClick={() => setListPage(listPage - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2">Page {listPage + 1} of {listTotalPages}</span>
                  <Button variant="ghost" size="sm" disabled={listPage >= listTotalPages - 1} onClick={() => setListPage(listPage + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Add Leads Dialog */}
        <Dialog open={showAddLeadsDialog} onOpenChange={setShowAddLeadsDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Leads to List</DialogTitle>
              <DialogDescription>Select staged leads to add to "{selectedList.name}"</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Search leads..." value={addLeadSearch} onChange={(e) => setAddLeadSearch(e.target.value)} />
              <div className="max-h-[300px] overflow-y-auto border border-muted-gray/20 rounded-lg">
                {stagedLeads
                  .filter((l: any) => !addLeadSearch || l.company_name?.toLowerCase().includes(addLeadSearch.toLowerCase()) || l.website?.toLowerCase().includes(addLeadSearch.toLowerCase()))
                  .map((lead: any) => (
                    <label key={lead.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted-gray/5 cursor-pointer border-b border-muted-gray/10 last:border-0">
                      <Checkbox
                        checked={addLeadSelected.has(lead.id)}
                        onCheckedChange={() => {
                          setAddLeadSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(lead.id)) next.delete(lead.id);
                            else next.add(lead.id);
                            return next;
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-bone-white truncate">{lead.company_name}</p>
                        <p className="text-xs text-muted-gray truncate">{lead.website || 'No website'}</p>
                      </div>
                      <ScoreBar score={lead.match_score} />
                    </label>
                  ))}
                {stagedLeads.length === 0 && <p className="p-4 text-center text-sm text-muted-gray">No pending staged leads</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddLeadsDialog(false)}>Cancel</Button>
              <Button onClick={handleAddLeads} disabled={addLeadSelected.size === 0 || addLeads.isPending}>
                {addLeads.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Add {addLeadSelected.size} Lead{addLeadSelected.size !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Lists view (default)
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-gray">Organize leads into named groups for the export, clean, and import pipeline.</p>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create List
        </Button>
      </div>

      {loadingLists ? (
        <div className="flex items-center gap-2 text-muted-gray py-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading lists...</div>
      ) : lists.length === 0 ? (
        <div className="text-center py-12 text-muted-gray">
          <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No lead lists yet.</p>
          <p className="text-xs mt-1">Lists are created automatically when you export or re-scrape leads, or you can create one manually.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-muted-gray/20 text-left text-xs text-muted-gray">
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2">Leads</th>
                <th className="p-2">Created</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((ll: any) => (
                <tr key={ll.id} className="border-b border-muted-gray/10 hover:bg-muted-gray/5 cursor-pointer" onClick={() => { setSelectedListId(ll.id); setListPage(0); setSelectedLeadIds(new Set()); }}>
                  <td className="p-2 text-bone-white font-medium">{ll.name}</td>
                  <td className="p-2">
                    <Badge className={`text-xs ${LIST_TYPE_COLORS[ll.list_type] || ''}`}>
                      {ll.list_type === 'auto_export' ? 'Auto' : ll.list_type === 'auto_rescrape' ? 'Auto' : 'Manual'}
                    </Badge>
                  </td>
                  <td className="p-2"><Badge className={`text-xs ${LIST_STATUS_COLORS[ll.status] || ''}`}>{ll.status}</Badge></td>
                  <td className="p-2 text-muted-gray">{ll.actual_count || ll.lead_count}</td>
                  <td className="p-2 text-xs text-muted-gray">{new Date(ll.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedListId(ll.id); setListPage(0); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setRenameListId(ll.id); setRenameName(ll.name); setShowRenameDialog(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleDelete(ll.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Lead List</DialogTitle>
            <DialogDescription>Create a new list to organize leads.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Q1 2026 Outreach" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Notes about this list..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createList.isPending}>
              {createList.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename List</DialogTitle>
            <DialogDescription>Enter a new name for this list.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Name</Label>
            <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameName.trim() || updateList.isPending}>
              {updateList.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Settings Tab
// ============================================================================

const SETTING_GROUPS = [
  {
    title: 'Infrastructure',
    category: 'infrastructure',
    description: 'ECS cluster, task definitions, networking',
    keys: ['ecs_cluster', 'scraper_task_definition', 'discovery_task_definition', 'vpc_subnets', 'security_groups', 'scraper_container_name', 'discovery_container_name'],
  },
  {
    title: 'Resources',
    category: 'resources',
    description: 'CPU, memory, and capacity provider',
    keys: ['default_cpu', 'default_memory', 'capacity_provider'],
  },
  {
    title: 'API Keys',
    category: 'api_keys',
    description: 'Third-party API credentials',
    keys: ['serper_api_key'],
  },
  {
    title: 'Worker Defaults',
    category: 'worker_defaults',
    description: 'Timeouts, user agent, and scraping behavior',
    keys: ['default_http_timeout_ms', 'default_user_agent', 'discovery_query_delay_ms', 'free_email_domains', 'default_log_level'],
  },
];

const CPU_OPTIONS = ['256', '512', '1024', '2048', '4096'];
const MEMORY_OPTIONS = ['512', '1024', '2048', '4096', '8192', '16384'];
const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];

function SettingsTab() {
  const { data, isLoading } = useScrapingSettings();
  const updateMutation = useUpdateScrapingSettings();
  const { toast } = useToast();

  const [form, setForm] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize form from loaded settings
  const settings = data?.settings || [];
  if (settings.length > 0 && !initialized) {
    const initial: Record<string, string> = {};
    for (const s of settings) {
      initial[s.key] = s.value;
    }
    setForm(initial);
    setInitialized(true);
  }

  const settingsMap = Object.fromEntries(settings.map((s: any) => [s.key, s]));

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Only send changed keys
    const changes: Record<string, string> = {};
    for (const [key, value] of Object.entries(form)) {
      const original = settingsMap[key];
      if (!original || original.value !== value) {
        changes[key] = value;
      }
    }

    if (Object.keys(changes).length === 0) {
      toast({ title: 'No changes', description: 'Nothing to update.' });
      return;
    }

    updateMutation.mutate(changes, {
      onSuccess: (res) => {
        toast({ title: 'Settings saved', description: `Updated ${res.updated.length} setting(s).` });
        setInitialized(false); // re-sync from server
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
      },
    });
  };

  const renderField = (key: string) => {
    const meta = settingsMap[key];
    const value = form[key] ?? '';
    const label = (meta?.description || key).replace(/_/g, ' ');

    // Special dropdowns
    if (key === 'default_cpu') {
      return (
        <div key={key} className="space-y-1">
          <Label className="text-xs text-muted-gray">{label}</Label>
          <Select value={value} onValueChange={(v) => handleChange(key, v)}>
            <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CPU_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt} CPU units</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (key === 'default_memory') {
      return (
        <div key={key} className="space-y-1">
          <Label className="text-xs text-muted-gray">{label}</Label>
          <Select value={value} onValueChange={(v) => handleChange(key, v)}>
            <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMORY_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt} MB</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (key === 'capacity_provider') {
      return (
        <div key={key} className="space-y-1">
          <Label className="text-xs text-muted-gray">{label}</Label>
          <Select value={value} onValueChange={(v) => handleChange(key, v)}>
            <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FARGATE">FARGATE (On-demand)</SelectItem>
              <SelectItem value="FARGATE_SPOT">FARGATE_SPOT (Cost-optimized)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (key === 'default_log_level') {
      return (
        <div key={key} className="space-y-1">
          <Label className="text-xs text-muted-gray">{label}</Label>
          <Select value={value} onValueChange={(v) => handleChange(key, v)}>
            <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOG_LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (key === 'free_email_domains') {
      return (
        <div key={key} className="space-y-1 col-span-2">
          <Label className="text-xs text-muted-gray">{label}</Label>
          <Textarea
            value={value}
            onChange={(e) => handleChange(key, e.target.value)}
            className="bg-charcoal-black border-muted-gray/30 text-bone-white text-sm h-20 font-mono"
            placeholder="gmail.com,yahoo.com,..."
          />
        </div>
      );
    }

    // Secret fields with show/hide
    if (meta?.is_secret) {
      const visible = showSecrets[key];
      return (
        <div key={key} className="space-y-1">
          <Label className="text-xs text-muted-gray">{label}</Label>
          <div className="relative">
            <Input
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={(e) => handleChange(key, e.target.value)}
              className="bg-charcoal-black border-muted-gray/30 text-bone-white h-9 pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-gray hover:text-bone-white"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      );
    }

    // Default text input
    return (
      <div key={key} className={key === 'default_user_agent' ? 'space-y-1 col-span-2' : 'space-y-1'}>
        <Label className="text-xs text-muted-gray">{label}</Label>
        <Input
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
          className="bg-charcoal-black border-muted-gray/30 text-bone-white h-9 font-mono text-sm"
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-gray" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-bone-white font-heading">Docker / Container Settings</h3>
          <p className="text-xs text-muted-gray mt-1">Configure ECS infrastructure, API keys, and worker defaults</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {SETTING_GROUPS.map((group) => (
        <div key={group.category} className="bg-muted-gray/5 border border-muted-gray/20 rounded-lg p-4">
          <div className="mb-3">
            <h4 className="text-bone-white font-medium text-sm">{group.title}</h4>
            <p className="text-xs text-muted-gray">{group.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {group.keys.map((key) => renderField(key))}
          </div>
        </div>
      ))}
    </div>
  );
}


// ============================================================================
// Main Page
// ============================================================================

const AdminScraping = () => {
  const [activeTab, setActiveTab] = useState<Tab>('Discovery');

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

      {activeTab === 'Discovery' && <DiscoveryTab onNavigateToJobs={() => setActiveTab('Jobs')} />}
      {activeTab === 'Scrape Profiles' && <ScrapeProfilesTab />}
      {activeTab === 'Jobs' && <JobsTab />}
      {activeTab === 'Staged Leads' && <StagedLeadsTab />}
      {activeTab === 'Lead Lists' && <LeadListsTab />}
      {activeTab === 'Sources' && <SourcesTab />}
      {activeTab === 'Settings' && <SettingsTab />}
    </div>
  );
};

export default AdminScraping;
