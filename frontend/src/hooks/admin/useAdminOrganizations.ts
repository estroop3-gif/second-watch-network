/**
 * Admin Organization Management Hooks
 *
 * Hooks for managing organization tiers, quotas, and usage in the admin panel.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// =============================================================================
// Types
// =============================================================================

export interface OrganizationTier {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_cents: number;
  owner_seats: number;
  collaborative_seats: number;
  freelancer_seats_per_project: number;
  view_only_seats_per_project: number;
  active_projects_limit: number;
  active_storage_bytes: number;
  archive_storage_bytes: number;
  monthly_bandwidth_bytes: number;
  enterprise_support: boolean;
  priority_email_response: boolean;
  training_discount_percent: number;
  public_call_sheet_links: boolean;
  stripe_price_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string | null;
  org_type: string | null;
  status: string;
  tier_id: string | null;
  tier_name: string | null;
  tier_display_name: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  billing_email: string | null;
  created_at: string;
  // Usage
  current_owner_seats: number;
  current_collaborative_seats: number;
  current_active_projects: number;
  current_active_storage_bytes: number;
  current_archive_storage_bytes: number;
  current_month_bandwidth_bytes: number;
  // Limits
  limit_owner_seats: number;
  limit_collaborative_seats: number;
  limit_active_projects: number;
  limit_active_storage_bytes: number;
  limit_archive_storage_bytes: number;
  limit_monthly_bandwidth_bytes: number;
  // Flags
  has_overrides: boolean;
}

export interface OrganizationUsage {
  organization_id: string;
  current_owner_seats: number;
  current_collaborative_seats: number;
  current_active_projects: number;
  current_active_storage_bytes: number;
  current_archive_storage_bytes: number;
  current_month_bandwidth_bytes: number;
  bandwidth_reset_date: string;
  last_calculated_at: string | null;
}

export interface AdminOrgStats {
  total_organizations: number;
  active_organizations: number;
  organizations_by_tier: Record<string, number>;
  organizations_by_status: Record<string, number>;
  total_storage_used_bytes: number;
  total_bandwidth_this_month_bytes: number;
}

export interface OrganizationFilters {
  search?: string;
  tier_id?: string;
  subscription_status?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface UserOrgLimit {
  user_id: string;
  max_organizations_allowed: number;
  current_organizations_owned: number;
}

export interface UserWithOrgLimit {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  max_organizations_allowed: number;
  current_organizations_owned: number;
}

export interface UserOrgLimitFilters {
  search?: string;
  has_multiple_orgs?: boolean;
  page?: number;
  page_size?: number;
}

export interface BandwidthLog {
  id: string;
  organization_id: string;
  project_id: string | null;
  user_id: string | null;
  user_name: string | null;
  event_type: string;
  bytes_transferred: number;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

// =============================================================================
// Tier Hooks
// =============================================================================

/**
 * Get all organization tiers
 */
export function useOrganizationTiers(includeInactive = false) {
  return useQuery({
    queryKey: ['admin-organization-tiers', includeInactive],
    queryFn: async (): Promise<OrganizationTier[]> => {
      const response = await api.get(`/api/v1/admin/organizations/tiers?include_inactive=${includeInactive}`);
      return response;
    },
    retry: 2,
    staleTime: 30000,
  });
}

/**
 * Get a specific tier
 */
export function useOrganizationTier(tierId: string) {
  return useQuery({
    queryKey: ['admin-organization-tier', tierId],
    queryFn: async (): Promise<OrganizationTier> => {
      const response = await api.get(`/api/v1/admin/organizations/tiers/${tierId}`);
      return response;
    },
    enabled: !!tierId,
  });
}

/**
 * Update a tier
 */
export function useUpdateTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tierId, data }: { tierId: string; data: Partial<OrganizationTier> }) => {
      return api.put(`/api/v1/admin/organizations/tiers/${tierId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organization-tier'] });
    },
  });
}

// =============================================================================
// Organization Hooks
// =============================================================================

/**
 * List organizations with filters and pagination
 */
export function useAdminOrganizations(filters: OrganizationFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.tier_id) params.append('tier_id', filters.tier_id);
  if (filters.subscription_status) params.append('subscription_status', filters.subscription_status);
  if (filters.status) params.append('status', filters.status);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.page_size) params.append('page_size', filters.page_size.toString());

  return useQuery({
    queryKey: ['admin-organizations', filters],
    queryFn: async () => {
      const response = await api.get(`/api/v1/admin/organizations?${params.toString()}`);
      return response as {
        items: AdminOrganization[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      };
    },
  });
}

/**
 * Get organization statistics
 */
export function useAdminOrgStats() {
  return useQuery({
    queryKey: ['admin-organization-stats'],
    queryFn: async (): Promise<AdminOrgStats> => {
      const response = await api.get('/api/v1/admin/organizations/stats');
      return response;
    },
  });
}

/**
 * Get a single organization with details
 */
export function useAdminOrganization(orgId: string) {
  return useQuery({
    queryKey: ['admin-organization', orgId],
    queryFn: async (): Promise<AdminOrganization> => {
      const response = await api.get(`/api/v1/admin/organizations/${orgId}`);
      return response;
    },
    enabled: !!orgId,
  });
}

/**
 * Get organization usage
 */
export function useAdminOrgUsage(orgId: string) {
  return useQuery({
    queryKey: ['admin-organization-usage', orgId],
    queryFn: async (): Promise<OrganizationUsage> => {
      const response = await api.get(`/api/v1/admin/organizations/${orgId}/usage`);
      return response;
    },
    enabled: !!orgId,
  });
}

/**
 * Update organization (tier, status, billing)
 */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, data }: { orgId: string; data: { tier_id?: string; subscription_status?: string; billing_email?: string; status?: string } }) => {
      return api.put(`/api/v1/admin/organizations/${orgId}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organization', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organization-stats'] });
    },
  });
}

/**
 * Set override limits for an organization
 */
export function useSetOrgOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, data }: {
      orgId: string;
      data: {
        owner_seats?: number;
        collaborative_seats?: number;
        freelancer_seats_per_project?: number;
        view_only_seats_per_project?: number;
        active_projects_limit?: number;
        active_storage_bytes?: number;
        archive_storage_bytes?: number;
        monthly_bandwidth_bytes?: number;
      }
    }) => {
      return api.put(`/api/v1/admin/organizations/${orgId}/override`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organization', variables.orgId] });
    },
  });
}

/**
 * Clear override limits for an organization
 */
export function useClearOrgOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orgId: string) => {
      return api.delete(`/api/v1/admin/organizations/${orgId}/override`);
    },
    onSuccess: (_, orgId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organization', orgId] });
    },
  });
}

/**
 * Recalculate organization usage
 */
export function useRecalculateOrgUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orgId: string) => {
      return api.post(`/api/v1/admin/organizations/${orgId}/recalculate`, {});
    },
    onSuccess: (_, orgId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization-usage', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organization', orgId] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
    },
  });
}

// =============================================================================
// User Org Limit Hooks
// =============================================================================

/**
 * List users with their organization limits
 */
export function useUsersWithOrgLimits(filters: UserOrgLimitFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.has_multiple_orgs) params.append('has_multiple_orgs', 'true');
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.page_size) params.append('page_size', filters.page_size.toString());

  return useQuery({
    queryKey: ['admin-users-with-org-limits', filters],
    queryFn: async () => {
      const response = await api.get(`/api/v1/admin/organizations/users-with-limits?${params.toString()}`);
      return response as {
        items: UserWithOrgLimit[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      };
    },
    retry: 2,
    staleTime: 30000,
  });
}

/**
 * Get user's organization limit
 */
export function useUserOrgLimit(userId: string) {
  return useQuery({
    queryKey: ['admin-user-org-limit', userId],
    queryFn: async (): Promise<UserOrgLimit> => {
      const response = await api.get(`/api/v1/admin/organizations/users/${userId}/org-limit`);
      return response;
    },
    enabled: !!userId,
  });
}

/**
 * Set user's organization limit
 */
export function useSetUserOrgLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, limit }: { userId: string; limit: number }) => {
      return api.put(`/api/v1/admin/organizations/users/${userId}/org-limit`, { max_organizations_allowed: limit });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-org-limit', variables.userId] });
    },
  });
}

// =============================================================================
// Bandwidth Log Hooks
// =============================================================================

/**
 * Get bandwidth logs for an organization
 */
export function useOrgBandwidthLogs(
  orgId: string,
  filters: { event_type?: string; start_date?: string; end_date?: string; page?: number; page_size?: number } = {}
) {
  const params = new URLSearchParams();
  if (filters.event_type) params.append('event_type', filters.event_type);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.page_size) params.append('page_size', filters.page_size.toString());

  return useQuery({
    queryKey: ['admin-org-bandwidth-logs', orgId, filters],
    queryFn: async () => {
      const response = await api.get(`/api/v1/admin/organizations/${orgId}/bandwidth-logs?${params.toString()}`);
      return response as {
        items: BandwidthLog[];
        total: number;
        page: number;
        page_size: number;
      };
    },
    enabled: !!orgId,
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format cents to dollar amount
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Calculate percentage used
 */
export function calculateUsagePercent(used: number, limit: number): number {
  if (limit === -1) return 0; // Unlimited
  if (limit === 0) return used > 0 ? 100 : 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}
