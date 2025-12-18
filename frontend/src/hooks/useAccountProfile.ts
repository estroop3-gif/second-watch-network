/**
 * useAccountProfile Hook
 * Fetches combined profile data from both profiles and filmmaker_profiles tables
 * for use in the Account settings page.
 */
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface CombinedProfileData {
  // From profiles table
  id: string;
  username?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  role?: string | null;
  roles?: string[] | null;
  location_visible?: boolean;
  is_filmmaker?: boolean;
  is_partner?: boolean;
  is_premium?: boolean;
  is_order_member?: boolean;
  is_lodge_officer?: boolean;
  is_admin?: boolean;
  is_superadmin?: boolean;
  is_moderator?: boolean;
  has_completed_filmmaker_onboarding?: boolean;
  updated_at?: string | null;

  // From filmmaker_profiles table
  bio?: string | null;
  location?: string | null;
  department?: string | null;
  experience_level?: string | null;
  skills?: string[] | null;
  portfolio_website?: string | null;
  reel_links?: string[] | null;
  accepting_work?: boolean;
  available_for?: string[] | null;
  preferred_locations?: string[] | null;
  contact_method?: string | null;
  show_email?: boolean;
  profile_image_url?: string | null;
  credits?: any[] | null;
}

export const useAccountProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fetchCombinedProfile = async (): Promise<CombinedProfileData | null> => {
    if (!user) return null;

    try {
      // Use the combined profile API endpoint
      const data = await api.getCombinedProfile(user.id);

      const profileData = data.profile;
      const filmmakerData = data.filmmaker_profile;
      const creditsData = data.credits;

      if (!profileData) return null;

      // Combine the data
      const combined: CombinedProfileData = {
        id: profileData.id || user.id,
        // Profile data
        username: profileData?.username || null,
        full_name: profileData?.full_name || null,
        display_name: profileData?.display_name || null,
        avatar_url: profileData?.avatar_url || null,
        email: profileData?.email || user.email || null,
        role: profileData?.role || null,
        roles: profileData?.roles || null,
        location_visible: profileData?.location_visible ?? true,
        is_filmmaker: profileData?.is_filmmaker || false,
        is_partner: profileData?.is_partner || false,
        is_premium: profileData?.is_premium || false,
        is_order_member: profileData?.is_order_member || false,
        is_lodge_officer: profileData?.is_lodge_officer || false,
        is_admin: profileData?.is_admin || false,
        is_superadmin: profileData?.is_superadmin || false,
        is_moderator: profileData?.is_moderator || false,
        has_completed_filmmaker_onboarding: profileData?.has_completed_filmmaker_onboarding || false,
        updated_at: profileData?.updated_at || filmmakerData?.updated_at || null,

        // Filmmaker profile data
        bio: filmmakerData?.bio || null,
        location: filmmakerData?.location || null,
        department: filmmakerData?.department || null,
        experience_level: filmmakerData?.experience_level || null,
        skills: filmmakerData?.skills || null,
        portfolio_website: filmmakerData?.portfolio_website || null,
        reel_links: filmmakerData?.reel_links || null,
        accepting_work: filmmakerData?.accepting_work || false,
        available_for: filmmakerData?.available_for || null,
        preferred_locations: filmmakerData?.preferred_locations || null,
        contact_method: filmmakerData?.contact_method || null,
        show_email: filmmakerData?.show_email || false,
        profile_image_url: filmmakerData?.profile_image_url || null,
        credits: creditsData || null,
      };

      return combined;
    } catch (error) {
      console.error('Error fetching combined profile:', error);
      throw error;
    }
  };

  const { data: profile, isLoading, isError, refetch, error } = useQuery({
    queryKey: ['account-profile', user?.id],
    queryFn: fetchCombinedProfile,
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });

  // Helper to invalidate and refetch
  const invalidateProfile = () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['account-profile', user.id] });
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      queryClient.invalidateQueries({ queryKey: ['filmmaker-profile', user.id] });
    }
  };

  return {
    profile,
    isLoading,
    isError,
    error,
    refetch,
    invalidateProfile,
  };
};
