/**
 * React Query hooks for Live Events
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '@/lib/api/watch';
import type { RSVPStatus } from '@/types/watch';

/**
 * Get upcoming events
 */
export function useUpcomingEvents(params?: {
  worldId?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['events-upcoming', params],
    queryFn: () => eventsApi.getUpcoming(params),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Get currently live events
 */
export function useLiveEvents() {
  return useQuery({
    queryKey: ['events-live'],
    queryFn: () => eventsApi.getLive(),
    staleTime: 30 * 1000, // 30 seconds - check frequently for live status
    refetchInterval: 30 * 1000,
  });
}

/**
 * Get user's upcoming events (from followed worlds + RSVP'd)
 */
export function useMyUpcomingEvents(limit = 10) {
  return useQuery({
    queryKey: ['events-my-upcoming', limit],
    queryFn: () => eventsApi.getMyUpcoming(limit),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Get a single event
 */
export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.getEvent(eventId!),
    enabled: !!eventId,
    staleTime: 1 * 60 * 1000,
    // Refetch more frequently when event is live
    refetchInterval: (query) => {
      const event = query.state.data;
      if (event?.status === 'live' || event?.status === 'starting') {
        return 10 * 1000; // 10 seconds
      }
      return false;
    },
  });
}

/**
 * RSVP to event
 */
export function useEventRsvp() {
  const queryClient = useQueryClient();

  const rsvpMutation = useMutation({
    mutationFn: ({
      eventId,
      status,
    }: {
      eventId: string;
      status: RSVPStatus;
    }) => eventsApi.rsvp(eventId, status),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['events-my-upcoming'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (eventId: string) => eventsApi.cancelRsvp(eventId),
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['events-my-upcoming'] });
    },
  });

  return {
    rsvp: rsvpMutation.mutate,
    cancel: cancelMutation.mutate,
    isRsvping: rsvpMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}

/**
 * Get chat messages for an event
 */
export function useEventChat(eventId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['event-chat', eventId],
    queryFn: () => eventsApi.getChatMessages(eventId!, 100),
    enabled: !!eventId && enabled,
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 5 * 1000, // Poll for new messages
  });
}

/**
 * Send chat message
 */
export function useSendChatMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      message,
      type,
    }: {
      eventId: string;
      message: string;
      type?: 'chat' | 'question';
    }) => eventsApi.sendChatMessage(eventId, message, type),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-chat', eventId] });
    },
  });
}

/**
 * Hook for managing viewer session (join/heartbeat/leave)
 */
export function useViewerSession(eventId: string | undefined) {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('viewer_session_id') || crypto.randomUUID()
    : '';

  // Store session ID
  if (typeof window !== 'undefined' && sessionId) {
    localStorage.setItem('viewer_session_id', sessionId);
  }

  const joinMutation = useMutation({
    mutationFn: () => eventsApi.joinEvent(eventId!, sessionId),
  });

  const heartbeatMutation = useMutation({
    mutationFn: () => eventsApi.heartbeat(eventId!, sessionId),
  });

  const leaveMutation = useMutation({
    mutationFn: () => eventsApi.leaveEvent(eventId!, sessionId),
  });

  return {
    sessionId,
    join: joinMutation.mutate,
    heartbeat: heartbeatMutation.mutate,
    leave: leaveMutation.mutate,
    isJoining: joinMutation.isPending,
  };
}
