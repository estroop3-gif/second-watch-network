/**
 * useApplicantProfile - Fetches full profile data for an applicant
 * Includes bio, all credits, reel links, skills, location, experience level
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ApplicantFullProfile {
  id: string;
  username: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  experience_level?: string;
  reel_links?: string[];
  skills?: string[];
  is_order_member?: boolean;
  role?: string;
  // Filmmaker-specific fields
  primary_role?: string;
  secondary_roles?: string[];
  imdb_url?: string;
  website_url?: string;
  social_links?: Record<string, string>;
  availability_status?: string;
}

export interface ApplicantCredit {
  id: string;
  project_title: string;
  role: string;
  role_type?: string;
  year?: number;
  department?: string;
  production_type?: string;
  description?: string;
  imdb_url?: string;
  is_highlighted?: boolean;
}

interface UseApplicantProfileResult {
  profile: ApplicantFullProfile | undefined;
  credits: ApplicantCredit[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useApplicantProfile(userId: string | undefined): UseApplicantProfileResult {
  // Fetch full filmmaker profile
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    error: profileErrorData,
  } = useQuery({
    queryKey: ['applicant-profile', userId],
    queryFn: () => api.getFilmmakerProfile(userId!),
    enabled: !!userId,
  });

  // Fetch all credits for the user
  const {
    data: credits,
    isLoading: creditsLoading,
    isError: creditsError,
    error: creditsErrorData,
  } = useQuery({
    queryKey: ['applicant-credits', userId],
    queryFn: () => api.getUserCredits(userId!),
    enabled: !!userId,
  });

  return {
    profile: profile as ApplicantFullProfile | undefined,
    credits: (credits as ApplicantCredit[]) || [],
    isLoading: profileLoading || creditsLoading,
    isError: profileError || creditsError,
    error: (profileErrorData || creditsErrorData) as Error | null,
  };
}
