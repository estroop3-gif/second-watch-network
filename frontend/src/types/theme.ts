/**
 * Theme System Types
 * Types for user-customizable themes and the theme marketplace
 */

// ============================================================================
// THEME COLORS
// ============================================================================

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
}

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export interface ThemeTypography {
  fontHeading: string;
  fontBody: string;
  fontDisplay: string;
}

// ============================================================================
// SPACING & EFFECTS
// ============================================================================

export interface ThemeSpacing {
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
  density: 'compact' | 'comfortable' | 'spacious';
}

export interface ThemeEffects {
  enableGrain: boolean;
  enableAnimations: boolean;
  enableBlur: boolean;
}

// ============================================================================
// PRESET THEME
// ============================================================================

export interface PresetTheme {
  id: string;
  name: string;
  is_dark: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  effects: ThemeEffects;
  preview_colors: string[];
  is_active: boolean;
}

// ============================================================================
// USER THEME
// ============================================================================

export interface UserTheme {
  id: string;
  user_id: string;
  name: string;
  is_dark: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  effects: ThemeEffects;
  preview_colors: string[];
  is_public: boolean;
  is_approved: boolean;
  is_featured: boolean;
  like_count: number;
  install_count: number;
  tags: string[];
  created_at: string;
  updated_at?: string;
}

export interface UserThemeCreate {
  name: string;
  is_dark: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  effects: ThemeEffects;
  preview_colors?: string[];
  is_public?: boolean;
  tags?: string[];
}

// ============================================================================
// USER THEME PREFERENCES
// ============================================================================

export interface UserThemePreferences {
  user_id: string;
  active_preset_id?: string;
  active_custom_theme_id?: string;
  installed_theme_ids: string[];
  custom_overrides?: Partial<ThemeColors>;
  updated_at?: string;
}

export interface ThemePreferencesUpdate {
  active_preset_id?: string;
  active_custom_theme_id?: string;
  custom_overrides?: Partial<ThemeColors>;
}

// ============================================================================
// MARKETPLACE
// ============================================================================

export interface ThemeAuthor {
  full_name: string;
  username: string;
  avatar_url?: string;
}

export interface MarketplaceTheme extends UserTheme {
  profiles?: ThemeAuthor;
  is_installed?: boolean;
  is_liked?: boolean;
}

// ============================================================================
// THEME CONTEXT STATE
// ============================================================================

export interface ThemeState {
  activeTheme: PresetTheme | UserTheme | null;
  presets: PresetTheme[];
  customThemes: UserTheme[];
  installedThemes: UserTheme[];
  isLoading: boolean;
  isDark: boolean;
}

// ============================================================================
// THEME EDITOR STATE
// ============================================================================

export interface ThemeEditorState {
  isEditing: boolean;
  draftTheme: Partial<UserThemeCreate>;
  previewMode: boolean;
  originalTheme?: PresetTheme | UserTheme;
}

// ============================================================================
// CSS VARIABLE MAPPING
// ============================================================================

export const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  background: '--background',
  backgroundSecondary: '--background-secondary',
  foreground: '--foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  success: '--success',
  successForeground: '--success-foreground',
  warning: '--warning',
  warningForeground: '--warning-foreground',
};
