import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================================
// Rep Business Card
// ============================================================================

export function useMyBusinessCard() {
  return useQuery({
    queryKey: ['crm-my-business-card'],
    queryFn: async () => {
      const res = await api.getCRMBusinessCard();
      return res.card;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes — avoid refetch on every tab switch
  });
}

export function useSaveBusinessCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createOrUpdateCRMBusinessCard(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-my-business-card'] }),
  });
}

export function useUploadBusinessCardLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadCRMBusinessCardLogo(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-my-business-card'] }),
  });
}

export function useSubmitBusinessCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.submitCRMBusinessCard(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-my-business-card'] }),
  });
}

// ============================================================================
// Admin Business Cards
// ============================================================================

export function useBusinessCards(params?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['crm-business-cards', params],
    queryFn: () => api.getCRMBusinessCards(params),
  });
}

export function useBusinessCardById(id: string) {
  return useQuery({
    queryKey: ['crm-business-card', id],
    queryFn: () => api.getCRMBusinessCardById(id),
    enabled: !!id,
  });
}

export function useUpdateBusinessCardStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status: string; admin_notes?: string }) =>
      api.updateCRMBusinessCardStatus(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-business-cards'] });
      qc.invalidateQueries({ queryKey: ['crm-business-card'] });
    },
  });
}

export function useExportBusinessCards() {
  return useQuery({
    queryKey: ['crm-business-cards-export'],
    queryFn: () => api.exportCRMBusinessCards(),
    enabled: false, // Only fetch on demand
  });
}
