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
