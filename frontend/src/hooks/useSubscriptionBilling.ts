import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// =============================================================================
// Public Pricing
// =============================================================================

export function usePublicPricingTiers() {
  return useQuery({
    queryKey: ['subscription-pricing-tiers'],
    queryFn: () => api.getSubscriptionPricingTiers(),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useCalculatePrice() {
  return useMutation({
    mutationFn: (data: { plan_type: string; tier_name?: string; config?: any }) =>
      api.calculateSubscriptionPrice(data),
  });
}

// =============================================================================
// Checkout
// =============================================================================

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (data: { org_id: string; plan_type: string; tier_name?: string; config?: any }) =>
      api.createSubscriptionCheckout(data),
  });
}

export function useTrialConvertCheckout() {
  return useMutation({
    mutationFn: (data: { org_id: string; plan_type?: string; tier_name?: string; config?: any }) =>
      api.createTrialConvertCheckout(data),
  });
}

// =============================================================================
// Subscription Management
// =============================================================================

export function useOrgSubscription(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-subscription', orgId],
    queryFn: () => api.getOrgSubscription(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useChangePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, ...data }: { orgId: string; plan_type: string; tier_name?: string; config?: any }) =>
      api.changeSubscriptionPlan(orgId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-subscription', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['org-modules', variables.orgId] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => api.cancelSubscription(orgId),
    onSuccess: (_data, orgId) => {
      queryClient.invalidateQueries({ queryKey: ['org-subscription', orgId] });
    },
  });
}

export function useReactivateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => api.reactivateSubscription(orgId),
    onSuccess: (_data, orgId) => {
      queryClient.invalidateQueries({ queryKey: ['org-subscription', orgId] });
    },
  });
}

export function usePortalSession() {
  return useMutation({
    mutationFn: ({ orgId, returnTo }: { orgId: string; returnTo?: string }) =>
      api.createSubscriptionPortalSession(orgId, returnTo),
    onSuccess: (data: any) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
  });
}

// =============================================================================
// Module Management
// =============================================================================

export function useOrgModules(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-modules', orgId],
    queryFn: () => api.getOrgModules(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, moduleKey }: { orgId: string; moduleKey: string }) =>
      api.addOrgModule(orgId, moduleKey),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-modules', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['org-subscription', variables.orgId] });
    },
  });
}

export function useRemoveModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, moduleKey }: { orgId: string; moduleKey: string }) =>
      api.removeOrgModule(orgId, moduleKey),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-modules', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['org-subscription', variables.orgId] });
    },
  });
}
