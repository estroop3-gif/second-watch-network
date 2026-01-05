/**
 * useThemes Hook
 * Handles fetching and managing themes
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type {
  PresetTheme,
  UserTheme,
  UserThemeCreate,
  UserThemePreferences,
  ThemePreferencesUpdate,
  MarketplaceTheme,
} from '@/types/theme';

const THEMES_KEY = 'themes';
const THEME_PREFERENCES_KEY = 'themePreferences';

/**
 * Hook for fetching preset themes
 */
export function usePresetThemes() {
  const query = useQuery<PresetTheme[]>({
    queryKey: [THEMES_KEY, 'presets'],
    queryFn: async () => {
      return api.get<PresetTheme[]>('/api/v1/themes/presets');
    },
    staleTime: 60 * 60 * 1000, // 1 hour - presets don't change often
  });

  return {
    presets: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * Hook for managing user's theme preferences
 */
export function useThemePreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's preferences
  const preferencesQuery = useQuery<UserThemePreferences>({
    queryKey: [THEME_PREFERENCES_KEY],
    enabled: !!user,
    queryFn: async () => {
      return api.get<UserThemePreferences>('/api/v1/themes/preferences');
    },
    staleTime: 5 * 60 * 1000,
  });

  // Update preferences
  const updateMutation = useMutation({
    mutationFn: async (update: ThemePreferencesUpdate) => {
      return api.put<UserThemePreferences>('/api/v1/themes/preferences', update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [THEME_PREFERENCES_KEY] });
    },
  });

  // Set active preset theme
  const setActivePreset = async (presetId: string) => {
    await updateMutation.mutateAsync({
      active_preset_id: presetId,
      active_custom_theme_id: undefined, // Clear custom theme when switching to preset
    });
  };

  // Set active custom theme
  const setActiveCustomTheme = async (themeId: string) => {
    await updateMutation.mutateAsync({
      active_preset_id: undefined, // Clear preset when switching to custom
      active_custom_theme_id: themeId,
    });
  };

  // Update custom overrides
  const setCustomOverrides = async (overrides: ThemePreferencesUpdate['custom_overrides']) => {
    await updateMutation.mutateAsync({
      custom_overrides: overrides,
    });
  };

  return {
    preferences: preferencesQuery.data,
    isLoading: preferencesQuery.isLoading,
    isSaving: updateMutation.isPending,
    error: preferencesQuery.error,
    setActivePreset,
    setActiveCustomTheme,
    setCustomOverrides,
    updatePreferences: updateMutation.mutateAsync,
  };
}

/**
 * Hook for managing user's custom themes
 */
export function useMyThemes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's themes
  const themesQuery = useQuery<UserTheme[]>({
    queryKey: [THEMES_KEY, 'mine'],
    enabled: !!user,
    queryFn: async () => {
      return api.get<UserTheme[]>('/api/v1/themes/my-themes');
    },
    staleTime: 5 * 60 * 1000,
  });

  // Create a new theme
  const createMutation = useMutation({
    mutationFn: async (theme: UserThemeCreate) => {
      return api.post<UserTheme>('/api/v1/themes/my-themes', theme);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [THEMES_KEY, 'mine'] });
    },
  });

  // Update a theme
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<UserThemeCreate> }) => {
      return api.put<UserTheme>(`/api/v1/themes/my-themes/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [THEMES_KEY, 'mine'] });
    },
  });

  // Delete a theme
  const deleteMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return api.delete<{ message: string }>(`/api/v1/themes/my-themes/${themeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [THEMES_KEY, 'mine'] });
    },
  });

  // Publish a theme
  const publishMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return api.post<{ message: string }>(`/api/v1/themes/my-themes/${themeId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [THEMES_KEY] });
    },
  });

  return {
    themes: themesQuery.data || [],
    isLoading: themesQuery.isLoading,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isPublishing: publishMutation.isPending,
    createTheme: createMutation.mutateAsync,
    updateTheme: updateMutation.mutateAsync,
    deleteTheme: deleteMutation.mutateAsync,
    publishTheme: publishMutation.mutateAsync,
  };
}

/**
 * Hook for browsing the theme marketplace
 */
export function useThemeMarketplace(options?: {
  category?: string;
  tags?: string[];
  featured?: boolean;
  skip?: number;
  limit?: number;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  if (options?.category) queryParams.set('category', options.category);
  if (options?.featured) queryParams.set('featured', 'true');
  if (options?.skip) queryParams.set('skip', String(options.skip));
  if (options?.limit) queryParams.set('limit', String(options.limit));

  // Fetch marketplace themes
  const marketplaceQuery = useQuery<MarketplaceTheme[]>({
    queryKey: [THEMES_KEY, 'marketplace', options],
    queryFn: async () => {
      const params = queryParams.toString();
      const url = params ? `/api/v1/themes/marketplace?${params}` : '/api/v1/themes/marketplace';
      return api.get<MarketplaceTheme[]>(url);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Install a theme
  const installMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return api.post<{ message: string }>(`/api/v1/themes/install/${themeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [THEMES_KEY] });
      queryClient.invalidateQueries({ queryKey: [THEME_PREFERENCES_KEY] });
    },
  });

  // Uninstall a theme
  const uninstallMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return api.delete<{ message: string }>(`/api/v1/themes/install/${themeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [THEMES_KEY] });
      queryClient.invalidateQueries({ queryKey: [THEME_PREFERENCES_KEY] });
    },
  });

  // Like a theme
  const likeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return api.post<{ liked: boolean }>(`/api/v1/themes/like/${themeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [THEMES_KEY, 'marketplace'] });
    },
  });

  return {
    themes: marketplaceQuery.data || [],
    isLoading: marketplaceQuery.isLoading,
    isInstalling: installMutation.isPending,
    isUninstalling: uninstallMutation.isPending,
    isLiking: likeMutation.isPending,
    installTheme: installMutation.mutateAsync,
    uninstallTheme: uninstallMutation.mutateAsync,
    likeTheme: likeMutation.mutateAsync,
    refresh: () => queryClient.invalidateQueries({ queryKey: [THEMES_KEY, 'marketplace'] }),
  };
}
