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

export type PrimaryRoleMode = 'superadmin' | 'admin' | 'filmmaker' | 'partner' | 'premium' | 'free';

// Credit type
export interface CreditDB {
  id: string;
  user_id: string;
  title: string;
  role?: string;
  year?: number;
  project_type?: string;
  description?: string;
  link?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MyProfileData {
  // Base profile
  profile: ProfileWithRoles | null;

  // Role-specific profiles
  filmmakerProfile: FilmmakerProfileDB | null;
  partnerProfile: PartnerProfileDB | null;
  orderMemberProfile: OrderMemberProfile | null;
  lodgeMemberships: LodgeMembership[];

  // Credits
  credits: CreditDB[];

  // Computed values
  primaryRoleMode: PrimaryRoleMode;
  primaryBadge: ReturnType<typeof getPrimaryBadge>;
  allBadges: ReturnType<typeof getAllBadges>;
  activeRoles: Set<RoleType>;

  // Role checks
  isSuperadmin: boolean;
  isAdmin: boolean;
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

  // Fetch partner profile (table may not exist yet - handle gracefully)
  const { data: partnerProfile, isLoading: partnerLoading } = useQuery({
    queryKey: ['partner-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      try {
        const { data, error } = await supabase
          .from('partner_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          // PGRST116 = no row found, 42P01 = table doesn't exist
          if (error.code === 'PGRST116' || error.code === '42P01') return null;
          // Don't log errors for missing table - it's expected until schema is created
          if (!error.message?.includes('partner_profiles')) {
            console.error('Error fetching partner profile:', error);
          }
          return null;
        }
        return data as PartnerProfileDB;
      } catch {
        // Silently handle if table doesn't exist
        return null;
      }
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

  // Fetch credits (order by created_at since year column may not exist)
  const { data: credits, isLoading: creditsLoading } = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async () => {
      if (!user) return [];
      try {
        const { data, error } = await supabase
          .from('credits')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          // Table might not exist or have different schema
          if (error.code === '42P01' || error.code === '42703') return [];
          console.error('Error fetching credits:', error);
          return [];
        }
        return (data || []) as CreditDB[];
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  // Profile existence checks (need these before enriching profile)
  const hasFilmmakerProfile = !!filmmakerProfile;
  const hasPartnerProfile = !!partnerProfile;
  const hasOrderProfile = !!orderMemberProfile;
  const hasActiveLodge = (lodgeMemberships || []).some(m => m.status === 'active');
  const hasOfficerLodge = (lodgeMemberships || []).some(m => m.status === 'active' && m.role && ['master', 'warden', 'officer', 'secretary', 'treasurer'].includes(m.role.toLowerCase()));

  // Create an enriched profile that reflects actual role-specific profile existence
  // This ensures badges are correct even if the boolean flags in profiles table are out of sync
  const enrichedProfile: ProfileWithRoles | null = baseProfile ? {
    ...(baseProfile as ProfileWithRoles),
    // Merge existing flags with actual profile existence
    is_filmmaker: (baseProfile as any).is_filmmaker || hasFilmmakerProfile,
    is_partner: (baseProfile as any).is_partner || hasPartnerProfile,
    is_order_member: (baseProfile as any).is_order_member || hasOrderProfile,
    is_lodge_officer: (baseProfile as any).is_lodge_officer || hasOfficerLodge,
  } : null;

  // Compute role information using enriched profile
  const activeRoles = getActiveRolesFromProfile(enrichedProfile);
  const primaryBadge = getPrimaryBadge(enrichedProfile);
  const allBadges = getAllBadges(enrichedProfile);

  // Role checks (using enriched profile)
  const isSuperadmin = hasRole(enrichedProfile, 'superadmin');
  const isAdmin = hasRole(enrichedProfile, 'admin');
  const isFilmmaker = hasRole(enrichedProfile, 'filmmaker');
  const isPartner = hasRole(enrichedProfile, 'partner');
  const isPremium = hasRole(enrichedProfile, 'premium');
  const isOrderMember = hasRole(enrichedProfile, 'order_member');
  const isLodgeOfficer = hasRole(enrichedProfile, 'lodge_officer');

  // Determine primary role mode for the profile view
  // Priority matches badge hierarchy: superadmin > admin > filmmaker > partner > premium > free
  let primaryRoleMode: PrimaryRoleMode = 'free';
  if (isSuperadmin) {
    primaryRoleMode = 'superadmin';
  } else if (isAdmin) {
    primaryRoleMode = 'admin';
  } else if (isFilmmaker) {
    primaryRoleMode = 'filmmaker';
  } else if (isPartner) {
    primaryRoleMode = 'partner';
  } else if (isPremium) {
    primaryRoleMode = 'premium';
  }

  const isLoading = profileLoading || filmmakerLoading || partnerLoading || orderLoading || lodgeLoading || creditsLoading;
  const isError = profileError;

  const refetch = () => {
    refetchProfile();
  };

  return {
    profile: enrichedProfile,
    filmmakerProfile: filmmakerProfile || null,
    partnerProfile: partnerProfile || null,
    orderMemberProfile: orderMemberProfile || null,
    lodgeMemberships: lodgeMemberships || [],
    credits: credits || [],
    primaryRoleMode,
    primaryBadge,
    allBadges,
    activeRoles,
    isSuperadmin,
    isAdmin,
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
