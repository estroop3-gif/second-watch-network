/**
 * useDashboardConfig Hook
 * Provides role-based dashboard configuration for the adaptive dashboard
 */

import { useMemo } from 'react';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { useAuth } from '@/context/AuthContext';
import type { RoleType } from '@/lib/badges/userBadges';
import {
  type DashboardSectionConfig,
  type QuickAction,
  getSectionsForRole,
  getQuickActionsForRole,
  getHighestRole,
} from '@/components/dashboard/config/dashboardConfig';

export interface DashboardConfigResult {
  // Computed sections and actions
  sections: DashboardSectionConfig[];
  quickActions: QuickAction[];

  // User's effective role
  effectiveRole: RoleType;

  // Role flags (from EnrichedProfile)
  isSuperadmin: boolean;
  isAdmin: boolean;
  isStaff: boolean; // admin OR moderator OR superadmin
  isFilmmaker: boolean;
  isPartner: boolean;
  isOrderMember: boolean;
  isPremium: boolean;

  // Loading state
  isLoading: boolean;

  // Authentication state
  isAuthenticated: boolean;
}

/**
 * Hook to get role-based dashboard configuration
 */
export function useDashboardConfig(): DashboardConfigResult {
  const { session, loading: authLoading } = useAuth();
  const enrichedProfile = useEnrichedProfile();

  const {
    activeRoles,
    isSuperadmin,
    isAdmin,
    isModerator,
    isFilmmaker,
    isPartner,
    isOrderMember,
    isPremium,
    isLoading: profileLoading,
  } = enrichedProfile;

  const isAuthenticated = !!session;
  const isLoading = authLoading || profileLoading;
  const isStaff = isSuperadmin || isAdmin || isModerator;

  // Determine effective role from active roles
  const effectiveRole = useMemo(() => {
    if (!isAuthenticated) return 'free' as RoleType;

    // Convert Set to array for getHighestRole
    const rolesArray = Array.from(activeRoles) as RoleType[];
    if (rolesArray.length === 0) return 'free' as RoleType;

    return getHighestRole(rolesArray);
  }, [activeRoles, isAuthenticated]);

  // Get sections visible to this role
  const sections = useMemo(() => {
    return getSectionsForRole(effectiveRole);
  }, [effectiveRole]);

  // Get quick actions for this role
  const quickActions = useMemo(() => {
    return getQuickActionsForRole(effectiveRole);
  }, [effectiveRole]);

  return {
    sections,
    quickActions,
    effectiveRole,
    isSuperadmin,
    isAdmin,
    isStaff,
    isFilmmaker,
    isPartner,
    isOrderMember,
    isPremium,
    isLoading,
    isAuthenticated,
  };
}

/**
 * Filter sections based on whether they have data
 * Used by the dashboard to hide empty sections
 */
export function filterSectionsWithData(
  sections: DashboardSectionConfig[],
  dataMap: Record<string, boolean>
): DashboardSectionConfig[] {
  return sections.filter(section => {
    // If section doesn't require data, always show it
    if (!section.requiresData) return true;
    // Otherwise, only show if data exists
    return dataMap[section.id] === true;
  });
}
