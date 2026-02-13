import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api, safeStorage } from '@/lib/api';

const getCachedProfile = (): any | null => {
  try {
    const raw = safeStorage.getItem('swn_cached_profile');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const useProfile = () => {
  const { user, profile: authProfile, loading: authLoading } = useAuth();

  const cachedProfile = !authProfile ? getCachedProfile() : null;

  const fetchProfile = async () => {
    if (!user) return null;

    // Use the API to get the current user's profile
    const profile = await api.getCurrentUser();
    return profile;
  };

  const { data: profile, isLoading: queryLoading, isError, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: fetchProfile,
    enabled: !!user && !authProfile && !cachedProfile,
    // Use profile from AuthContext as initial data, fall back to cached profile
    initialData: authProfile || cachedProfile || undefined,
    staleTime: 5 * 60 * 1000,
  });

  // If auth is still loading, show loading. Otherwise use query loading state.
  // But if we have authProfile or cachedProfile, we're not really "loading" even if query is refreshing.
  const isLoading = authLoading || (queryLoading && !authProfile && !cachedProfile);

  return { profile: profile || authProfile || cachedProfile, isLoading, isError, refetch };
};
