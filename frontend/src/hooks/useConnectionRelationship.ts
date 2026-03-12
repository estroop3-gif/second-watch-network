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
  const queryKey = ['connectionRelationship', user?.id, peerId];

  const { data: connection, isLoading, refetch } = useQuery({
    queryKey,
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user || !peerId) return null;
      try {
        const data = await api.getConnectionRelationship(peerId);
        return data as ConnectionRow | null;
      } catch (error: any) {
        console.error('[ConnectHook] relationship fetch error:', error?.message ?? error);
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
    return 'none';
  })();

  const sendRequest = useMutation({
    mutationFn: async () => {
      if (!user?.id || !peerId) throw new Error('Missing user or peer');
      console.log('[ConnectHook] POST /connections/ recipient_id:', peerId, 'user.id:', user.id);
      return api.createConnectionRequest({ recipient_id: peerId }) as Promise<ConnectionRow>;
    },
    onMutate: async () => {
      if (!user?.id || !peerId) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, {
        id: 'optimistic',
        requester_id: user.id,
        recipient_id: peerId,
        status: 'pending',
        created_at: new Date().toISOString(),
      } as ConnectionRow);
      return { previous };
    },
    onSuccess: (newConnection) => {
      console.log('[ConnectHook] success — requester_id:', newConnection?.requester_id, 'user.id:', user?.id);
      if (newConnection?.id) {
        queryClient.setQueryData(queryKey, newConnection);
      } else {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (err: any, _vars, context: any) => {
      console.error('[ConnectHook] error:', err?.message ?? err);
      queryClient.setQueryData(queryKey, context?.previous ?? null);
    },
  });

  const accept = useMutation({
    mutationFn: async (requestId: string) => {
      await api.updateConnection(requestId, 'accepted');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deny = useMutation({
    mutationFn: async (requestId: string) => {
      await api.updateConnection(requestId, 'denied');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const cancel = useMutation({
    mutationFn: async (requestId: string) => {
      await api.deleteConnection(requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
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
