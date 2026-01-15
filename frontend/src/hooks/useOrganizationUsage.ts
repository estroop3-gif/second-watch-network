/**
 * Organization Usage Hooks
 *
 * Owner-facing hooks for viewing organization usage, limits, and billing.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// =============================================================================
// Types
// =============================================================================

export interface TierInfo {
  name: string | null;
  display_name: string | null;
  price_cents: number;
  enterprise_support: boolean;
  public_call_sheet_links: boolean;
}

export interface UsageSummary {
  organization_id: string;
  organization_name: string;
  tier: TierInfo | null;
  subscription_status: string | null;

  // Owner seats
  owner_seats_used: number;
  owner_seats_limit: number;
  owner_seats_percent: number;

  // Collaborative seats
  collaborative_seats_used: number;
  collaborative_seats_limit: number;
  collaborative_seats_percent: number;

  // Projects
  active_projects_used: number;
  active_projects_limit: number;
  active_projects_percent: number;

  // Storage (bytes)
  active_storage_used: number;
  active_storage_limit: number;
  active_storage_percent: number;

  archive_storage_used: number;
  archive_storage_limit: number;
  archive_storage_percent: number;

  // Bandwidth (bytes)
  bandwidth_used: number;
  bandwidth_limit: number;
  bandwidth_percent: number;
  bandwidth_reset_date: string;

  // Warnings
  near_limit_warnings: string[];
}

export interface BandwidthBreakdown {
  total_bytes: number;
  by_event_type: Record<string, number>;
  by_project: Array<{
    project_id: string;
    project_name: string;
    bytes: number;
  }>;
  reset_date: string;
}

export interface StorageBreakdown {
  active_total_bytes: number;
  archive_total_bytes: number;
  by_project: Array<{
    project_id: string;
    project_name: string;
    status: string;
    active_bytes: number;
    archive_bytes: number;
  }>;
}

export interface SeatAllocation {
  owner_seats: Array<{
    id: string;
    user_id: string;
    user_name: string | null;
    user_email: string | null;
    avatar_url: string | null;
    joined_at: string | null;
  }>;
  collaborative_seats: Array<{
    id: string;
    user_id: string;
    user_name: string | null;
    user_email: string | null;
    avatar_url: string | null;
    role: string;
    title: string | null;
    department: string | null;
    joined_at: string | null;
  }>;
  per_project_external_seats: Array<{
    id: string;
    project_id: string;
    project_name: string;
    user_id: string | null;
    user_name: string | null;
    user_email: string | null;
    seat_type: string;
    status: string;
    created_at: string | null;
  }>;
}

export interface AvailableTier {
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
  sort_order: number;
  is_current: boolean;
}

export interface AvailableTiersResponse {
  current_tier_id: string | null;
  tiers: AvailableTier[];
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Get usage summary for an organization
 */
export function useOrganizationUsage(orgId: string) {
  return useQuery({
    queryKey: ['organization-usage', orgId],
    queryFn: async (): Promise<UsageSummary> => {
      const response = await api.get(`/organizations/${orgId}/usage`);
      return response;
    },
    enabled: !!orgId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get bandwidth breakdown for an organization
 */
export function useOrganizationBandwidth(orgId: string) {
  return useQuery({
    queryKey: ['organization-bandwidth', orgId],
    queryFn: async (): Promise<BandwidthBreakdown> => {
      const response = await api.get(`/organizations/${orgId}/usage/bandwidth`);
      return response;
    },
    enabled: !!orgId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get storage breakdown for an organization
 */
export function useOrganizationStorage(orgId: string) {
  return useQuery({
    queryKey: ['organization-storage', orgId],
    queryFn: async (): Promise<StorageBreakdown> => {
      const response = await api.get(`/organizations/${orgId}/usage/storage`);
      return response;
    },
    enabled: !!orgId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get seat allocation for an organization
 */
export function useOrganizationSeats(orgId: string) {
  return useQuery({
    queryKey: ['organization-seats', orgId],
    queryFn: async (): Promise<SeatAllocation> => {
      const response = await api.get(`/organizations/${orgId}/usage/seats`);
      return response;
    },
    enabled: !!orgId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get available tiers for upgrade/comparison
 */
export function useAvailableTiers(orgId: string) {
  return useQuery({
    queryKey: ['organization-available-tiers', orgId],
    queryFn: async (): Promise<AvailableTiersResponse> => {
      const response = await api.get(`/organizations/${orgId}/tiers`);
      return response;
    },
    enabled: !!orgId,
    staleTime: 300000, // 5 minutes
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
 * Get usage status based on percentage
 */
export function getUsageStatus(percent: number): 'ok' | 'warning' | 'critical' {
  if (percent >= 90) return 'critical';
  if (percent >= 75) return 'warning';
  return 'ok';
}

/**
 * Get color class based on usage status
 */
export function getUsageColorClass(status: 'ok' | 'warning' | 'critical'): string {
  switch (status) {
    case 'critical':
      return 'text-red-500';
    case 'warning':
      return 'text-yellow-500';
    default:
      return 'text-green-500';
  }
}

/**
 * Get progress bar color class based on usage status
 */
export function getProgressColorClass(status: 'ok' | 'warning' | 'critical'): string {
  switch (status) {
    case 'critical':
      return 'bg-red-500';
    case 'warning':
      return 'bg-yellow-500';
    default:
      return 'bg-green-500';
  }
}
