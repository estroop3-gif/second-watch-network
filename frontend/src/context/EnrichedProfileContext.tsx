/**
 * EnrichedProfileContext
 *
 * Provides a unified, enriched profile that combines:
 * - Base profile from profiles table
 * - Role-specific profile existence (filmmaker_profiles, partner_profiles, etc.)
 * - Auth metadata roles
 *
 * This ensures badges and role checks are consistent across the entire app.
 */
import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { api, safeStorage } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { orderAPI } from '@/lib/api/order';
import {
  type ProfileWithRoles,
  type RoleType,
  type BadgeConfig,
  getPrimaryBadge,
  getAllBadges,
  hasRole,
  getActiveRolesFromProfile,
} from '@/lib/badges';

const CACHED_ROLES_KEY = 'swn_cached_roles';

interface EnrichedProfileContextValue {
  // The enriched profile with all role flags properly set
  profile: ProfileWithRoles | null;

  // Badge information
  primaryBadge: BadgeConfig;
  allBadges: BadgeConfig[];
  activeRoles: Set<RoleType>;

  // Role checks
  isSuperadmin: boolean;
  isAdmin: boolean;
  isFilmmaker: boolean;
  isPartner: boolean;
  isPremium: boolean;
  isOrderMember: boolean;
  isLodgeOfficer: boolean;
  isModerator: boolean;
  isSalesAdmin: boolean;
  isSalesAgent: boolean;
  isSalesRep: boolean;

  // Profile existence checks
  hasFilmmakerProfile: boolean;
  hasPartnerProfile: boolean;
  hasOrderProfile: boolean;

  // Loading state
  isLoading: boolean;

  // Refetch function
  refetch: () => void;
}

const EnrichedProfileContext = createContext<EnrichedProfileContextValue | null>(null);

// Role flags we cache in localStorage for instant availability on next login
const ROLE_CACHE_FIELDS = [
  'is_superadmin', 'is_admin', 'is_moderator', 'is_filmmaker', 'is_partner',
  'is_premium', 'is_order_member', 'is_lodge_officer', 'is_sales_admin',
  'is_sales_agent', 'is_sales_rep',
] as const;

function getCachedRoles(userId: string | undefined): Record<string, boolean> | null {
  if (!userId) return null;
  try {
    const raw = safeStorage.getItem(CACHED_ROLES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only use cache if it matches the current user
    if (parsed._userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedRoles(userId: string, roleFlags: Record<string, boolean>) {
  try {
    safeStorage.setItem(CACHED_ROLES_KEY, JSON.stringify({ ...roleFlags, _userId: userId }));
  } catch {
    // localStorage may be unavailable
  }
}

export function EnrichedProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const { profile: baseProfile, isLoading: profileLoading, refetch: refetchProfile } = useProfile();

  // Get roles from auth metadata as fallback/additional source
  const authRoles = useMemo(() => {
    const rolesFromMeta = (session?.user?.user_metadata?.roles as string[]) || [];
    const legacyRole = session?.user?.user_metadata?.role as string | undefined;
    const roles = new Set<string>(rolesFromMeta);
    if (legacyRole) roles.add(legacyRole);
    return roles;
  }, [session]);

  // Load cached roles from localStorage for instant availability
  // Use profile_id from localStorage as fallback before auth resolves
  const cachedRoles = useMemo(
    () => getCachedRoles(user?.id || safeStorage.getItem('profile_id') || undefined),
    [user?.id],
  );

  // Check for filmmaker profile existence
  const { data: hasFilmmakerProfile, isLoading: filmmakerLoading } = useQuery({
    queryKey: ['filmmaker-profile-exists', user?.id],
    queryFn: async () => {
      if (!user) return false;
      try {
        const profile = await api.getFilmmakerProfile(user.id);
        return !!profile;
      } catch {
        return false;
      }
    },
    enabled: !!user,
    staleTime: 60000, // Cache for 1 minute
  });

  // Partner profile check - disabled until partner_profiles table is created
  const hasPartnerProfile = false;
  const partnerLoading = false;

  // Check for order member profile existence
  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ['order-profile-exists', user?.id],
    queryFn: async () => {
      if (!user) return { hasProfile: false, isOfficer: false };
      try {
        const profile = await orderAPI.getMyProfile();
        const memberships = await orderAPI.getMyLodgeMemberships();
        const isOfficer = (memberships || []).some(
          m => m.status === 'active' && m.role &&
          ['master', 'warden', 'officer', 'secretary', 'treasurer'].includes(m.role.toLowerCase())
        );
        return { hasProfile: !!profile, isOfficer };
      } catch {
        return { hasProfile: false, isOfficer: false };
      }
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Create enriched profile that merges all data sources
  // Sources (in priority order): profile table, profile existence, auth metadata, localStorage cache
  const enrichedProfile = useMemo<ProfileWithRoles | null>(() => {
    if (!baseProfile && !user) return null;

    const base = (baseProfile || {}) as ProfileWithRoles;
    const cache = cachedRoles || {};

    // Merge from multiple sources: profile table, profile existence, auth metadata, cached roles
    return {
      ...base,
      id: base.id || user?.id,
      is_superadmin: base.is_superadmin || authRoles.has('superadmin') || !!cache.is_superadmin,
      is_admin: base.is_admin || authRoles.has('admin') || !!cache.is_admin,
      is_moderator: base.is_moderator || authRoles.has('moderator') || !!cache.is_moderator,
      is_filmmaker: base.is_filmmaker || hasFilmmakerProfile || authRoles.has('filmmaker') || !!cache.is_filmmaker,
      is_partner: base.is_partner || hasPartnerProfile || authRoles.has('partner') || !!cache.is_partner,
      is_premium: base.is_premium || authRoles.has('premium') || !!cache.is_premium,
      is_order_member: base.is_order_member || orderData?.hasProfile || authRoles.has('order_member') || !!cache.is_order_member,
      is_lodge_officer: base.is_lodge_officer || orderData?.isOfficer || authRoles.has('lodge_officer') || !!cache.is_lodge_officer,
      is_sales_admin: base.is_sales_admin || authRoles.has('sales_admin') || !!cache.is_sales_admin,
      is_sales_agent: base.is_sales_agent || authRoles.has('sales_agent') || !!cache.is_sales_agent,
      is_sales_rep: base.is_sales_rep || authRoles.has('sales_rep') || !!cache.is_sales_rep,
    };
  }, [baseProfile, user, authRoles, hasFilmmakerProfile, hasPartnerProfile, orderData, cachedRoles]);

  // Persist role flags to localStorage so they're available instantly on next login
  useEffect(() => {
    if (!enrichedProfile?.id) return;
    const roleFlags: Record<string, boolean> = {};
    for (const field of ROLE_CACHE_FIELDS) {
      roleFlags[field] = !!(enrichedProfile as any)[field];
    }
    saveCachedRoles(enrichedProfile.id, roleFlags);
  }, [enrichedProfile]);

  // Compute badge information using enriched profile
  const activeRoles = useMemo(() => getActiveRolesFromProfile(enrichedProfile), [enrichedProfile]);
  const primaryBadge = useMemo(() => getPrimaryBadge(enrichedProfile), [enrichedProfile]);
  const allBadges = useMemo(() => getAllBadges(enrichedProfile), [enrichedProfile]);

  // Role checks
  const isSuperadmin = hasRole(enrichedProfile, 'superadmin');
  const isAdmin = hasRole(enrichedProfile, 'admin');
  const isModerator = hasRole(enrichedProfile, 'moderator');
  const isSalesAdmin = hasRole(enrichedProfile, 'sales_admin');
  const isFilmmaker = hasRole(enrichedProfile, 'filmmaker');
  const isPartner = hasRole(enrichedProfile, 'partner');
  const isPremium = hasRole(enrichedProfile, 'premium');
  const isOrderMember = hasRole(enrichedProfile, 'order_member');
  const isLodgeOfficer = hasRole(enrichedProfile, 'lodge_officer');
  const isSalesAgent = hasRole(enrichedProfile, 'sales_agent');
  const isSalesRep = hasRole(enrichedProfile, 'sales_rep');

  // Only block on profile loading - the enrichment queries (filmmaker, order) can
  // complete in the background. We have enough data from base profile to render.
  const isLoading = profileLoading;

  const refetch = () => {
    refetchProfile();
  };

  const value: EnrichedProfileContextValue = {
    profile: enrichedProfile,
    primaryBadge,
    allBadges,
    activeRoles,
    isSuperadmin,
    isAdmin,
    isModerator,
    isSalesAdmin,
    isFilmmaker,
    isPartner,
    isPremium,
    isOrderMember,
    isLodgeOfficer,
    isSalesAgent,
    isSalesRep,
    hasFilmmakerProfile: hasFilmmakerProfile || false,
    hasPartnerProfile: hasPartnerProfile || false,
    hasOrderProfile: orderData?.hasProfile || false,
    isLoading,
    refetch,
  };

  return (
    <EnrichedProfileContext.Provider value={value}>
      {children}
    </EnrichedProfileContext.Provider>
  );
}

export function useEnrichedProfile() {
  const context = useContext(EnrichedProfileContext);
  if (!context) {
    throw new Error('useEnrichedProfile must be used within an EnrichedProfileProvider');
  }
  return context;
}

// Optional hook that doesn't throw if used outside provider (returns defaults)
export function useEnrichedProfileSafe() {
  const context = useContext(EnrichedProfileContext);
  if (!context) {
    // Return safe defaults
    return {
      profile: null,
      primaryBadge: { role: 'free', label: 'Free', shortLabel: 'FREE', cssClass: 'bg-muted-gray text-bone-white', priority: 9, description: 'Free tier member' } as BadgeConfig,
      allBadges: [],
      activeRoles: new Set<RoleType>(['free']),
      isSuperadmin: false,
      isAdmin: false,
      isModerator: false,
      isSalesAdmin: false,
      isFilmmaker: false,
      isPartner: false,
      isPremium: false,
      isOrderMember: false,
      isLodgeOfficer: false,
      isSalesAgent: false,
      isSalesRep: false,
      hasFilmmakerProfile: false,
      hasPartnerProfile: false,
      hasOrderProfile: false,
      isLoading: true,
      refetch: () => {},
    };
  }
  return context;
}
