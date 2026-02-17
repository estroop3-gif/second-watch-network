import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTrialRequests(params?: { status?: string; search?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['backlot-trial-requests', params],
    queryFn: () => api.getBacklotTrialRequests(params),
  });
}

export function useApproveTrialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approveBacklotTrial(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backlot-trial-requests'] }),
  });
}

export function useRejectTrialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.rejectBacklotTrial(id, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backlot-trial-requests'] }),
  });
}

export function useBulkApproveTrials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.bulkApproveBacklotTrials(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backlot-trial-requests'] }),
  });
}
