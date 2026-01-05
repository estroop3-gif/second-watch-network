/**
 * useDashboardCustomization Hook
 * Handles fetching and updating user dashboard customization settings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type {
  DashboardSettingsResponse,
  DashboardSettingsUpdate,
  DashboardTemplate,
  DashboardTemplateCreate,
  SectionCustomization,
  CustomWidget,
  LayoutMode,
} from '@/types/dashboard';

const DASHBOARD_SETTINGS_KEY = 'dashboardSettings';
const DASHBOARD_TEMPLATES_KEY = 'dashboardTemplates';

/**
 * Hook for managing user's dashboard customization settings
 */
export function useDashboardCustomization() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's current dashboard settings
  const settingsQuery = useQuery<DashboardSettingsResponse>({
    queryKey: [DASHBOARD_SETTINGS_KEY, 'me'],
    enabled: !!user,
    queryFn: async () => {
      return api.get<DashboardSettingsResponse>('/api/v1/dashboard-settings/me');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update dashboard settings
  const updateMutation = useMutation({
    mutationFn: async (settings: DashboardSettingsUpdate) => {
      return api.put<DashboardSettingsResponse>('/api/v1/dashboard-settings/me', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_SETTINGS_KEY, 'me'] });
    },
  });

  // Reset to role defaults
  const resetMutation = useMutation({
    mutationFn: async () => {
      return api.post<DashboardSettingsResponse>('/api/v1/dashboard-settings/me/reset');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_SETTINGS_KEY, 'me'] });
    },
  });

  // Helper to update a single section
  const updateSection = async (
    sectionId: string,
    updates: Partial<SectionCustomization>
  ) => {
    const currentSettings = settingsQuery.data?.customization;
    if (!currentSettings?.sections) return;

    const updatedSections = currentSettings.sections.map((section) =>
      section.sectionId === sectionId
        ? { ...section, ...updates }
        : section
    );

    await updateMutation.mutateAsync({
      sections: updatedSections,
      custom_widgets: currentSettings.custom_widgets,
      quick_actions_order: currentSettings.quick_actions_order,
      layout_mode: currentSettings.layout_mode,
    });
  };

  // Helper to reorder sections
  const reorderSections = async (sectionIds: string[]) => {
    const currentSettings = settingsQuery.data?.customization;
    if (!currentSettings?.sections) return;

    const sectionMap = new Map(
      currentSettings.sections.map((s) => [s.sectionId, s])
    );

    const updatedSections = sectionIds.map((id, index) => ({
      ...(sectionMap.get(id) || { sectionId: id, visible: true, size: 'medium' as const }),
      order: index,
    }));

    await updateMutation.mutateAsync({
      sections: updatedSections,
      custom_widgets: currentSettings.custom_widgets,
      quick_actions_order: currentSettings.quick_actions_order,
      layout_mode: currentSettings.layout_mode,
    });
  };

  // Helper to toggle section visibility
  const toggleSectionVisibility = async (sectionId: string) => {
    const currentSettings = settingsQuery.data?.customization;
    if (!currentSettings?.sections) return;

    const section = currentSettings.sections.find((s) => s.sectionId === sectionId);
    if (section) {
      await updateSection(sectionId, { visible: !section.visible });
    }
  };

  // Helper to add custom widget
  const addCustomWidget = async (widget: Omit<CustomWidget, 'id' | 'order'>) => {
    const currentSettings = settingsQuery.data?.customization;
    const currentWidgets = currentSettings?.custom_widgets || [];

    const newWidget: CustomWidget = {
      ...widget,
      id: crypto.randomUUID(),
      order: currentWidgets.length,
    };

    await updateMutation.mutateAsync({
      sections: currentSettings?.sections || [],
      custom_widgets: [...currentWidgets, newWidget],
      quick_actions_order: currentSettings?.quick_actions_order,
      layout_mode: currentSettings?.layout_mode,
    });
  };

  // Helper to remove custom widget
  const removeCustomWidget = async (widgetId: string) => {
    const currentSettings = settingsQuery.data?.customization;
    const currentWidgets = currentSettings?.custom_widgets || [];

    await updateMutation.mutateAsync({
      sections: currentSettings?.sections || [],
      custom_widgets: currentWidgets.filter((w) => w.id !== widgetId),
      quick_actions_order: currentSettings?.quick_actions_order,
      layout_mode: currentSettings?.layout_mode,
    });
  };

  // Helper to update layout mode
  const setLayoutMode = async (mode: LayoutMode) => {
    const currentSettings = settingsQuery.data?.customization;

    await updateMutation.mutateAsync({
      sections: currentSettings?.sections || [],
      custom_widgets: currentSettings?.custom_widgets,
      quick_actions_order: currentSettings?.quick_actions_order,
      layout_mode: mode,
    });
  };

  return {
    // Data
    settings: settingsQuery.data?.customization,
    isCustomized: settingsQuery.data?.isCustomized ?? false,
    effectiveRole: settingsQuery.data?.effectiveRole,

    // Loading states
    isLoading: settingsQuery.isLoading,
    isSaving: updateMutation.isPending,
    isResetting: resetMutation.isPending,

    // Error states
    error: settingsQuery.error,
    saveError: updateMutation.error,

    // Actions
    updateSettings: updateMutation.mutateAsync,
    resetToDefaults: resetMutation.mutateAsync,
    updateSection,
    reorderSections,
    toggleSectionVisibility,
    addCustomWidget,
    removeCustomWidget,
    setLayoutMode,

    // Refresh
    refresh: () => queryClient.invalidateQueries({ queryKey: [DASHBOARD_SETTINGS_KEY, 'me'] }),
  };
}

/**
 * Hook for browsing and managing dashboard templates
 */
export function useDashboardTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch public templates
  const publicTemplatesQuery = useQuery<DashboardTemplate[]>({
    queryKey: [DASHBOARD_TEMPLATES_KEY, 'public'],
    queryFn: async () => {
      return api.get<DashboardTemplate[]>('/api/v1/dashboard-settings/templates');
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's own templates
  const myTemplatesQuery = useQuery<DashboardTemplate[]>({
    queryKey: [DASHBOARD_TEMPLATES_KEY, 'mine'],
    enabled: !!user,
    queryFn: async () => {
      return api.get<DashboardTemplate[]>('/api/v1/dashboard-settings/templates/mine');
    },
    staleTime: 5 * 60 * 1000,
  });

  // Create a new template
  const createMutation = useMutation({
    mutationFn: async (template: DashboardTemplateCreate) => {
      return api.post<DashboardTemplate>('/api/v1/dashboard-settings/templates', template);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_TEMPLATES_KEY] });
    },
  });

  // Apply a template
  const applyMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return api.post<{ message: string }>(`/api/v1/dashboard-settings/templates/${templateId}/apply`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_SETTINGS_KEY, 'me'] });
    },
  });

  // Delete a template
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return api.delete<{ message: string }>(`/api/v1/dashboard-settings/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_TEMPLATES_KEY] });
    },
  });

  return {
    // Data
    publicTemplates: publicTemplatesQuery.data || [],
    myTemplates: myTemplatesQuery.data || [],

    // Loading states
    isLoadingPublic: publicTemplatesQuery.isLoading,
    isLoadingMine: myTemplatesQuery.isLoading,
    isCreating: createMutation.isPending,
    isApplying: applyMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Actions
    createTemplate: createMutation.mutateAsync,
    applyTemplate: applyMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,

    // Get single template
    getTemplate: async (templateId: string) => {
      return api.get<DashboardTemplate>(`/api/v1/dashboard-settings/templates/${templateId}`);
    },
  };
}
