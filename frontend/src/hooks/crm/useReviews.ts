import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMyReviews() {
  return useQuery({
    queryKey: ['crm-my-reviews'],
    queryFn: () => api.getCRMMyReviews(),
  });
}

export function useAdminReviews(params?: { rep_id?: string; review_type?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['crm-admin-reviews', params],
    queryFn: () => api.getCRMAdminReviews(params),
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMReview(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-admin-reviews'] });
      qc.invalidateQueries({ queryKey: ['crm-my-reviews'] });
    },
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMReview(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-admin-reviews'] });
      qc.invalidateQueries({ queryKey: ['crm-my-reviews'] });
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMReview(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-admin-reviews'] });
    },
  });
}
