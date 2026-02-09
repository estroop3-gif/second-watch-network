import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDeals(params?: {
  contact_id?: string;
  stage?: string;
  product_type?: string;
  assigned_rep_id?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['crm-deals', params],
    queryFn: () => api.getCRMDeals(params),
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-deal', id],
    queryFn: () => api.getCRMDeal(id!),
    enabled: !!id,
  });
}

export function usePipeline(params?: {
  assigned_rep_id?: string;
  product_type?: string;
}) {
  return useQuery({
    queryKey: ['crm-pipeline', params],
    queryFn: () => api.getCRMPipeline(params),
  });
}

export function usePipelineStats(params?: { assigned_rep_id?: string }) {
  return useQuery({
    queryKey: ['crm-pipeline-stats', params],
    queryFn: () => api.getCRMPipelineStats(params),
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMDeal(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline-stats'] });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMDeal(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-deal'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline-stats'] });
    },
  });
}

export function useChangeDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { stage: string; notes?: string; close_reason?: string } }) =>
      api.changeCRMDealStage(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-deal'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline-stats'] });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMDeal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline-stats'] });
    },
  });
}

// Admin hooks
export function useCRMLeads(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['crm-leads', params],
    queryFn: () => api.getCRMLeads(params),
  });
}

export function useAssignDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, repId }: { dealId: string; repId: string }) =>
      api.assignCRMDeal(dealId, repId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['crm-deal'] });
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
    },
  });
}

export function usePipelineForecast(monthsAhead?: number) {
  return useQuery({
    queryKey: ['crm-pipeline-forecast', monthsAhead],
    queryFn: () => api.getCRMPipelineForecast(monthsAhead),
  });
}
