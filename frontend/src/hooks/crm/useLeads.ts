import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useUnassignedContacts(params?: {
  search?: string;
  temperature?: string;
  has_email?: boolean;
  has_phone?: boolean;
  has_website?: boolean;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['crm-unassigned-contacts', params],
    queryFn: () => api.getCRMContacts({ ...params, unassigned: true }),
  });
}

export function useContactAssignmentHistory(contactId: string) {
  return useQuery({
    queryKey: ['crm-contact-assignment-history', contactId],
    queryFn: () => api.getCRMContactAssignmentHistory(contactId),
    enabled: !!contactId,
  });
}

export function useNewLeads() {
  return useQuery({
    queryKey: ['crm-new-leads'],
    queryFn: () => api.getCRMNewLeads(),
    refetchInterval: 30000,
  });
}

export function useMarkNewLeadsViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markCRMNewLeadsViewed(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-new-leads'] });
      qc.invalidateQueries({ queryKey: ['crm-sidebar-badges'] });
    },
  });
}
