import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type RelationshipState = 'none' | 'outboundPending' | 'inboundPending' | 'connected';

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
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

      const { data, error } = await supabase
        .from<ConnectionRow>('connections')
        .select('*')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${peerId}),and(requester_id.eq.${peerId},addressee_id.eq.${user.id})`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
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
      const { error } = await supabase.from('connections').insert({
        requester_id: user.id,
        addressee_id: peerId,
        status: 'pending',
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectionRelationship', user?.id, peerId] });
    },
  });

  const accept = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('id', requestId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectionRelationship', user?.id, peerId] });
    },
  });

  const deny = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'denied' })
        .eq('id', requestId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectionRelationship', user?.id, peerId] });
    },
  });

  const cancel = useMutation({
    // Use DELETE for cancel to avoid relying on a 'cancelled' enum that may not exist
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('id', requestId);
      if (error) throw new Error(error.message);
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