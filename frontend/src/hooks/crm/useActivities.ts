import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
  return useQuery({
    queryKey: ['crm-activities', filters],
    queryFn: () => api.getCRMActivities(filters),
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
  return useQuery({
    queryKey: ['crm-activity-calendar', month, year],
    queryFn: () => api.getCRMActivityCalendar(month, year),
  });
}

export function useFollowUps() {
  return useQuery({
    queryKey: ['crm-follow-ups'],
    queryFn: () => api.getCRMFollowUps(),
  });
}
