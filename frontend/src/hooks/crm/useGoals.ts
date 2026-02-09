import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMyGoals(params?: { period_type?: string }) {
  return useQuery({
    queryKey: ['crm-my-goals', params],
    queryFn: () => api.getCRMMyGoals(params),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMGoal(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-my-goals'] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMGoal(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-my-goals'] });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMGoal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-my-goals'] });
    },
  });
}

export function useSetGoalOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, manual_override }: { id: string; manual_override: number | null }) =>
      api.setCRMGoalOverride(id, { manual_override }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-my-goals'] });
    },
  });
}
