import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ContactFilters {
  search?: string;
  temperature?: string;
  status?: string;
  tag?: string;
  assigned_rep_id?: string;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
}

export function useContacts(filters: ContactFilters = {}) {
  return useQuery({
    queryKey: ['crm-contacts', filters],
    queryFn: () => api.getCRMContacts(filters),
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-contact', id],
    queryFn: () => api.getCRMContact(id!),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMContact(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMContact(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
      qc.invalidateQueries({ queryKey: ['crm-contact', variables.id] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
  });
}

export function useLinkProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, profileId }: { contactId: string; profileId: string }) =>
      api.linkCRMContactProfile(contactId, profileId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-contact', variables.contactId] });
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
  });
}
