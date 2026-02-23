import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type RelationshipState = 'none' | 'outboundPending' | 'inboundPending' | 'connected';

type ConnectionRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'denied';
  created_at: string;
};

export function useConnectionRelationship(peerId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const enabled = !!user?.id && !!peerId && user.id !== peerId;

  const { data: connection, isLoading, refetch } = useQuery({
    queryKey: ['connectionRelationship', user?.id, peerId],
    enabled,
    queryFn: async () => {
      if (!user || !peerId) return null;

      try {
        const data = await api.getConnectionRelationship(peerId, user.id);
        return data as ConnectionRow | null;
      } catch (error) {
        console.error('Connection relationship error:', error);
        return null;
      }
    },
  });

  const state: RelationshipState = (() => {
    if (!enabled) return 'none';
    if (!connection) return 'none';
    if (connection.status === 'accepted') return 'connected';
    if (connection.status === 'pending') {
      if (connection.requester_id === user?.id) return 'outboundPending';
      return 'inboundPending';
    }
    // denied (historical) should allow a new request
    return 'none';
  })();

  const sendRequest = useMutation({
    mutationFn: async () => {
      if (!user || !peerId) throw new Error('Missing user or peer');
      await api.createConnectionRequest({ recipient_id: peerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectionRelationship', user?.id, peerId] });
    },
  });

  const accept = useMutation({
    mutationFn: async (requestId: string) => {
      await api.updateConnection(requestId, 'accepted');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectionRelationship', user?.id, peerId] });
    },
  });

  const deny = useMutation({
    mutationFn: async (requestId: string) => {
      await api.updateConnection(requestId, 'denied');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectionRelationship', user?.id, peerId] });
    },
  });

  const cancel = useMutation({
    mutationFn: async (requestId: string) => {
      await api.deleteConnection(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectionRelationship', user?.id, peerId] });
    },
  });

  return {
    isSelf: user?.id === peerId,
    connection,
    state,
    isLoading,
    refetch,
    sendRequest,
    accept,
    deny,
    cancel,
  };
}
