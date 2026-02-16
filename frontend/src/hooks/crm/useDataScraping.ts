import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================================
// Scrape Sources
// ============================================================================

export function useScrapeSources() {
  return useQuery({
    queryKey: ['crm-scrape-sources'],
    queryFn: () => api.getCRMScrapeSources(),
  });
}

export function useCreateScrapeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMScrapeSource(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scrape-sources'] });
    },
  });
}

export function useUpdateScrapeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMScrapeSource(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scrape-sources'] });
    },
  });
}

export function useDeleteScrapeSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMScrapeSource(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scrape-sources'] });
    },
  });
}

// ============================================================================
// Scrape Profiles (reusable scraping configs)
// ============================================================================

export function useScrapeProfiles() {
  return useQuery({
    queryKey: ['crm-scrape-profiles'],
    queryFn: () => api.getCRMScrapeProfiles(),
  });
}

export function useCreateScrapeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMScrapeProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scrape-profiles'] });
    },
  });
}

export function useUpdateScrapeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMScrapeProfile(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scrape-profiles'] });
    },
  });
}

export function useDeleteScrapeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMScrapeProfile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scrape-profiles'] });
    },
  });
}

// ============================================================================
// Discovery Profiles
// ============================================================================

export function useDiscoveryProfiles() {
  return useQuery({
    queryKey: ['crm-discovery-profiles'],
    queryFn: () => api.getCRMDiscoveryProfiles(),
  });
}

export function useCreateDiscoveryProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMDiscoveryProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-discovery-profiles'] });
    },
  });
}

export function useUpdateDiscoveryProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMDiscoveryProfile(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-discovery-profiles'] });
    },
  });
}

export function useDeleteDiscoveryProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMDiscoveryProfile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-discovery-profiles'] });
    },
  });
}

// ============================================================================
// Discovery Runs & Sites
// ============================================================================

export function useDiscoveryRuns(params?: { profile_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['crm-discovery-runs', params],
    queryFn: () => api.getCRMDiscoveryRuns(params),
  });
}

export function useCreateDiscoveryRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => api.createCRMDiscoveryRun(profileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-discovery-runs'] });
      qc.invalidateQueries({ queryKey: ['crm-discovery-profiles'] });
    },
  });
}

export function useDiscoveryRun(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-discovery-run', id],
    queryFn: () => api.getCRMDiscoveryRun(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const run = query.state.data?.run;
      if (run && (run.status === 'queued' || run.status === 'running')) return 5000;
      return false;
    },
  });
}

export function useDiscoveryRunSites(runId: string | undefined, params?: {
  min_score?: number; source_type?: string; is_selected?: boolean;
  search?: string; limit?: number; offset?: number;
}) {
  return useQuery({
    queryKey: ['crm-discovery-sites', runId, params],
    queryFn: () => api.getCRMDiscoveryRunSites(runId!, params),
    enabled: !!runId,
  });
}

export function useStartDiscoveryScraping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runId, data }: { runId: string; data: { scrape_profile_id: string; site_ids?: string[]; min_score?: number } }) =>
      api.startDiscoveryScraping(runId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-discovery-runs'] });
      qc.invalidateQueries({ queryKey: ['crm-discovery-sites'] });
      qc.invalidateQueries({ queryKey: ['crm-scrape-jobs'] });
    },
  });
}

// ============================================================================
// Scrape Jobs
// ============================================================================

export function useScrapeJobs(params?: { source_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['crm-scrape-jobs', params],
    queryFn: () => api.getCRMScrapeJobs(params),
  });
}

export function useCreateScrapeJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { source_id: string; filters?: any }) => api.createCRMScrapeJob(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scrape-jobs'] });
    },
  });
}

export function useScrapeJob(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-scrape-job', id],
    queryFn: () => api.getCRMScrapeJob(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const job = query.state.data?.job;
      if (job && (job.status === 'queued' || job.status === 'running')) return 5000;
      return false;
    },
  });
}

// ============================================================================
// Scraped Leads
// ============================================================================

export function useScrapedLeads(params?: {
  job_id?: string; status?: string; min_score?: number; max_score?: number;
  country?: string; has_email?: boolean; search?: string;
  sort_by?: string; sort_order?: string; limit?: number; offset?: number;
}) {
  return useQuery({
    queryKey: ['crm-scraped-leads', params],
    queryFn: () => api.getCRMScrapedLeads(params),
  });
}

export function useBulkApproveLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { lead_ids: string[]; tags?: string[]; enroll_sequence_id?: string }) =>
      api.bulkApproveCRMLeads(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scraped-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-scrape-jobs'] });
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
  });
}

export function useBulkRejectLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { lead_ids: string[] }) => api.bulkRejectCRMLeads(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scraped-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-scrape-jobs'] });
    },
  });
}

export function useMergeScrapedLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, contact_id }: { id: string; contact_id: string }) =>
      api.mergeCRMScrapedLead(id, { contact_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-scraped-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-scrape-jobs'] });
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
  });
}

// ============================================================================
// Export & Bulk Import
// ============================================================================

export function useExportLeads() {
  return useMutation({
    mutationFn: (params?: { job_id?: string; status?: string; min_score?: number }) =>
      api.exportScrapedLeads(params),
  });
}

export function useBulkImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, params }: {
      file: File;
      params?: { tags?: string; source?: string; source_detail?: string; temperature?: string };
    }) => api.bulkImportContacts(file, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
  });
}
