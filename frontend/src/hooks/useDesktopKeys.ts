/**
 * useDesktopKeys Hook
 * Manages desktop API keys for the SWN Dailies Helper application
 */
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DesktopKey, DesktopKeyCreateResponse } from '@/types';

export const useDesktopKeys = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // List all active desktop keys for the current user
  const {
    data: keys = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<DesktopKey[]>({
    queryKey: ['desktop-keys', user?.id],
    queryFn: async () => {
      const response = await api.listDesktopKeys();
      return response;
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });

  // Create a new desktop key
  const createKeyMutation = useMutation<DesktopKeyCreateResponse, Error, string>({
    mutationFn: async (name: string) => {
      return await api.createDesktopKey(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['desktop-keys', user?.id] });
    },
  });

  // Revoke a desktop key
  const revokeKeyMutation = useMutation<{ success: boolean; message: string }, Error, string>({
    mutationFn: async (keyId: string) => {
      return await api.revokeDesktopKey(keyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['desktop-keys', user?.id] });
    },
  });

  return {
    keys,
    isLoading,
    isError,
    error,
    refetch,
    createKey: createKeyMutation.mutateAsync,
    isCreating: createKeyMutation.isPending,
    createError: createKeyMutation.error,
    revokeKey: revokeKeyMutation.mutateAsync,
    isRevoking: revokeKeyMutation.isPending,
    revokeError: revokeKeyMutation.error,
  };
};
