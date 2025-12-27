import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useProfile = () => {
  const { user } = useAuth();

  const fetchProfile = async () => {
    if (!user) return null;

    // Use the API to get the current user's profile
    const profile = await api.getCurrentUser();
    return profile;
  };

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: fetchProfile,
    enabled: !!user,
  });

  return { profile, isLoading, isError, refetch };
};
