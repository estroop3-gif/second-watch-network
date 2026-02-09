import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useKPIOverview(params?: { date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['crm-kpi-overview', params],
    queryFn: () => api.getCRMKPIOverview(params),
  });
}

export function useRepPerformance(params?: { date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['crm-rep-performance', params],
    queryFn: () => api.getCRMRepPerformance(params),
  });
}

export function useKPITrends(params?: { period?: string; months_back?: number }) {
  return useQuery({
    queryKey: ['crm-kpi-trends', params],
    queryFn: () => api.getCRMKPITrends(params),
  });
}

export function useLeaderboard(params?: { metric?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['crm-leaderboard', params],
    queryFn: () => api.getCRMLeaderboard(params),
  });
}
