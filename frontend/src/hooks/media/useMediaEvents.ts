import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMediaEvents(params?: {
  event_type?: string;
  status?: string;
  start?: string;
  end?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['media-events', params],
    queryFn: () => api.getMediaEvents(params),
  });
}

export function useMediaEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['media-event', id],
    queryFn: () => api.getMediaEvent(id!),
    enabled: !!id,
  });
}

export function useCreateMediaEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createMediaEvent(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-events'] });
      qc.invalidateQueries({ queryKey: ['media-calendar'] });
      qc.invalidateQueries({ queryKey: ['media-dashboard'] });
    },
  });
}

export function useUpdateMediaEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateMediaEvent(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['media-events'] });
      qc.invalidateQueries({ queryKey: ['media-event', id] });
      qc.invalidateQueries({ queryKey: ['media-calendar'] });
      qc.invalidateQueries({ queryKey: ['media-dashboard'] });
    },
  });
}

export function useDeleteMediaEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMediaEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-events'] });
      qc.invalidateQueries({ queryKey: ['media-calendar'] });
      qc.invalidateQueries({ queryKey: ['media-dashboard'] });
    },
  });
}

export function useUpdateMediaEventStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateMediaEventStatus(id, { status }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['media-events'] });
      qc.invalidateQueries({ queryKey: ['media-event', id] });
      qc.invalidateQueries({ queryKey: ['media-calendar'] });
      qc.invalidateQueries({ queryKey: ['media-dashboard'] });
    },
  });
}

export function useAddEventAttendee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: { profile_id: string; rsvp_status?: string; role?: string; notes?: string } }) =>
      api.addMediaEventAttendee(eventId, data),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
    },
  });
}

export function useUpdateEventAttendee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, profileId, data }: { eventId: string; profileId: string; data: any }) =>
      api.updateMediaEventAttendee(eventId, profileId, data),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
    },
  });
}

export function useRemoveEventAttendee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, profileId }: { eventId: string; profileId: string }) =>
      api.removeMediaEventAttendee(eventId, profileId),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
    },
  });
}

export function useRSVPEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, rsvp_status }: { eventId: string; rsvp_status: string }) =>
      api.rsvpMediaEvent(eventId, { rsvp_status }),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
      qc.invalidateQueries({ queryKey: ['media-events'] });
    },
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: { label: string; assigned_to?: string; sort_order?: number } }) =>
      api.addMediaEventChecklistItem(eventId, data),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
    },
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, itemId, data }: { eventId: string; itemId: string; data: any }) =>
      api.updateMediaEventChecklistItem(eventId, itemId, data),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
    },
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, itemId }: { eventId: string; itemId: string }) =>
      api.deleteMediaEventChecklistItem(eventId, itemId),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
    },
  });
}

export function useAddAgendaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: any }) =>
      api.addMediaEventAgendaItem(eventId, data),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
    },
  });
}

export function useUpdateAgendaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, itemId, data }: { eventId: string; itemId: string; data: any }) =>
      api.updateMediaEventAgendaItem(eventId, itemId, data),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
    },
  });
}

export function useDeleteAgendaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, itemId }: { eventId: string; itemId: string }) =>
      api.deleteMediaEventAgendaItem(eventId, itemId),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['media-event', eventId] });
    },
  });
}
