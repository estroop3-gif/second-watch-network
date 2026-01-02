import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useProfile = () => {
  const { user, profile: authProfile, loading: authLoading } = useAuth();

  const fetchProfile = async () => {
    if (!user) return null;

    // Use the API to get the current user's profile
    const profile = await api.getCurrentUser();
    return profile;
  };

  const { data: profile, isLoading: queryLoading, isError, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: fetchProfile,
    enabled: !!user,
    // Use profile from AuthContext as initial data to avoid loading flash
    initialData: authProfile || undefined,
    // Don't refetch immediately if we have initial data from auth
    staleTime: authProfile ? 30000 : 0,
  });

  // If auth is still loading, show loading. Otherwise use query loading state.
  // But if we have authProfile, we're not really "loading" even if query is refreshing.
  const isLoading = authLoading || (queryLoading && !authProfile);

  return { profile: profile || authProfile, isLoading, isError, refetch };
};
