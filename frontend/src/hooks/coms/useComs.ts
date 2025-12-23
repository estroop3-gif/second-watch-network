/**
 * useComs - React Query hooks for the Coms (Communications) system
 * Handles channels, messages, members, presence, and templates
 */
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ComsChannel,
  ComsChannelWithMembers,
  ChannelCreateInput,
  ChannelUpdateInput,
  ChannelListResponse,
  ComsMessage,
  MessageCreateInput,
  MessagePage,
  ChannelMember,
  ChannelMemberAddInput,
  VoiceJoinResponse,
  VoiceParticipant,
  UserPresence,
  PresenceUpdateInput,
  ProjectPresence,
  UnreadCountsResponse,
  ChannelTemplate,
  ApplyTemplatesRequest,
  ApplyTemplatesResponse,
} from '@/types/coms';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// CHANNELS
// ============================================================================

export function useChannels(options: { projectId?: string | null; scope?: string } = {}) {
  const { projectId, scope = 'project' } = options;

  return useQuery({
    queryKey: ['coms-channels', { projectId, scope }],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      params.append('scope', scope);

      const response = await fetch(`${API_BASE}/api/v1/coms/channels?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch channels' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ChannelListResponse;
    },
    enabled: !!projectId || scope === 'global',
    refetchInterval: 5000, // Poll every 5 seconds for now (replace with WebSocket later)
  });
}

export function useChannel(channelId: string | null) {
  return useQuery({
    queryKey: ['coms-channel', channelId],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch channel' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ComsChannelWithMembers;
    },
    enabled: !!channelId,
  });
}

export function useCreateChannel(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ChannelCreateInput) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...input,
          project_id: projectId,
          scope: 'project',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create channel' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ComsChannel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-channels', { projectId }] });
    },
  });
}

export function useUpdateChannel(channelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ChannelUpdateInput) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update channel' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ComsChannel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-channel', channelId] });
      queryClient.invalidateQueries({ queryKey: ['coms-channels'] });
    },
  });
}

export function useDeleteChannel(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete channel' }));
        throw new Error(error.detail);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-channels', { projectId }] });
    },
  });
}

// ============================================================================
// MESSAGES
// ============================================================================

export function useChannelMessages(channelId: string | null) {
  return useInfiniteQuery({
    queryKey: ['coms-messages', channelId],
    queryFn: async ({ pageParam }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (pageParam) params.append('before', pageParam);
      params.append('limit', '50');

      const response = await fetch(
        `${API_BASE}/api/v1/coms/channels/${channelId}/messages?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch messages' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as MessagePage;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!channelId,
    initialPageParam: null as string | null,
    refetchInterval: 3000, // Poll every 3 seconds (replace with WebSocket later)
  });
}

export function useSendMessage(channelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MessageCreateInput) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ComsMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-messages', channelId] });
      queryClient.invalidateQueries({ queryKey: ['coms-channels'] });
    },
  });
}

export function useEditMessage(channelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to edit message' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ComsMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-messages', channelId] });
    },
  });
}

export function useDeleteMessage(channelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete message' }));
        throw new Error(error.detail);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-messages', channelId] });
    },
  });
}

// ============================================================================
// CHANNEL MEMBERS
// ============================================================================

export function useChannelMembers(channelId: string | null) {
  return useQuery({
    queryKey: ['coms-channel-members', channelId],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch members' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ChannelMember[];
    },
    enabled: !!channelId,
  });
}

export function useAddChannelMember(channelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ChannelMemberAddInput) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to add member' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ChannelMember;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-channel-members', channelId] });
      queryClient.invalidateQueries({ queryKey: ['coms-channel', channelId] });
    },
  });
}

export function useRemoveChannelMember(channelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/coms/channels/${channelId}/members/${userId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to remove member' }));
        throw new Error(error.detail);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-channel-members', channelId] });
      queryClient.invalidateQueries({ queryKey: ['coms-channel', channelId] });
    },
  });
}

// ============================================================================
// VOICE
// ============================================================================

export function useJoinVoice(channelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/voice/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to join voice' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as VoiceJoinResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-voice-participants', channelId] });
    },
  });
}

export function useLeaveVoice(channelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/voice/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to leave voice' }));
        throw new Error(error.detail);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-voice-participants', channelId] });
    },
  });
}

export function useVoiceParticipants(channelId: string | null) {
  return useQuery({
    queryKey: ['coms-voice-participants', channelId],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/coms/channels/${channelId}/voice/participants`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch participants' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as VoiceParticipant[];
    },
    enabled: !!channelId,
    refetchInterval: 2000, // Poll frequently for voice state
  });
}

// ============================================================================
// PRESENCE
// ============================================================================

export function useUpdatePresence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PresenceUpdateInput) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/presence`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update presence' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as UserPresence;
    },
    onSuccess: (_, variables) => {
      if (variables.current_project_id) {
        queryClient.invalidateQueries({
          queryKey: ['coms-project-presence', variables.current_project_id],
        });
      }
    },
  });
}

export function useProjectPresence(projectId: string | null) {
  return useQuery({
    queryKey: ['coms-project-presence', projectId],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/presence/project/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch presence' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ProjectPresence;
    },
    enabled: !!projectId,
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

// ============================================================================
// READ RECEIPTS
// ============================================================================

export function useMarkChannelRead(channelId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId?: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message_id: messageId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to mark read' }));
        throw new Error(error.detail);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-channels'] });
      queryClient.invalidateQueries({ queryKey: ['coms-unread-counts'] });
    },
  });
}

export function useUnreadCounts(projectId: string | null) {
  return useQuery({
    queryKey: ['coms-unread-counts', projectId],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);

      const response = await fetch(`${API_BASE}/api/v1/coms/unread-counts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch unread counts' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as UnreadCountsResponse;
    },
    enabled: !!projectId,
    refetchInterval: 10000,
  });
}

// ============================================================================
// TEMPLATES
// ============================================================================

export function useChannelTemplates() {
  return useQuery({
    queryKey: ['coms-templates'],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/coms/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch templates' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ChannelTemplate[];
    },
  });
}

export function useApplyTemplates(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateKeys: string[]) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/coms/projects/${projectId}/apply-templates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ template_keys: templateKeys }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to apply templates' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as ApplyTemplatesResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coms-channels', { projectId }] });
    },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
