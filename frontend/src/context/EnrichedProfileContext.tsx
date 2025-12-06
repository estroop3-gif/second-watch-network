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
import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
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

  // Check for filmmaker profile existence
  const { data: hasFilmmakerProfile, isLoading: filmmakerLoading } = useQuery({
    queryKey: ['filmmaker-profile-exists', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from('filmmaker_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return !error && !!data;
    },
    enabled: !!user,
    staleTime: 60000, // Cache for 1 minute
  });

  // Check for partner profile existence
  const { data: hasPartnerProfile, isLoading: partnerLoading } = useQuery({
    queryKey: ['partner-profile-exists', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from('partner_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      return !error && !!data;
    },
    enabled: !!user,
    staleTime: 60000,
  });

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
  const enrichedProfile = useMemo<ProfileWithRoles | null>(() => {
    if (!baseProfile && !user) return null;

    const base = (baseProfile || {}) as ProfileWithRoles;

    // Merge profile flags with profile existence and auth metadata
    return {
      ...base,
      id: base.id || user?.id,
      // Merge from multiple sources: profile table, profile existence, auth metadata
      is_superadmin: base.is_superadmin || authRoles.has('superadmin'),
      is_admin: base.is_admin || authRoles.has('admin'),
      is_moderator: base.is_moderator || authRoles.has('moderator'),
      is_filmmaker: base.is_filmmaker || hasFilmmakerProfile || authRoles.has('filmmaker'),
      is_partner: base.is_partner || hasPartnerProfile || authRoles.has('partner'),
      is_premium: base.is_premium || authRoles.has('premium'),
      is_order_member: base.is_order_member || orderData?.hasProfile || authRoles.has('order_member'),
      is_lodge_officer: base.is_lodge_officer || orderData?.isOfficer || authRoles.has('lodge_officer'),
    };
  }, [baseProfile, user, authRoles, hasFilmmakerProfile, hasPartnerProfile, orderData]);

  // Compute badge information using enriched profile
  const activeRoles = useMemo(() => getActiveRolesFromProfile(enrichedProfile), [enrichedProfile]);
  const primaryBadge = useMemo(() => getPrimaryBadge(enrichedProfile), [enrichedProfile]);
  const allBadges = useMemo(() => getAllBadges(enrichedProfile), [enrichedProfile]);

  // Role checks
  const isSuperadmin = hasRole(enrichedProfile, 'superadmin');
  const isAdmin = hasRole(enrichedProfile, 'admin');
  const isModerator = hasRole(enrichedProfile, 'moderator');
  const isFilmmaker = hasRole(enrichedProfile, 'filmmaker');
  const isPartner = hasRole(enrichedProfile, 'partner');
  const isPremium = hasRole(enrichedProfile, 'premium');
  const isOrderMember = hasRole(enrichedProfile, 'order_member');
  const isLodgeOfficer = hasRole(enrichedProfile, 'lodge_officer');

  const isLoading = profileLoading || filmmakerLoading || partnerLoading || orderLoading;

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
    isFilmmaker,
    isPartner,
    isPremium,
    isOrderMember,
    isLodgeOfficer,
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
      isFilmmaker: false,
      isPartner: false,
      isPremium: false,
      isOrderMember: false,
      isLodgeOfficer: false,
      hasFilmmakerProfile: false,
      hasPartnerProfile: false,
      hasOrderProfile: false,
      isLoading: true,
      refetch: () => {},
    };
  }
  return context;
}
