import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================================
// Sequences (Rep-facing)
// ============================================================================

export function useSequences() {
  return useQuery({
    queryKey: ['crm-email-sequences'],
    queryFn: () => api.getCRMEmailSequences(),
  });
}

export function useEnrollSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, contactId }: { sequenceId: string; contactId: string }) =>
      api.enrollCRMEmailSequence(sequenceId, contactId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-contact-sequences', variables.contactId] });
      qc.invalidateQueries({ queryKey: ['crm-email-sequences'] });
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-interactions-today'] });
    },
  });
}

export function useUnenrollSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, contactId }: { sequenceId: string; contactId: string }) =>
      api.unenrollCRMEmailSequence(sequenceId, contactId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-contact-sequences', variables.contactId] });
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-interactions-today'] });
    },
  });
}

export function useContactSequences(contactId: string) {
  return useQuery({
    queryKey: ['crm-email-contact-sequences', contactId],
    queryFn: () => api.getCRMEmailContactSequences(contactId),
    enabled: !!contactId,
  });
}

// ============================================================================
// Admin Sequence CRUD
// ============================================================================

export function useAdminSequences() {
  return useQuery({
    queryKey: ['crm-admin-email-sequences'],
    queryFn: () => api.getAdminCRMEmailSequences(),
  });
}

export function useAdminSequence(id: string) {
  return useQuery({
    queryKey: ['crm-admin-email-sequence', id],
    queryFn: () => api.getAdminCRMEmailSequence(id),
    enabled: !!id,
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.createAdminCRMEmailSequence(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-admin-email-sequences'] }),
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; is_active?: boolean } }) =>
      api.updateAdminCRMEmailSequence(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-admin-email-sequences'] });
      qc.invalidateQueries({ queryKey: ['crm-admin-email-sequence', variables.id] });
    },
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAdminCRMEmailSequence(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-admin-email-sequences'] }),
  });
}

export function useCreateSequenceStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, data }: { sequenceId: string; data: { step_number: number; delay_days: number; template_id?: string; subject: string; body_html: string } }) =>
      api.createAdminCRMEmailSequenceStep(sequenceId, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-admin-email-sequence', variables.sequenceId] });
    },
  });
}

export function useUpdateSequenceStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, stepId, data }: { sequenceId: string; stepId: string; data: any }) =>
      api.updateAdminCRMEmailSequenceStep(sequenceId, stepId, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-admin-email-sequence', variables.sequenceId] });
    },
  });
}

export function useDeleteSequenceStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, stepId }: { sequenceId: string; stepId: string }) =>
      api.deleteAdminCRMEmailSequenceStep(sequenceId, stepId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-admin-email-sequence', variables.sequenceId] });
    },
  });
}
