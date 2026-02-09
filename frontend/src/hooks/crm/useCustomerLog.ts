import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useContactLog(contactId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['crm-contact-log', contactId, status],
    queryFn: () => api.getCRMContactLog(contactId!, status),
    enabled: !!contactId,
  });
}

export function useCreateLogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: any }) =>
      api.createCRMLogEntry(contactId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contact-log'] });
      qc.invalidateQueries({ queryKey: ['crm-open-log'] });
    },
  });
}

export function useUpdateLogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ logId, data }: { logId: string; data: any }) =>
      api.updateCRMLogEntry(logId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contact-log'] });
      qc.invalidateQueries({ queryKey: ['crm-open-log'] });
    },
  });
}

export function useOpenLogEntries() {
  return useQuery({
    queryKey: ['crm-open-log'],
    queryFn: () => api.getCRMOpenLogEntries(),
  });
}

export function useEscalateLogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (logId: string) => api.escalateCRMLogEntry(logId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contact-log'] });
      qc.invalidateQueries({ queryKey: ['crm-open-log'] });
    },
  });
}
