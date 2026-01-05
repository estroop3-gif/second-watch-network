/**
 * ThemeContext
 * Manages theme state and applies CSS variables
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { usePresetThemes, useThemePreferences, useMyThemes } from '@/hooks/useThemes';
import type {
  PresetTheme,
  UserTheme,
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
  ThemeEffects,
  CSS_VAR_MAP,
} from '@/types/theme';

// ============================================================================
// DEFAULT THEME (SWN Classic Dark)
// ============================================================================

const DEFAULT_THEME: PresetTheme = {
  id: 'swn-classic',
  name: 'SWN Classic',
  is_dark: true,
  colors: {
    background: '#121212',
    backgroundSecondary: '#1a1a1a',
    foreground: '#F9F5EF',
    primary: '#FF3C3C',
    primaryForeground: '#FFFFFF',
    secondary: '#262626',
    secondaryForeground: '#F9F5EF',
    accent: '#FCDC58',
    accentForeground: '#121212',
    muted: '#4C4C4C',
    mutedForeground: '#a1a1a1',
    border: '#333333',
    input: '#333333',
    ring: '#FF3C3C',
    destructive: '#dc2626',
    destructiveForeground: '#FFFFFF',
    success: '#22c55e',
    successForeground: '#FFFFFF',
    warning: '#f59e0b',
    warningForeground: '#121212',
  },
  typography: {
    fontHeading: 'Inter, system-ui, sans-serif',
    fontBody: 'Inter, system-ui, sans-serif',
    fontDisplay: 'Inter, system-ui, sans-serif',
  },
  spacing: {
    borderRadius: 'medium',
    density: 'comfortable',
  },
  effects: {
    enableGrain: false,
    enableAnimations: true,
    enableBlur: true,
  },
  preview_colors: ['#121212', '#FF3C3C', '#FCDC58', '#F9F5EF'],
  is_active: true,
};

// ============================================================================
// TYPES
// ============================================================================

interface ThemeContextType {
  // Active theme
  activeTheme: PresetTheme | UserTheme;
  isDark: boolean;

  // Available themes
  presets: PresetTheme[];
  customThemes: UserTheme[];
  installedThemes: UserTheme[];

  // Loading state
  isLoading: boolean;

  // Preview mode
  isPreviewMode: boolean;
  previewTheme: PresetTheme | UserTheme | null;

  // Actions
  setActiveTheme: (themeId: string, isPreset: boolean) => Promise<void>;
  applyPreset: (presetId: string) => Promise<void>;
  applyCustomTheme: (themeId: string) => Promise<void>;

  // Preview
  startPreview: (theme: PresetTheme | UserTheme) => void;
  endPreview: () => void;
  confirmPreview: () => Promise<void>;

  // Toggle dark/light
  toggleDarkMode: () => void;

  // Apply custom overrides without saving
  previewColors: (colors: Partial<ThemeColors>) => void;
  clearColorPreview: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// ============================================================================
// CSS VARIABLE APPLICATION
// ============================================================================

const CSS_VAR_MAPPING: Record<keyof ThemeColors, string> = {
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

function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyThemeToDocument(theme: PresetTheme | UserTheme, overrides?: Partial<ThemeColors>) {
  const root = document.documentElement;
  const colors = { ...theme.colors, ...overrides };

  // Apply color variables (as HSL for shadcn/ui compatibility)
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAPPING)) {
    const colorKey = key as keyof ThemeColors;
    const value = colors[colorKey];
    if (value) {
      // Apply as HSL values (without hsl() wrapper for shadcn)
      root.style.setProperty(cssVar, hexToHSL(value));
      // Also set raw hex for custom usage
      root.style.setProperty(`${cssVar}-raw`, value);
    }
  }

  // Apply typography
  if (theme.typography) {
    root.style.setProperty('--font-heading', theme.typography.fontHeading);
    root.style.setProperty('--font-body', theme.typography.fontBody);
    root.style.setProperty('--font-display', theme.typography.fontDisplay);
  }

  // Apply spacing
  if (theme.spacing) {
    const radiusValues = {
      none: '0',
      small: '0.25rem',
      medium: '0.5rem',
      large: '1rem',
      full: '9999px',
    };
    root.style.setProperty('--radius', radiusValues[theme.spacing.borderRadius]);

    // Density affects padding/spacing multipliers
    const densityMultipliers = {
      compact: '0.75',
      comfortable: '1',
      spacious: '1.25',
    };
    root.style.setProperty('--density', densityMultipliers[theme.spacing.density]);
  }

  // Apply effects
  if (theme.effects) {
    root.style.setProperty('--enable-grain', theme.effects.enableGrain ? '1' : '0');
    root.style.setProperty('--enable-animations', theme.effects.enableAnimations ? '1' : '0');
    root.style.setProperty('--enable-blur', theme.effects.enableBlur ? '1' : '0');
  }

  // Apply dark/light mode class
  if (theme.is_dark) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

// ============================================================================
// LOCAL STORAGE
// ============================================================================

const THEME_STORAGE_KEY = 'swn-theme';

function loadCachedTheme(): PresetTheme | UserTheme | null {
  try {
    const cached = localStorage.getItem(THEME_STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function cacheTheme(theme: PresetTheme | UserTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// PROVIDER
// ============================================================================

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { presets, isLoading: presetsLoading } = usePresetThemes();
  const { themes: customThemes } = useMyThemes();
  const { preferences, setActivePreset, setActiveCustomTheme } = useThemePreferences();

  // Active theme state
  const [activeTheme, setActiveThemeState] = useState<PresetTheme | UserTheme>(() => {
    // Try to load cached theme for instant application
    const cached = loadCachedTheme();
    if (cached) {
      applyThemeToDocument(cached);
      return cached;
    }
    // Apply default theme
    applyThemeToDocument(DEFAULT_THEME);
    return DEFAULT_THEME;
  });

  // Preview state
  const [previewTheme, setPreviewTheme] = useState<PresetTheme | UserTheme | null>(null);
  const [colorPreview, setColorPreview] = useState<Partial<ThemeColors> | null>(null);

  // Resolve active theme from preferences when they load
  useEffect(() => {
    if (!preferences) return;

    let resolvedTheme: PresetTheme | UserTheme | null = null;

    if (preferences.active_preset_id) {
      resolvedTheme = presets.find((p) => p.id === preferences.active_preset_id) || null;
    } else if (preferences.active_custom_theme_id) {
      resolvedTheme = customThemes.find((t) => t.id === preferences.active_custom_theme_id) || null;
    }

    if (resolvedTheme) {
      setActiveThemeState(resolvedTheme);
      cacheTheme(resolvedTheme);
      applyThemeToDocument(resolvedTheme, preferences.custom_overrides || undefined);
    }
  }, [preferences, presets, customThemes]);

  // Apply theme when active theme changes
  useEffect(() => {
    const themeToApply = previewTheme || activeTheme;
    applyThemeToDocument(themeToApply, colorPreview || undefined);
  }, [activeTheme, previewTheme, colorPreview]);

  // Installed themes (from preferences)
  const installedThemes = useMemo(() => {
    const installedIds = preferences?.installed_theme_ids || [];
    // This would need to be fetched from the marketplace - for now return empty
    return [];
  }, [preferences?.installed_theme_ids]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const applyPreset = useCallback(async (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    await setActivePreset(presetId);
    setActiveThemeState(preset);
    cacheTheme(preset);
    setPreviewTheme(null);
  }, [presets, setActivePreset]);

  const applyCustomTheme = useCallback(async (themeId: string) => {
    const theme = customThemes.find((t) => t.id === themeId);
    if (!theme) return;

    await setActiveCustomTheme(themeId);
    setActiveThemeState(theme);
    cacheTheme(theme);
    setPreviewTheme(null);
  }, [customThemes, setActiveCustomTheme]);

  const setActiveThemeAction = useCallback(async (themeId: string, isPreset: boolean) => {
    if (isPreset) {
      await applyPreset(themeId);
    } else {
      await applyCustomTheme(themeId);
    }
  }, [applyPreset, applyCustomTheme]);

  // Preview
  const startPreview = useCallback((theme: PresetTheme | UserTheme) => {
    setPreviewTheme(theme);
  }, []);

  const endPreview = useCallback(() => {
    setPreviewTheme(null);
    setColorPreview(null);
  }, []);

  const confirmPreview = useCallback(async () => {
    if (!previewTheme) return;

    const isPreset = 'is_active' in previewTheme;
    if (isPreset) {
      await applyPreset(previewTheme.id);
    } else {
      await applyCustomTheme(previewTheme.id);
    }
  }, [previewTheme, applyPreset, applyCustomTheme]);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    const currentTheme = previewTheme || activeTheme;
    const oppositePreset = presets.find((p) => p.is_dark !== currentTheme.is_dark);
    if (oppositePreset) {
      applyPreset(oppositePreset.id);
    }
  }, [previewTheme, activeTheme, presets, applyPreset]);

  // Color preview (for theme editor)
  const previewColors = useCallback((colors: Partial<ThemeColors>) => {
    setColorPreview(colors);
  }, []);

  const clearColorPreview = useCallback(() => {
    setColorPreview(null);
  }, []);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value = useMemo((): ThemeContextType => ({
    activeTheme: previewTheme || activeTheme,
    isDark: (previewTheme || activeTheme).is_dark,
    presets,
    customThemes,
    installedThemes,
    isLoading: presetsLoading,
    isPreviewMode: !!previewTheme,
    previewTheme,
    setActiveTheme: setActiveThemeAction,
    applyPreset,
    applyCustomTheme,
    startPreview,
    endPreview,
    confirmPreview,
    toggleDarkMode,
    previewColors,
    clearColorPreview,
  }), [
    activeTheme,
    previewTheme,
    presets,
    customThemes,
    installedThemes,
    presetsLoading,
    setActiveThemeAction,
    applyPreset,
    applyCustomTheme,
    startPreview,
    endPreview,
    confirmPreview,
    toggleDarkMode,
    previewColors,
    clearColorPreview,
  ]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
