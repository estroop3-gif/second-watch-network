/**
 * React Query hooks for Filmmaker Pro features.
 * Covers: subscription, analytics, rate cards, invoicing,
 * availability, calendar sharing, portfolio.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================================
// Subscription
// ============================================================================

export const useFilmmakerProStatus = () =>
  useQuery({
    queryKey: ['filmmaker-pro-status'],
    queryFn: () => api.get('/filmmaker-pro/subscription/status'),
    staleTime: 30_000,
  });

export const useFilmmakerProCheckout = () => {
  return useMutation({
    mutationFn: (data: { plan: string; success_url?: string; cancel_url?: string }) =>
      api.post('/filmmaker-pro/subscription/checkout', data),
  });
};

export const useCancelFilmmakerPro = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { cancel_at_period_end?: boolean }) =>
      api.post('/filmmaker-pro/subscription/cancel', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filmmaker-pro-status'] }),
  });
};

export const useReactivateFilmmakerPro = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/filmmaker-pro/subscription/reactivate', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filmmaker-pro-status'] }),
  });
};

export const useFilmmakerProPortal = () =>
  useMutation({ mutationFn: () => api.post('/filmmaker-pro/subscription/portal', {}) });

// ============================================================================
// Analytics
// ============================================================================

export const useProAnalyticsOverview = (days = 30) =>
  useQuery({
    queryKey: ['pro-analytics-overview', days],
    queryFn: () => api.get(`/filmmaker-pro/analytics/overview?days=${days}`),
    staleTime: 60_000,
  });

export const useProAnalyticsTrends = (days = 30) =>
  useQuery({
    queryKey: ['pro-analytics-trends', days],
    queryFn: () => api.get(`/filmmaker-pro/analytics/trends?days=${days}`),
    staleTime: 60_000,
  });

export const useProRecentViewers = (limit = 20) =>
  useQuery({
    queryKey: ['pro-recent-viewers', limit],
    queryFn: () => api.get(`/filmmaker-pro/analytics/viewers?limit=${limit}`),
    staleTime: 60_000,
  });

export const useProViewSources = (days = 30) =>
  useQuery({
    queryKey: ['pro-view-sources', days],
    queryFn: () => api.get(`/filmmaker-pro/analytics/sources?days=${days}`),
    staleTime: 60_000,
  });

// ============================================================================
// Rate Cards
// ============================================================================

export const useRateCards = () =>
  useQuery({
    queryKey: ['filmmaker-rate-cards'],
    queryFn: () => api.get('/filmmaker-pro/rate-cards'),
  });

export const usePublicRateCards = (profileId: string) =>
  useQuery({
    queryKey: ['public-rate-cards', profileId],
    queryFn: () => api.get(`/filmmaker-pro/rate-cards/public/${profileId}`),
    enabled: !!profileId,
  });

export const useCreateRateCard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/filmmaker-pro/rate-cards', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filmmaker-rate-cards'] }),
  });
};

export const useUpdateRateCard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/filmmaker-pro/rate-cards/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filmmaker-rate-cards'] }),
  });
};

export const useDeleteRateCard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/filmmaker-pro/rate-cards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filmmaker-rate-cards'] }),
  });
};

// ============================================================================
// Invoices
// ============================================================================

export const useInvoices = (status?: string, limit = 20, offset = 0) =>
  useQuery({
    queryKey: ['filmmaker-invoices', status, limit, offset],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      return api.get(`/filmmaker-pro/invoices?${params}`);
    },
  });

export const useInvoice = (id: string) =>
  useQuery({
    queryKey: ['filmmaker-invoice', id],
    queryFn: () => api.get(`/filmmaker-pro/invoices/${id}`),
    enabled: !!id,
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/filmmaker-pro/invoices', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filmmaker-invoices'] }),
  });
};

export const useUpdateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/filmmaker-pro/invoices/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['filmmaker-invoices'] });
      qc.invalidateQueries({ queryKey: ['filmmaker-invoice'] });
    },
  });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/filmmaker-pro/invoices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filmmaker-invoices'] }),
  });
};

export const useSendInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/filmmaker-pro/invoices/${id}/send`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['filmmaker-invoices'] });
      qc.invalidateQueries({ queryKey: ['filmmaker-invoice'] });
    },
  });
};

export const useMarkInvoicePaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; payment_method?: string; payment_notes?: string }) =>
      api.post(`/filmmaker-pro/invoices/${id}/mark-paid`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['filmmaker-invoices'] });
      qc.invalidateQueries({ queryKey: ['filmmaker-invoice'] });
    },
  });
};

export const usePublicInvoice = (viewToken: string) =>
  useQuery({
    queryKey: ['public-invoice', viewToken],
    queryFn: () => api.get(`/filmmaker-pro/invoices/view/${viewToken}`),
    enabled: !!viewToken,
  });

// ============================================================================
// Availability (Enhanced)
// ============================================================================

export const useProAvailability = () =>
  useQuery({
    queryKey: ['pro-availability'],
    queryFn: () => api.get('/filmmaker-pro/availability'),
  });

export const useCreateProAvailability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/filmmaker-pro/availability', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pro-availability'] }),
  });
};

export const useUpdateProAvailability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/filmmaker-pro/availability/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pro-availability'] }),
  });
};

export const useDeleteProAvailability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/filmmaker-pro/availability/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pro-availability'] }),
  });
};

// Calendar sharing
export const useCalendarShare = () =>
  useQuery({
    queryKey: ['calendar-share'],
    queryFn: () => api.get('/filmmaker-pro/calendar/share'),
  });

export const useRegenerateCalendarShare = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/filmmaker-pro/calendar/share/regenerate', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-share'] }),
  });
};

export const usePublicCalendar = (shareToken: string) =>
  useQuery({
    queryKey: ['public-calendar', shareToken],
    queryFn: () => api.get(`/filmmaker-pro/calendar/${shareToken}`),
    enabled: !!shareToken,
  });

// ============================================================================
// Portfolio
// ============================================================================

export const usePortfolioConfig = () =>
  useQuery({
    queryKey: ['portfolio-config'],
    queryFn: () => api.get('/filmmaker-pro/portfolio'),
  });

export const useUpdatePortfolio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put('/filmmaker-pro/portfolio', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio-config'] }),
  });
};

export const useCheckSlug = (slug: string) =>
  useQuery({
    queryKey: ['portfolio-slug-check', slug],
    queryFn: () => api.get(`/filmmaker-pro/portfolio/check-slug?slug=${slug}`),
    enabled: slug.length > 2,
    staleTime: 5_000,
  });

export const usePublicPortfolio = (slug: string) =>
  useQuery({
    queryKey: ['public-portfolio', slug],
    queryFn: () => api.get(`/filmmaker-pro/p/${slug}`),
    enabled: !!slug,
  });
