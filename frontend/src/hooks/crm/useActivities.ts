import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const getUserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

interface ActivityFilters {
  contact_id?: string;
  rep_id?: string;
  activity_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export function useActivities(filters: ActivityFilters = {}) {
  const tz = getUserTimezone();
  return useQuery({
    queryKey: ['crm-activities', filters, tz],
    queryFn: () => api.getCRMActivities({ ...filters, tz }),
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMActivity(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-contact'] });
      qc.invalidateQueries({ queryKey: ['crm-interactions-today'] });
      qc.invalidateQueries({ queryKey: ['crm-follow-ups'] });
      qc.invalidateQueries({ queryKey: ['crm-activity-calendar'] });
      qc.invalidateQueries({ queryKey: ['crm-calendar-events'] });
    },
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCRMActivity(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-contact'] });
      qc.invalidateQueries({ queryKey: ['crm-follow-ups'] });
      qc.invalidateQueries({ queryKey: ['crm-activity-calendar'] });
    },
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMActivity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-contact'] });
      qc.invalidateQueries({ queryKey: ['crm-activity-calendar'] });
    },
  });
}

export function useActivityCalendar(month?: number, year?: number) {
  const tz = getUserTimezone();
  return useQuery({
    queryKey: ['crm-activity-calendar', month, year, tz],
    queryFn: () => api.getCRMActivityCalendar(month, year, tz),
  });
}

export function useFollowUps() {
  const tz = getUserTimezone();
  return useQuery({
    queryKey: ['crm-follow-ups', tz],
    queryFn: () => api.getCRMFollowUps(tz),
  });
}

export function useCalendarEvents(month?: number, year?: number) {
  const tz = getUserTimezone();
  return useQuery({
    queryKey: ['crm-calendar-events', month, year, tz],
    queryFn: () => api.getCRMCalendarEvents(month, year, tz),
  });
}

export function useAcceptCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.acceptCRMCalendarEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-calendar-events'] });
      qc.invalidateQueries({ queryKey: ['crm-activity-calendar'] });
      qc.invalidateQueries({ queryKey: ['crm-pending-invites'] });
      qc.invalidateQueries({ queryKey: ['crm-email-thread'] });
    },
  });
}

export function useDeclineCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.declineCRMCalendarEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-calendar-events'] });
      qc.invalidateQueries({ queryKey: ['crm-pending-invites'] });
      qc.invalidateQueries({ queryKey: ['crm-email-thread'] });
    },
  });
}

export function usePendingInviteCount() {
  return useQuery({
    queryKey: ['crm-pending-invites'],
    queryFn: () => api.getCRMPendingInviteCount(),
  });
}
