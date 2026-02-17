import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCRMCompanies(params?: { search?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['crm-companies', params],
    queryFn: () => api.getCRMCompanies(params),
  });
}

export function useCRMCompany(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-company', id],
    queryFn: () => api.getCRMCompany(id!),
    enabled: !!id,
  });
}

export function useCreateCRMCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMCompany(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-companies'] });
    },
  });
}

export function useUpdateCRMCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMCompany(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-companies'] });
      qc.invalidateQueries({ queryKey: ['crm-company', variables.id] });
    },
  });
}

export function useDeleteCRMCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMCompany(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-companies'] });
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
  });
}
