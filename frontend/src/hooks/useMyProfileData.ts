/**
 * useMyProfileData Hook
 * Fetches all profile data for the current user including:
 * - Base profile from profiles table
 * - Filmmaker profile (if applicable)
 * - Order member profile (if applicable)
 * - Lodge memberships (if applicable)
 * - Partner profile (if applicable)
 */
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { orderAPI, OrderMemberProfile, LodgeMembership } from '@/lib/api/order';
import {
  type ProfileWithRoles,
  type RoleType,
  getPrimaryRole,
  getAllBadges,
  getPrimaryBadge,
  hasRole,
  getActiveRolesFromProfile,
} from '@/lib/badges';

// Types for filmmaker profile data from the database
export interface FilmmakerProfileDB {
  id: string;
  user_id: string;
  full_name?: string;
  bio?: string;
  department?: string;
  experience_level?: string;
  skills?: string[];
  location?: string;
  portfolio_website?: string;
  reel_links?: string[];
  accepting_work?: boolean;
  available_for?: string[];
  preferred_locations?: string[];
  contact_method?: string;
  show_email?: boolean;
  profile_image_url?: string;
  created_at?: string;
  updated_at?: string;
}

// Types for partner profile data
export interface PartnerProfileDB {
  id: string;
  user_id: string;
  organization_name?: string;
  organization_type?: string;
  logo_url?: string;
  website_url?: string;
  contact_email?: string;
  city?: string;
  region?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export type PrimaryRoleMode = 'filmmaker' | 'partner' | 'premium' | 'free';

export interface MyProfileData {
  // Base profile
  profile: ProfileWithRoles | null;

  // Role-specific profiles
  filmmakerProfile: FilmmakerProfileDB | null;
  partnerProfile: PartnerProfileDB | null;
  orderMemberProfile: OrderMemberProfile | null;
  lodgeMemberships: LodgeMembership[];

  // Computed values
  primaryRoleMode: PrimaryRoleMode;
  primaryBadge: ReturnType<typeof getPrimaryBadge>;
  allBadges: ReturnType<typeof getAllBadges>;
  activeRoles: Set<RoleType>;

  // Role checks
  isFilmmaker: boolean;
  isPartner: boolean;
  isPremium: boolean;
  isOrderMember: boolean;
  isLodgeOfficer: boolean;
  hasFilmmakerProfile: boolean;
  hasPartnerProfile: boolean;
  hasOrderProfile: boolean;
  hasActiveLodge: boolean;

  // Loading states
  isLoading: boolean;
  isError: boolean;

  // Refetch
  refetch: () => void;
}

export function useMyProfileData(): MyProfileData {
  const { user } = useAuth();
  const { profile: baseProfile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useProfile();

  // Fetch filmmaker profile
  const { data: filmmakerProfile, isLoading: filmmakerLoading } = useQuery({
    queryKey: ['filmmaker-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('filmmaker_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No row found
        console.error('Error fetching filmmaker profile:', error);
        return null;
      }
      return data as FilmmakerProfileDB;
    },
    enabled: !!user,
  });

  // Fetch partner profile
  const { data: partnerProfile, isLoading: partnerLoading } = useQuery({
    queryKey: ['partner-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('partner_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        console.error('Error fetching partner profile:', error);
        return null;
      }
      return data as PartnerProfileDB;
    },
    enabled: !!user,
  });

  // Fetch Order member profile
  const { data: orderMemberProfile, isLoading: orderLoading } = useQuery({
    queryKey: ['order-member-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      try {
        const profile = await orderAPI.getMyProfile();
        return profile;
      } catch (error) {
        // Order profile doesn't exist
        return null;
      }
    },
    enabled: !!user,
  });

  // Fetch lodge memberships
  const { data: lodgeMemberships, isLoading: lodgeLoading } = useQuery({
    queryKey: ['lodge-memberships', user?.id],
    queryFn: async () => {
      if (!user) return [];
      try {
        const memberships = await orderAPI.getMyLodgeMemberships();
        return memberships || [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!user,
  });

  // Cast profile for badge system
  const profileWithRoles = baseProfile as ProfileWithRoles | null;

  // Compute role information
  const activeRoles = getActiveRolesFromProfile(profileWithRoles);
  const primaryBadge = getPrimaryBadge(profileWithRoles);
  const allBadges = getAllBadges(profileWithRoles);

  // Role checks
  const isFilmmaker = hasRole(profileWithRoles, 'filmmaker');
  const isPartner = hasRole(profileWithRoles, 'partner');
  const isPremium = hasRole(profileWithRoles, 'premium');
  const isOrderMember = hasRole(profileWithRoles, 'order_member');
  const isLodgeOfficer = hasRole(profileWithRoles, 'lodge_officer');

  // Profile existence checks
  const hasFilmmakerProfile = !!filmmakerProfile;
  const hasPartnerProfile = !!partnerProfile;
  const hasOrderProfile = !!orderMemberProfile;
  const hasActiveLodge = (lodgeMemberships || []).some(m => m.status === 'active');

  // Determine primary role mode for the profile view
  // Priority: filmmaker > partner > premium > free
  let primaryRoleMode: PrimaryRoleMode = 'free';
  if (isFilmmaker) {
    primaryRoleMode = 'filmmaker';
  } else if (isPartner) {
    primaryRoleMode = 'partner';
  } else if (isPremium) {
    primaryRoleMode = 'premium';
  }

  const isLoading = profileLoading || filmmakerLoading || partnerLoading || orderLoading || lodgeLoading;
  const isError = profileError;

  const refetch = () => {
    refetchProfile();
  };

  return {
    profile: profileWithRoles,
    filmmakerProfile: filmmakerProfile || null,
    partnerProfile: partnerProfile || null,
    orderMemberProfile: orderMemberProfile || null,
    lodgeMemberships: lodgeMemberships || [],
    primaryRoleMode,
    primaryBadge,
    allBadges,
    activeRoles,
    isFilmmaker,
    isPartner,
    isPremium,
    isOrderMember,
    isLodgeOfficer,
    hasFilmmakerProfile,
    hasPartnerProfile,
    hasOrderProfile,
    hasActiveLodge,
    isLoading,
    isError,
    refetch,
  };
}
