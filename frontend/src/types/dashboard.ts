/**
 * Dashboard Customization Types
 * Types for user-customizable dashboard layouts and settings
 */

// ============================================================================
// SECTION CUSTOMIZATION
// ============================================================================

export type SectionSize = 'small' | 'medium' | 'large';

export interface SectionCustomization {
  sectionId: string;
  visible: boolean;
  order: number;
  size: SectionSize;
}

// ============================================================================
// CUSTOM WIDGETS
// ============================================================================

export type WidgetType = 'quick_link' | 'note' | 'countdown';

export interface CustomWidget {
  id: string;
  type: WidgetType;
  label: string;
  href?: string;
  icon?: string;
  order: number;
  // Note-specific
  content?: string;
  // Countdown-specific
  targetDate?: string;
}

export type LayoutMode = 'auto' | 'compact' | 'comfortable' | 'spacious';

// ============================================================================
// USER DASHBOARD SETTINGS
// ============================================================================

export interface UserDashboardSettings {
  user_id: string;
  sections: SectionCustomization[];
  custom_widgets: CustomWidget[];
  quick_actions_order: string[];
  layout_mode: LayoutMode;
  derived_from_role?: string;
  derived_from_template_id?: string;
  updated_at?: string;
}

export interface DashboardSettingsResponse {
  customization: Partial<UserDashboardSettings>;
  isCustomized: boolean;
  effectiveRole?: string;
}

// ============================================================================
// DASHBOARD TEMPLATES
// ============================================================================

export interface DashboardTemplateAuthor {
  full_name: string;
  username: string;
  avatar_url?: string;
}

export interface DashboardTemplate {
  id: string;
  created_by: string;
  name: string;
  description?: string;
  visibility: 'private' | 'public';
  target_roles: string[];
  sections: SectionCustomization[];
  custom_widgets: CustomWidget[];
  layout_mode: LayoutMode;
  use_count: number;
  is_featured: boolean;
  is_approved: boolean;
  created_at: string;
  profiles?: DashboardTemplateAuthor;
}

export interface DashboardTemplateCreate {
  name: string;
  description?: string;
  visibility: 'private' | 'public';
  target_roles?: string[];
  sections: SectionCustomization[];
  custom_widgets?: CustomWidget[];
  layout_mode?: LayoutMode;
}

// ============================================================================
// ROLE DEFAULTS
// ============================================================================

export interface RoleDefaultDashboard {
  role_name: string;
  sections: SectionCustomization[];
  default_widgets: CustomWidget[];
  quick_actions_order: string[];
  layout_mode: LayoutMode;
  updated_by?: string;
  updated_at?: string;
}

// ============================================================================
// EDIT MODE STATE
// ============================================================================

export interface DashboardEditState {
  isEditing: boolean;
  pendingChanges: Partial<UserDashboardSettings>;
  hasUnsavedChanges: boolean;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface DashboardSettingsUpdate {
  sections: SectionCustomization[];
  custom_widgets?: CustomWidget[];
  quick_actions_order?: string[];
  layout_mode?: LayoutMode;
}
