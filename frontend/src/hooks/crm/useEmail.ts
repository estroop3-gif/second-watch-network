import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================================
// Email Account
// ============================================================================

export function useEmailAccount() {
  return useQuery({
    queryKey: ['crm-email-account'],
    queryFn: () => api.getCRMEmailAccount(),
    retry: false,
  });
}

export function useUpdateEmailSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (signatureHtml: string) => api.updateCRMEmailSignature(signatureHtml),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-account'] }),
  });
}

// ============================================================================
// Inbox & Threads
// ============================================================================

export function useEmailInbox(params?: {
  unread_only?: boolean; archived?: boolean; starred_only?: boolean;
  snoozed?: boolean; deleted?: boolean; label_id?: string;
  sort_by?: string; all_threads?: boolean;
  search?: string; limit?: number; offset?: number;
}) {
  return useQuery({
    queryKey: ['crm-email-inbox', params],
    queryFn: () => api.getCRMEmailInbox(params),
    refetchInterval: 30000, // Poll every 30s for new mail
  });
}

export function useEmailThread(threadId: string) {
  return useQuery({
    queryKey: ['crm-email-thread', threadId],
    queryFn: () => api.getCRMEmailThread(threadId),
    enabled: !!threadId,
  });
}

export function useContactThreads(contactId: string) {
  return useQuery({
    queryKey: ['crm-email-contact-threads', contactId],
    queryFn: () => api.getCRMEmailContactThreads(contactId),
    enabled: !!contactId,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['crm-email-unread-count'],
    queryFn: () => api.getCRMEmailUnreadCount(),
    refetchInterval: 30000,
  });
}

// ============================================================================
// Email Suggestions (autocomplete)
// ============================================================================

export function useEmailSuggestions(query: string) {
  return useQuery({
    queryKey: ['crm-email-suggestions', query],
    queryFn: () => api.getCRMEmailSuggestions(query),
    enabled: query.length >= 2,
    staleTime: 30000,
    placeholderData: (prev) => prev,
  });
}

// ============================================================================
// Actions
// ============================================================================

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      contact_id?: string; to_email: string; subject: string;
      body_html: string; body_text?: string; cc?: string[];
      thread_id?: string; scheduled_at?: string;
      attachment_ids?: string[]; template_id?: string;
    }) => api.sendCRMEmail(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
      if (variables.thread_id) {
        qc.invalidateQueries({ queryKey: ['crm-email-thread', variables.thread_id] });
      }
      if (variables.contact_id) {
        qc.invalidateQueries({ queryKey: ['crm-email-contact-threads', variables.contact_id] });
      }
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-interactions-today'] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => api.markCRMEmailThreadRead(threadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
      qc.invalidateQueries({ queryKey: ['crm-email-unread-count'] });
    },
  });
}

export function useArchiveThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => api.archiveCRMEmailThread(threadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

// ============================================================================
// Email Templates
// ============================================================================

export function useEmailTemplates(category?: string) {
  return useQuery({
    queryKey: ['crm-email-templates', category],
    queryFn: () => api.getCRMEmailTemplates(category),
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string; subject: string; body_html: string;
      body_text?: string; category?: string; placeholders?: string[];
    }) => api.createCRMEmailTemplate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-templates'] }),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateCRMEmailTemplate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-templates'] }),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMEmailTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-templates'] }),
  });
}

// ============================================================================
// Admin — Email Accounts
// ============================================================================

export function useEmailAccounts() {
  return useQuery({
    queryKey: ['crm-email-accounts'],
    queryFn: () => api.getCRMEmailAccounts(),
  });
}

export function useCreateEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { profile_id: string; email_address: string; display_name: string }) =>
      api.createCRMEmailAccount(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-accounts'] }),
  });
}

export function useDeactivateEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.deactivateCRMEmailAccount(accountId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-accounts'] }),
  });
}

// ============================================================================
// Star / Snooze / Bulk / Link / Assign
// ============================================================================

export function useStarThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => api.starCRMEmailThread(threadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

export function useSnoozeThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, snoozedUntil }: { threadId: string; snoozedUntil: string }) =>
      api.snoozeCRMEmailThread(threadId, snoozedUntil),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

export function useBulkThreadAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadIds, action }: { threadIds: string[]; action: string }) =>
      api.bulkCRMEmailThreadAction(threadIds, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
      qc.invalidateQueries({ queryKey: ['crm-email-unread-count'] });
    },
  });
}

export function useLinkContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, contactId }: { threadId: string; contactId: string }) =>
      api.linkCRMEmailThreadContact(threadId, contactId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-thread', variables.threadId] });
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

export function useUnlinkContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => api.unlinkCRMEmailThreadContact(threadId),
    onSuccess: (_, threadId) => {
      qc.invalidateQueries({ queryKey: ['crm-email-thread', threadId] });
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

export function useAssignThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, assignedTo }: { threadId: string; assignedTo: string | null }) =>
      api.assignCRMEmailThread(threadId, assignedTo),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-thread', variables.threadId] });
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

// ============================================================================
// Internal Notes
// ============================================================================

export function useThreadNotes(threadId: string) {
  return useQuery({
    queryKey: ['crm-email-thread-notes', threadId],
    queryFn: () => api.getCRMEmailThreadNotes(threadId),
    enabled: !!threadId,
  });
}

export function useCreateThreadNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, content }: { threadId: string; content: string }) =>
      api.createCRMEmailThreadNote(threadId, content),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-thread-notes', variables.threadId] });
    },
  });
}

export function useDeleteThreadNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, noteId }: { threadId: string; noteId: string }) =>
      api.deleteCRMEmailThreadNote(threadId, noteId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-thread-notes', variables.threadId] });
    },
  });
}

// ============================================================================
// Labels
// ============================================================================

export function useEmailLabels() {
  return useQuery({
    queryKey: ['crm-email-labels'],
    queryFn: () => api.getCRMEmailLabels(),
  });
}

export function useCreateEmailLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => api.createCRMEmailLabel(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-labels'] }),
  });
}

export function useUpdateEmailLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      api.updateCRMEmailLabel(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-labels'] }),
  });
}

export function useDeleteEmailLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMEmailLabel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-email-labels'] });
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

export function useAddThreadLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, labelId }: { threadId: string; labelId: string }) =>
      api.addCRMEmailThreadLabel(threadId, labelId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-thread', variables.threadId] });
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

export function useRemoveThreadLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, labelId }: { threadId: string; labelId: string }) =>
      api.removeCRMEmailThreadLabel(threadId, labelId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-thread', variables.threadId] });
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

// ============================================================================
// Quick Replies
// ============================================================================

export function useQuickReplies() {
  return useQuery({
    queryKey: ['crm-email-quick-replies'],
    queryFn: () => api.getCRMEmailQuickReplies(),
  });
}

export function useCreateQuickReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; body_text: string; body_html?: string }) =>
      api.createCRMEmailQuickReply(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-quick-replies'] }),
  });
}

export function useUpdateQuickReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateCRMEmailQuickReply(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-quick-replies'] }),
  });
}

export function useDeleteQuickReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMEmailQuickReply(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-quick-replies'] }),
  });
}

// ============================================================================
// Attachments
// ============================================================================

export function useUploadEmailAttachment() {
  return useMutation({
    mutationFn: async (file: File) => {
      const { attachment, upload_url } = await api.getCRMEmailAttachmentUploadUrl({
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      });
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      return attachment;
    },
  });
}

export function useDownloadEmailAttachment() {
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const { download_url } = await api.getCRMEmailAttachmentDownloadUrl(attachmentId);
      window.open(download_url, '_blank');
      return download_url;
    },
  });
}

// ============================================================================
// Scheduled Emails
// ============================================================================

export function useScheduledEmails() {
  return useQuery({
    queryKey: ['crm-email-scheduled'],
    queryFn: () => api.getCRMEmailScheduled(),
  });
}

export function useCancelScheduledEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => api.cancelCRMEmailScheduled(messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-email-scheduled'] });
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
    },
  });
}

// ============================================================================
// AI Assistant
// ============================================================================

export function useAICompose() {
  return useMutation({
    mutationFn: (data: { context?: string; tone?: string; recipient_name?: string; topic?: string }) =>
      api.aiComposeCRMEmail(data),
  });
}

export function useAISummarize() {
  return useMutation({
    mutationFn: (threadId: string) => api.aiSummarizeCRMEmailThread(threadId),
  });
}

export function useAISentiment() {
  return useMutation({
    mutationFn: (threadId: string) => api.aiAnalyzeCRMEmailSentiment(threadId),
  });
}

// ============================================================================
// Email Analytics (Admin)
// ============================================================================

export function useEmailAnalytics(days?: number) {
  return useQuery({
    queryKey: ['crm-email-analytics', days],
    queryFn: () => api.getCRMEmailAnalytics(days),
  });
}

// ============================================================================
// Rep Email Drill-Down (Admin)
// ============================================================================

export function useRepEmailMessages(repId: string, params?: {
  direction?: string; days?: number; limit?: number; offset?: number;
}) {
  return useQuery({
    queryKey: ['crm-rep-email-messages', repId, params],
    queryFn: () => api.getCRMRepEmailMessages(repId, params),
    enabled: !!repId,
  });
}

// ============================================================================
// Deal-Email Linking
// ============================================================================

export function useLinkThreadDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, dealId }: { threadId: string; dealId: string | null }) =>
      api.linkCRMEmailThreadDeal(threadId, dealId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-email-thread', variables.threadId] });
      qc.invalidateQueries({ queryKey: ['crm-email-inbox'] });
      qc.invalidateQueries({ queryKey: ['crm-deal-email-threads'] });
    },
  });
}

export function useDealEmailThreads(dealId: string) {
  return useQuery({
    queryKey: ['crm-deal-email-threads', dealId],
    queryFn: () => api.getCRMDealEmailThreads(dealId),
    enabled: !!dealId,
  });
}

// ============================================================================
// Email Account Avatar
// ============================================================================

export function useUpdateEmailAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (avatarUrl: string) => api.updateCRMEmailAvatar(avatarUrl),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-account'] }),
  });
}

export function useUploadEmailAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadCRMEmailAvatar(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-account'] }),
  });
}

// ============================================================================
// Email Notification Settings
// ============================================================================

export function useEmailNotificationSettings() {
  return useQuery({
    queryKey: ['crm-email-notifications'],
    queryFn: () => api.getCRMEmailNotificationSettings(),
  });
}

export function useUpdateEmailNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      account_id: string;
      notification_email?: string;
      notification_mode?: string;
      notification_digest_interval?: string;
    }) => api.updateCRMEmailNotificationSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-email-notifications'] }),
  });
}

export function useTeamDirectory() {
  return useQuery({
    queryKey: ['crm-team-directory'],
    queryFn: () => api.getTeamDirectory(),
    staleTime: 5 * 60 * 1000,
  });
}
