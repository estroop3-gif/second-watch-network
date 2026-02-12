import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMyInteractionsToday() {
  return useQuery({
    queryKey: ['crm-interactions-today'],
    queryFn: () => api.getCRMMyInteractionsToday(),
    refetchInterval: 30000, // Refresh every 30 seconds to catch auto-counted events
  });
}

export function useIncrementInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (interactionType: string) => api.incrementCRMInteraction(interactionType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-interactions-today'] });
    },
  });
}

export function useDecrementInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (interactionType: string) => api.decrementCRMInteraction(interactionType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-interactions-today'] });
    },
  });
}

export function useCRMReps() {
  return useQuery({
    queryKey: ['crm-reps'],
    queryFn: () => api.getCRMReps(),
  });
}

export function useCRMAdminInteractions(params?: {
  date_from?: string;
  date_to?: string;
  rep_id?: string;
}) {
  return useQuery({
    queryKey: ['crm-admin-interactions', params],
    queryFn: () => api.getCRMAdminInteractions(params),
  });
}

export function useAssignContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, repId }: { contactId: string; repId: string }) =>
      api.assignCRMContact(contactId, repId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
      qc.invalidateQueries({ queryKey: ['crm-contact'] });
    },
  });
}

export function useBulkAssignContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactIds, repId }: { contactIds: string[]; repId: string }) =>
      api.bulkAssignCRMContacts(contactIds, repId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
  });
}

export function useAddCRMTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.addCRMTeamMember(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-reps'] });
    },
  });
}

export function useRemoveCRMTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeCRMTeamMember(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-reps'] });
    },
  });
}

export function useUpdateCRMTeamMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.updateCRMTeamMemberRole(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-reps'] });
    },
  });
}
