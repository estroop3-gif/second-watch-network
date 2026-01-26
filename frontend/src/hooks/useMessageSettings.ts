/**
 * Message Settings Hooks
 * React Query hooks for message preferences, blocking, reporting, and muting
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ============================================================================
// Types
// ============================================================================

export interface MessagePreferences {
  who_can_message: 'everyone' | 'connections' | 'nobody';
  show_read_receipts: boolean;
  show_online_status: boolean;
}

export interface MessagePreferencesUpdate {
  who_can_message?: 'everyone' | 'connections' | 'nobody';
  show_read_receipts?: boolean;
  show_online_status?: boolean;
}

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  blocked_user_name?: string;
  blocked_user_avatar?: string;
  reason?: string;
  created_at: string;
}

export interface BlockUserRequest {
  blocked_user_id: string;
  reason?: string;
}

export interface MessageReportCreate {
  message_id: string;
  message_content: string;
  message_sender_id: string;
  conversation_id?: string;
  reason: 'spam' | 'harassment' | 'inappropriate' | 'other';
  description?: string;
}

export interface MessageReport {
  id: string;
  reporter_id: string;
  message_id: string;
  message_content?: string;
  message_sender_id: string;
  conversation_id?: string;
  reason: string;
  description?: string;
  status: string;
  reviewed_by?: string;
  resolution_notes?: string;
  resolution_action?: string;
  created_at: string;
  updated_at: string;
}

export interface MutedConversation {
  id: string;
  user_id: string;
  conversation_partner_id?: string;
  conversation_partner_name?: string;
  conversation_partner_avatar?: string;
  channel_id?: string;
  channel_name?: string;
  muted_until?: string;
  created_at: string;
}

export interface MuteConversationRequest {
  conversation_partner_id?: string;
  channel_id?: string;
  duration_minutes?: number; // null = indefinite
}

export interface BlockStatus {
  blocked_by_me: boolean;
  blocked_by_them: boolean;
  is_blocked: boolean;
}

export interface CanMessageResult {
  allowed: boolean;
  reason?: string;
}

export interface MuteStatus {
  is_muted: boolean;
  muted_until?: string;
}

// ============================================================================
// Preferences Hooks
// ============================================================================

export function useMessagePreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['message-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return api.get<MessagePreferences>(`/api/v1/message-settings/preferences?user_id=${user.id}`);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateMessagePreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: MessagePreferencesUpdate) => {
      if (!user?.id) throw new Error('User not authenticated');
      return api.put<MessagePreferences>(
        `/api/v1/message-settings/preferences?user_id=${user.id}`,
        preferences
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-preferences'] });
    },
  });
}

// ============================================================================
// Blocked Users Hooks
// ============================================================================

export function useBlockedUsers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['blocked-users', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return api.get<BlockedUser[]>(`/api/v1/message-settings/blocked?user_id=${user.id}`);
    },
    enabled: !!user?.id,
  });
}

export function useBlockUser() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BlockUserRequest) => {
      if (!user?.id) throw new Error('User not authenticated');
      return api.post<BlockedUser>(
        `/api/v1/message-settings/blocked?user_id=${user.id}`,
        request
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['block-status'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUnblockUser() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedUserId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      return api.delete(`/api/v1/message-settings/blocked/${blockedUserId}?user_id=${user.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['block-status'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useBlockStatus(otherUserId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['block-status', user?.id, otherUserId],
    queryFn: async () => {
      if (!user?.id || !otherUserId) return null;
      return api.get<BlockStatus>(
        `/api/v1/message-settings/blocked/check/${otherUserId}?user_id=${user.id}`
      );
    },
    enabled: !!user?.id && !!otherUserId,
  });
}

// ============================================================================
// Message Reports Hooks
// ============================================================================

export function useReportMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: MessageReportCreate) => {
      if (!user?.id) throw new Error('User not authenticated');
      return api.post<MessageReport>(
        `/api/v1/message-settings/report?user_id=${user.id}`,
        request
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
    },
  });
}

export function useMyReports() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-reports', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return api.get<MessageReport[]>(`/api/v1/message-settings/reports?user_id=${user.id}`);
    },
    enabled: !!user?.id,
  });
}

// ============================================================================
// Muted Conversations Hooks
// ============================================================================

export function useMutedConversations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['muted-conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return api.get<MutedConversation[]>(`/api/v1/message-settings/muted?user_id=${user.id}`);
    },
    enabled: !!user?.id,
  });
}

export function useMuteConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: MuteConversationRequest) => {
      if (!user?.id) throw new Error('User not authenticated');
      return api.post<MutedConversation>(
        `/api/v1/message-settings/muted?user_id=${user.id}`,
        request
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muted-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['mute-status'] });
    },
  });
}

export function useUnmuteConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (muteId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      return api.delete(`/api/v1/message-settings/muted/${muteId}?user_id=${user.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muted-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['mute-status'] });
    },
  });
}

export function useMuteStatus(conversationPartnerId?: string, channelId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['mute-status', user?.id, conversationPartnerId, channelId],
    queryFn: async () => {
      if (!user?.id || (!conversationPartnerId && !channelId)) return null;
      const params = new URLSearchParams({ user_id: user.id });
      if (conversationPartnerId) params.append('conversation_partner_id', conversationPartnerId);
      if (channelId) params.append('channel_id', channelId);
      return api.get<MuteStatus>(`/api/v1/message-settings/muted/check?${params.toString()}`);
    },
    enabled: !!user?.id && (!!conversationPartnerId || !!channelId),
  });
}

// ============================================================================
// Can Message Check Hook
// ============================================================================

export function useCanMessage(targetUserId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['can-message', user?.id, targetUserId],
    queryFn: async () => {
      if (!user?.id || !targetUserId) return { allowed: true, reason: null };
      return api.get<CanMessageResult>(
        `/api/v1/message-settings/can-message/${targetUserId}?user_id=${user.id}`
      );
    },
    enabled: !!user?.id && !!targetUserId,
  });
}

// ============================================================================
// Admin Hooks
// ============================================================================

export interface MessageReportDetail extends MessageReport {
  reporter_name?: string;
  reporter_avatar?: string;
  message_sender_name?: string;
  message_sender_avatar?: string;
  reviewer_name?: string;
}

export interface BlockRecord {
  id: string;
  blocker_id: string;
  blocker_name?: string;
  blocker_avatar?: string;
  blocked_user_id: string;
  blocked_user_name?: string;
  blocked_user_avatar?: string;
  reason?: string;
  created_at: string;
}

export interface ReportStats {
  total_reports: number;
  pending_reports: number;
  resolved_reports: number;
  dismissed_reports: number;
  reports_by_reason: Record<string, number>;
}

export interface BlockStats {
  total_blocks: number;
  blocks_today: number;
  blocks_this_week: number;
  most_blocked_users: Array<{
    user_id: string;
    name?: string;
    avatar_url?: string;
    block_count: number;
  }>;
}

export function useAdminMessageReports(options?: {
  status?: string;
  reason?: string;
  skip?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.reason) params.append('reason', options.reason);
  if (options?.skip) params.append('skip', String(options.skip));
  if (options?.limit) params.append('limit', String(options.limit));

  return useQuery({
    queryKey: ['admin-message-reports', options],
    queryFn: () => api.get<MessageReportDetail[]>(`/api/v1/admin/messages/reports?${params.toString()}`),
  });
}

export function useAdminReportStats() {
  return useQuery({
    queryKey: ['admin-report-stats'],
    queryFn: () => api.get<ReportStats>('/api/v1/admin/messages/reports/stats'),
  });
}

export function useAdminReportDetail(reportId: string) {
  return useQuery({
    queryKey: ['admin-report-detail', reportId],
    queryFn: () => api.get<MessageReportDetail>(`/api/v1/admin/messages/reports/${reportId}`),
    enabled: !!reportId,
  });
}

export function useAdminUpdateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, update }: { reportId: string; update: { status?: string; reviewed_by?: string; resolution_notes?: string } }) => {
      return api.put<MessageReportDetail>(`/api/v1/admin/messages/reports/${reportId}`, update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-message-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-detail'] });
    },
  });
}

export function useAdminResolveReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, resolution_action, resolution_notes }: { reportId: string; resolution_action: string; resolution_notes?: string }) => {
      return api.post<MessageReportDetail>(`/api/v1/admin/messages/reports/${reportId}/resolve`, {
        resolution_action,
        resolution_notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-message-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-detail'] });
    },
  });
}

export function useAdminDismissReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, notes }: { reportId: string; notes?: string }) => {
      return api.post<MessageReportDetail>(`/api/v1/admin/messages/reports/${reportId}/dismiss?notes=${encodeURIComponent(notes || '')}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-message-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-detail'] });
    },
  });
}

export function useAdminBlocks(options?: { skip?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.skip) params.append('skip', String(options.skip));
  if (options?.limit) params.append('limit', String(options.limit));

  return useQuery({
    queryKey: ['admin-blocks', options],
    queryFn: () => api.get<BlockRecord[]>(`/api/v1/admin/messages/blocks?${params.toString()}`),
  });
}

export function useAdminBlockStats() {
  return useQuery({
    queryKey: ['admin-block-stats'],
    queryFn: () => api.get<BlockStats>('/api/v1/admin/messages/blocks/stats'),
  });
}

export function useAdminForceUnblock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockId: string) => {
      return api.delete(`/api/v1/admin/messages/blocks/${blockId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-block-stats'] });
    },
  });
}

export function useAdminUserBlocks(userId: string) {
  return useQuery({
    queryKey: ['admin-user-blocks', userId],
    queryFn: () => api.get(`/api/v1/admin/messages/blocks/user/${userId}`),
    enabled: !!userId,
  });
}
