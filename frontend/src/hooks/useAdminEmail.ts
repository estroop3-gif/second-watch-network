import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================================
// Admin/System Email Accounts (for Accounts tab)
// ============================================================================

export function useAdminEmailAccounts() {
  return useQuery({
    queryKey: ['admin-email-accounts'],
    queryFn: () => api.getAdminEmailAccounts(),
  });
}

export function useCreateAdminEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email_address: string; display_name: string; account_type: string; signature_html?: string }) =>
      api.createAdminEmailAccount(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-email-accounts'] }),
  });
}

export function useUpdateAdminEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { display_name?: string; signature_html?: string; is_active?: boolean } }) =>
      api.updateAdminEmailAccount(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-email-accounts'] }),
  });
}

export function useDeactivateAdminEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deactivateAdminEmailAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-email-accounts'] }),
  });
}

export function useCreateAdminMemberEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { profile_id: string; email_address: string; display_name: string }) =>
      api.createAdminMemberEmailAccount(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-email-accounts'] }),
  });
}

export function useDeleteAdminEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAdminEmailAccountPermanent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-email-accounts'] }),
  });
}

// ============================================================================
// Access Grants
// ============================================================================

export function useAdminEmailAccountAccess(accountId: string) {
  return useQuery({
    queryKey: ['admin-email-access', accountId],
    queryFn: () => api.getAdminEmailAccountAccess(accountId),
    enabled: !!accountId,
  });
}

export function useGrantAdminEmailAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: { profile_id: string; role?: string } }) =>
      api.grantAdminEmailAccess(accountId, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-email-access', variables.accountId] });
      qc.invalidateQueries({ queryKey: ['admin-email-accounts'] });
    },
  });
}

export function useRevokeAdminEmailAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, profileId }: { accountId: string; profileId: string }) =>
      api.revokeAdminEmailAccess(accountId, profileId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-email-access', variables.accountId] });
      qc.invalidateQueries({ queryKey: ['admin-email-accounts'] });
    },
  });
}

// ============================================================================
// My Accessible Accounts (for inbox selector)
// ============================================================================

export function useMyAdminEmailAccounts() {
  return useQuery({
    queryKey: ['admin-email-my-accounts'],
    queryFn: () => api.getMyAdminEmailAccounts(),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Inbox & Threads
// ============================================================================

export function useAdminEmailInbox(accountId: string, params?: {
  archived?: boolean; starred_only?: boolean; search?: string;
  limit?: number; offset?: number;
}) {
  return useQuery({
    queryKey: ['admin-email-inbox', accountId, params],
    queryFn: () => api.getAdminEmailInbox(accountId, params),
    enabled: !!accountId,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useAdminEmailThread(threadId: string) {
  return useQuery({
    queryKey: ['admin-email-thread', threadId],
    queryFn: () => api.getAdminEmailThread(threadId),
    enabled: !!threadId,
    staleTime: 10_000,
  });
}

// ============================================================================
// Actions
// ============================================================================

export function useSendAdminEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      account_id: string; to_emails: string[]; subject: string;
      body_html: string; body_text?: string; cc?: string[];
      bcc?: string[]; thread_id?: string; attachment_ids?: string[];
    }) => api.sendAdminEmail(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-email-inbox'] });
      if (variables.thread_id) {
        qc.invalidateQueries({ queryKey: ['admin-email-thread', variables.thread_id] });
      }
    },
  });
}

export function useMarkAdminEmailRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => api.markAdminEmailThreadRead(threadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-email-inbox'] });
    },
  });
}

export function useArchiveAdminEmailThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => api.archiveAdminEmailThread(threadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-email-inbox'] });
    },
  });
}

export function useStarAdminEmailThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => api.starAdminEmailThread(threadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-email-inbox'] });
    },
  });
}

export function useDeleteAdminEmailThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => api.deleteAdminEmailThread(threadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-email-inbox'] });
    },
  });
}
