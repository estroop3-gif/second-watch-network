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
    const profile = await api.getCurrentUser();
    return profile;
  };

  const { data: queryProfile, isLoading: queryLoading, isError, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: fetchProfile,
    enabled: !!user && !authProfile && !cachedProfile,
    initialData: authProfile || cachedProfile || undefined,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = authLoading || (queryLoading && !authProfile && !cachedProfile);

  // authProfile (from AuthContext) takes priority — it's updated by refreshProfile()
  // after avatar upload and profile edits. queryProfile is frozen at initialData
  // because the query is disabled when authProfile exists.
  return { profile: authProfile || queryProfile || cachedProfile, isLoading, isError, refetch };
};
