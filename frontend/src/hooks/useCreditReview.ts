import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePendingCredits(skip = 0, limit = 50) {
  return useQuery({
    queryKey: ['pending-credits', skip, limit],
    queryFn: () => api.getPendingCredits(skip, limit),
  });
}

export function useApproveCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creditId, note }: { creditId: string; note?: string }) =>
      api.approveCredit(creditId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-credits'] });
    },
  });
}

export function useRejectCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creditId, note }: { creditId: string; note: string }) =>
      api.rejectCredit(creditId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-credits'] });
    },
  });
}
