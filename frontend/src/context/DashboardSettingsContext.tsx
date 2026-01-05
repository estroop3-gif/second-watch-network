/**
 * DashboardSettingsContext
 * Manages dashboard customization state and edit mode
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useDashboardCustomization } from '@/hooks/useDashboardCustomization';
import { useDashboardConfig, type DashboardConfigResult } from '@/hooks/useDashboardConfig';
import type {
  SectionCustomization,
  CustomWidget,
  LayoutMode,
  DashboardSettingsUpdate,
  DashboardEditState,
} from '@/types/dashboard';
import type { DashboardSectionConfig } from '@/components/dashboard/config/dashboardConfig';

// ============================================================================
// TYPES
// ============================================================================

interface MergedSection extends DashboardSectionConfig {
  customization: SectionCustomization;
}

interface DashboardSettingsContextType {
  // Merged sections (config + customization)
  sections: MergedSection[];
  visibleSections: MergedSection[];
  hiddenSections: MergedSection[];

  // Custom widgets
  customWidgets: CustomWidget[];

  // Layout
  layoutMode: LayoutMode;

  // Edit mode state
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  pendingChanges: Partial<DashboardSettingsUpdate>;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // User's effective role
  effectiveRole: string;
  isCustomized: boolean;

  // Role-based permissions from useDashboardConfig
  roleFlags: Pick<DashboardConfigResult, 'isSuperadmin' | 'isAdmin' | 'isStaff' | 'isFilmmaker' | 'isPartner' | 'isOrderMember' | 'isPremium'>;

  // Edit mode actions
  enterEditMode: () => void;
  exitEditMode: () => void;
  saveChanges: () => Promise<void>;
  discardChanges: () => void;

  // Section editing (works on pending changes in edit mode)
  setSectionOrder: (sectionIds: string[]) => void;
  setSectionVisibility: (sectionId: string, visible: boolean) => void;
  setSectionSize: (sectionId: string, size: SectionCustomization['size']) => void;

  // Widget editing
  addWidget: (widget: Omit<CustomWidget, 'id' | 'order'>) => void;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: Partial<CustomWidget>) => void;

  // Layout editing
  setLayoutMode: (mode: LayoutMode) => void;

  // Reset
  resetToDefaults: () => Promise<void>;
}

const DashboardSettingsContext = createContext<DashboardSettingsContextType | null>(null);

export function useDashboardSettings() {
  const context = useContext(DashboardSettingsContext);
  if (!context) {
    throw new Error('useDashboardSettings must be used within DashboardSettingsProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

export function DashboardSettingsProvider({ children }: { children: React.ReactNode }) {
  // Get role-based config (default sections for user's role)
  const dashboardConfig = useDashboardConfig();

  // Get user's customization from API
  const customization = useDashboardCustomization();

  // Edit mode state
  const [editState, setEditState] = useState<DashboardEditState>({
    isEditing: false,
    pendingChanges: {},
    hasUnsavedChanges: false,
  });

  // Build default customizations from dashboard config
  const defaultCustomizations = useMemo(() => {
    return dashboardConfig.sections.map((section, index): SectionCustomization => ({
      sectionId: section.id,
      visible: true,
      order: index,
      size: 'medium',
    }));
  }, [dashboardConfig.sections]);

  // Merge user customizations with default config
  const mergedSections = useMemo((): MergedSection[] => {
    const userSections = editState.isEditing
      ? editState.pendingChanges.sections || customization.settings?.sections
      : customization.settings?.sections;

    // Create a map of user customizations by section ID
    const customizationMap = new Map(
      (userSections || []).map((s) => [s.sectionId, s])
    );

    // Merge with default config
    const merged = dashboardConfig.sections.map((config, defaultIndex): MergedSection => {
      const userCustomization = customizationMap.get(config.id);

      return {
        ...config,
        customization: userCustomization || {
          sectionId: config.id,
          visible: true,
          order: userCustomization?.order ?? defaultIndex,
          size: 'medium' as const,
        },
      };
    });

    // Sort by order
    return merged.sort((a, b) => a.customization.order - b.customization.order);
  }, [dashboardConfig.sections, customization.settings?.sections, editState.isEditing, editState.pendingChanges.sections]);

  // Split into visible and hidden sections
  const visibleSections = useMemo(
    () => mergedSections.filter((s) => s.customization.visible),
    [mergedSections]
  );

  const hiddenSections = useMemo(
    () => mergedSections.filter((s) => !s.customization.visible),
    [mergedSections]
  );

  // Custom widgets (from pending changes or saved settings)
  const customWidgets = useMemo(() => {
    if (editState.isEditing && editState.pendingChanges.custom_widgets) {
      return editState.pendingChanges.custom_widgets;
    }
    return customization.settings?.custom_widgets || [];
  }, [editState.isEditing, editState.pendingChanges.custom_widgets, customization.settings?.custom_widgets]);

  // Layout mode
  const layoutMode = useMemo((): LayoutMode => {
    if (editState.isEditing && editState.pendingChanges.layout_mode) {
      return editState.pendingChanges.layout_mode;
    }
    return customization.settings?.layout_mode || 'auto';
  }, [editState.isEditing, editState.pendingChanges.layout_mode, customization.settings?.layout_mode]);

  // ============================================================================
  // EDIT MODE ACTIONS
  // ============================================================================

  const enterEditMode = useCallback(() => {
    // Initialize pending changes with current settings
    setEditState({
      isEditing: true,
      pendingChanges: {
        sections: customization.settings?.sections || defaultCustomizations,
        custom_widgets: customization.settings?.custom_widgets || [],
        quick_actions_order: customization.settings?.quick_actions_order || [],
        layout_mode: customization.settings?.layout_mode || 'auto',
      },
      hasUnsavedChanges: false,
    });
  }, [customization.settings, defaultCustomizations]);

  const exitEditMode = useCallback(() => {
    setEditState({
      isEditing: false,
      pendingChanges: {},
      hasUnsavedChanges: false,
    });
  }, []);

  const saveChanges = useCallback(async () => {
    if (!editState.hasUnsavedChanges) return;

    const update: DashboardSettingsUpdate = {
      sections: editState.pendingChanges.sections || [],
      custom_widgets: editState.pendingChanges.custom_widgets,
      quick_actions_order: editState.pendingChanges.quick_actions_order,
      layout_mode: editState.pendingChanges.layout_mode,
    };

    await customization.updateSettings(update);
    exitEditMode();
  }, [editState, customization, exitEditMode]);

  const discardChanges = useCallback(() => {
    exitEditMode();
  }, [exitEditMode]);

  // ============================================================================
  // SECTION EDITING
  // ============================================================================

  const setSectionOrder = useCallback((sectionIds: string[]) => {
    setEditState((prev) => {
      const currentSections = prev.pendingChanges.sections || [];
      const sectionMap = new Map(currentSections.map((s) => [s.sectionId, s]));

      const updatedSections = sectionIds.map((id, index) => ({
        ...(sectionMap.get(id) || { sectionId: id, visible: true, size: 'medium' as const }),
        order: index,
      }));

      return {
        ...prev,
        pendingChanges: {
          ...prev.pendingChanges,
          sections: updatedSections,
        },
        hasUnsavedChanges: true,
      };
    });
  }, []);

  const setSectionVisibility = useCallback((sectionId: string, visible: boolean) => {
    setEditState((prev) => {
      const currentSections = prev.pendingChanges.sections || [];

      const updatedSections = currentSections.map((s) =>
        s.sectionId === sectionId ? { ...s, visible } : s
      );

      return {
        ...prev,
        pendingChanges: {
          ...prev.pendingChanges,
          sections: updatedSections,
        },
        hasUnsavedChanges: true,
      };
    });
  }, []);

  const setSectionSize = useCallback((sectionId: string, size: SectionCustomization['size']) => {
    setEditState((prev) => {
      const currentSections = prev.pendingChanges.sections || [];

      const updatedSections = currentSections.map((s) =>
        s.sectionId === sectionId ? { ...s, size } : s
      );

      return {
        ...prev,
        pendingChanges: {
          ...prev.pendingChanges,
          sections: updatedSections,
        },
        hasUnsavedChanges: true,
      };
    });
  }, []);

  // ============================================================================
  // WIDGET EDITING
  // ============================================================================

  const addWidget = useCallback((widget: Omit<CustomWidget, 'id' | 'order'>) => {
    setEditState((prev) => {
      const currentWidgets = prev.pendingChanges.custom_widgets || [];

      const newWidget: CustomWidget = {
        ...widget,
        id: crypto.randomUUID(),
        order: currentWidgets.length,
      };

      return {
        ...prev,
        pendingChanges: {
          ...prev.pendingChanges,
          custom_widgets: [...currentWidgets, newWidget],
        },
        hasUnsavedChanges: true,
      };
    });
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    setEditState((prev) => {
      const currentWidgets = prev.pendingChanges.custom_widgets || [];

      return {
        ...prev,
        pendingChanges: {
          ...prev.pendingChanges,
          custom_widgets: currentWidgets.filter((w) => w.id !== widgetId),
        },
        hasUnsavedChanges: true,
      };
    });
  }, []);

  const updateWidget = useCallback((widgetId: string, updates: Partial<CustomWidget>) => {
    setEditState((prev) => {
      const currentWidgets = prev.pendingChanges.custom_widgets || [];

      return {
        ...prev,
        pendingChanges: {
          ...prev.pendingChanges,
          custom_widgets: currentWidgets.map((w) =>
            w.id === widgetId ? { ...w, ...updates } : w
          ),
        },
        hasUnsavedChanges: true,
      };
    });
  }, []);

  // ============================================================================
  // LAYOUT MODE
  // ============================================================================

  const setLayoutModeAction = useCallback((mode: LayoutMode) => {
    setEditState((prev) => ({
      ...prev,
      pendingChanges: {
        ...prev.pendingChanges,
        layout_mode: mode,
      },
      hasUnsavedChanges: true,
    }));
  }, []);

  // ============================================================================
  // RESET
  // ============================================================================

  const resetToDefaults = useCallback(async () => {
    await customization.resetToDefaults();
    exitEditMode();
  }, [customization, exitEditMode]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value = useMemo((): DashboardSettingsContextType => ({
    // Sections
    sections: mergedSections,
    visibleSections,
    hiddenSections,

    // Widgets
    customWidgets,

    // Layout
    layoutMode,

    // Edit state
    isEditing: editState.isEditing,
    hasUnsavedChanges: editState.hasUnsavedChanges,
    pendingChanges: editState.pendingChanges,

    // Loading
    isLoading: dashboardConfig.isLoading || customization.isLoading,
    isSaving: customization.isSaving,

    // Role info
    effectiveRole: customization.effectiveRole || dashboardConfig.effectiveRole,
    isCustomized: customization.isCustomized,

    // Role flags
    roleFlags: {
      isSuperadmin: dashboardConfig.isSuperadmin,
      isAdmin: dashboardConfig.isAdmin,
      isStaff: dashboardConfig.isStaff,
      isFilmmaker: dashboardConfig.isFilmmaker,
      isPartner: dashboardConfig.isPartner,
      isOrderMember: dashboardConfig.isOrderMember,
      isPremium: dashboardConfig.isPremium,
    },

    // Actions
    enterEditMode,
    exitEditMode,
    saveChanges,
    discardChanges,
    setSectionOrder,
    setSectionVisibility,
    setSectionSize,
    addWidget,
    removeWidget,
    updateWidget,
    setLayoutMode: setLayoutModeAction,
    resetToDefaults,
  }), [
    mergedSections,
    visibleSections,
    hiddenSections,
    customWidgets,
    layoutMode,
    editState,
    dashboardConfig,
    customization,
    enterEditMode,
    exitEditMode,
    saveChanges,
    discardChanges,
    setSectionOrder,
    setSectionVisibility,
    setSectionSize,
    addWidget,
    removeWidget,
    updateWidget,
    setLayoutModeAction,
    resetToDefaults,
  ]);

  return (
    <DashboardSettingsContext.Provider value={value}>
      {children}
    </DashboardSettingsContext.Provider>
  );
}
