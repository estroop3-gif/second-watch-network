import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePricingTiers() {
  return useQuery({
    queryKey: ['pricing-tiers'],
    queryFn: () => api.getPricingTiers(),
    staleTime: 60 * 60 * 1000, // tiers rarely change
  });
}

export function useComputeQuote() {
  return useMutation({
    mutationFn: (data: any) => api.computeQuotePrice(data),
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createPricingQuote(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-quotes'] });
    },
  });
}

export function useQuotesList(params?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['pricing-quotes', params],
    queryFn: () => api.getPricingQuotes(params),
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['pricing-quote', id],
    queryFn: () => api.getPricingQuote(id!),
    enabled: !!id,
  });
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updatePricingQuoteStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-quotes'] });
      qc.invalidateQueries({ queryKey: ['pricing-quote'] });
    },
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updatePricingQuote(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['pricing-quotes'] });
      qc.invalidateQueries({ queryKey: ['pricing-quote', variables.id] });
    },
  });
}

export function useQuoteText(id: string | undefined) {
  return useQuery({
    queryKey: ['pricing-quote-text', id],
    queryFn: () => api.getPricingQuoteText(id!),
    enabled: !!id,
  });
}
