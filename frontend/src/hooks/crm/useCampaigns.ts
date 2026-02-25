import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCampaigns(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['crm-campaigns', params],
    queryFn: () => api.getCRMCampaigns(params),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['crm-campaign', id],
    queryFn: () => api.getCRMCampaign(id),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMCampaign(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-campaigns'] }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMCampaign(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['crm-campaigns'] });
      qc.invalidateQueries({ queryKey: ['crm-campaign', id] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-campaigns'] }),
  });
}

export function useScheduleCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scheduleCRMCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-campaigns'] }),
  });
}

export function useCancelCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelCRMCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-campaigns'] }),
  });
}

export function useUpdateContactDNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: any }) =>
      api.updateCRMContactDNC(contactId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
      qc.invalidateQueries({ queryKey: ['crm-contact'] });
      qc.invalidateQueries({ queryKey: ['crm-dnc-list'] });
      qc.invalidateQueries({ queryKey: ['crm-rep-dnc-list'] });
    },
  });
}

export function useSendCampaignNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.sendCRMCampaignNow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-campaigns'] });
      qc.invalidateQueries({ queryKey: ['crm-campaign'] });
    },
  });
}

export function useResumeCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resumeCRMCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-campaigns'] });
      qc.invalidateQueries({ queryKey: ['crm-campaign'] });
    },
  });
}

export function useCampaignSenders(id: string) {
  return useQuery({
    queryKey: ['crm-campaign-senders', id],
    queryFn: () => api.getCRMCampaignSenders(id),
    enabled: !!id,
  });
}

export function useUpdateCampaignSenders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountIds }: { id: string; accountIds: string[] }) =>
      api.updateCRMCampaignSenders(id, accountIds),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['crm-campaign-senders', id] });
      qc.invalidateQueries({ queryKey: ['crm-campaign', id] });
    },
  });
}

export function usePreviewTargeting(id: string) {
  return useQuery({
    queryKey: ['crm-campaign-targeting', id],
    queryFn: () => api.previewCRMCampaignTargeting(id),
    enabled: !!id,
  });
}

export function useDNCList(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['crm-dnc-list', params],
    queryFn: () => api.getCRMDNCList(params),
  });
}

export function useRepDNCList(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['crm-rep-dnc-list', params],
    queryFn: () => api.getCRMRepDNCList(params),
  });
}
