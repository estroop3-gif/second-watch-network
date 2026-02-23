/**
 * useUserDirectory - Hook for fetching users in The Network tab
 *
 * Provides paginated user listing with:
 * - Search by name/username
 * - Filters for role, Order membership, partner status, location
 * - Connection status relative to current user
 * - Real-time updates via WebSocket when new members join
 */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocketOptional } from '@/hooks/useSocket';

export type DirectoryUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  location: string | null;
  is_order_member: boolean;
  is_partner: boolean;
  connection_status: 'none' | 'pending_sent' | 'pending_received' | 'connected';
};

export type DirectoryFilters = {
  search?: string;
  role?: string;
  is_order_member?: boolean;
  is_partner?: boolean;
  location?: string;
  page?: number;
  limit?: number;
};

export type DirectoryResponse = {
  users: DirectoryUser[];
  total: number;
  page: number;
  pages: number;
};

export function useUserDirectory(filters: DirectoryFilters = {}) {
  const { profileId } = useAuth();
  const queryClient = useQueryClient();
  const socket = useSocketOptional();

  const queryKey = ['user-directory', filters];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<DirectoryResponse> => {
      const response = await api.getUserDirectory({
        search: filters.search,
        role: filters.role,
        is_order_member: filters.is_order_member,
        is_partner: filters.is_partner,
        location: filters.location,
        page: filters.page || 1,
        limit: filters.limit || 20,
      });
      return response;
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Listen for new community members via WebSocket and invalidate directory cache
  useEffect(() => {
    if (!socket?.on) return;

    const handleNewMember = () => {
      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
    };

    socket.on('community_member_joined' as any, handleNewMember);
    return () => {
      socket.off('community_member_joined' as any, handleNewMember);
    };
  }, [socket, queryClient]);

  // Mutation to send connection request
  const sendConnectionRequest = useMutation({
    mutationFn: async (recipientId: string) => {
      const response = await api.createConnectionRequest({
        recipient_id: recipientId,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate directory to refresh connection statuses
      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
    },
  });

  // Optimistically update connection status in cache
  const updateConnectionStatus = (userId: string, status: DirectoryUser['connection_status']) => {
    queryClient.setQueryData<DirectoryResponse>(queryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        users: old.users.map((user) =>
          user.id === userId ? { ...user, connection_status: status } : user
        ),
      };
    });
  };

  return {
    ...query,
    users: query.data?.users || [],
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    pages: query.data?.pages || 1,
    sendConnectionRequest,
    updateConnectionStatus,
    queryKey,
  };
}

export default useUserDirectory;
