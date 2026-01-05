/**
 * ThemeEditor
 * Full theme editor with live preview
 */

import React, { useState, useCallback } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useMyThemes } from '@/hooks/useThemes';
import { ThemePresetGrid } from './ThemePresetGrid';
import { ThemeColorPicker } from './ThemeColorPicker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Palette,
  Type,
  Sliders,
  Sparkles,
  Save,
  RotateCcw,
  Copy,
  Share2,
  Loader2,
} from 'lucide-react';
import type { ThemeColors, ThemeTypography, ThemeSpacing, ThemeEffects, UserThemeCreate } from '@/types/theme';

interface ThemeEditorProps {
  className?: string;
}

const DEFAULT_COLORS: ThemeColors = {
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
};

const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontHeading: 'Inter, system-ui, sans-serif',
  fontBody: 'Inter, system-ui, sans-serif',
  fontDisplay: 'Inter, system-ui, sans-serif',
};

const DEFAULT_SPACING: ThemeSpacing = {
  borderRadius: 'medium',
  density: 'comfortable',
};

const DEFAULT_EFFECTS: ThemeEffects = {
  enableGrain: false,
  enableAnimations: true,
  enableBlur: true,
};

export function ThemeEditor({ className }: ThemeEditorProps) {
  const { activeTheme, previewColors, clearColorPreview, applyPreset } = useTheme();
  const { createTheme, isCreating } = useMyThemes();

  const [themeName, setThemeName] = useState('My Custom Theme');
  const [isDark, setIsDark] = useState(true);
  const [colors, setColors] = useState<ThemeColors>(() => ({
    ...DEFAULT_COLORS,
    ...activeTheme.colors,
  }));
  const [typography, setTypography] = useState<ThemeTypography>(() => ({
    ...DEFAULT_TYPOGRAPHY,
    ...activeTheme.typography,
  }));
  const [spacing, setSpacing] = useState<ThemeSpacing>(() => ({
    ...DEFAULT_SPACING,
    ...activeTheme.spacing,
  }));
  const [effects, setEffects] = useState<ThemeEffects>(() => ({
    ...DEFAULT_EFFECTS,
    ...activeTheme.effects,
  }));

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update color and preview
  const updateColor = useCallback((key: keyof ThemeColors, value: string) => {
    setColors((prev) => {
      const updated = { ...prev, [key]: value };
      previewColors(updated);
      setHasChanges(true);
      return updated;
    });
  }, [previewColors]);

  // Reset to active theme
  const handleReset = useCallback(() => {
    setColors({ ...DEFAULT_COLORS, ...activeTheme.colors });
    setTypography({ ...DEFAULT_TYPOGRAPHY, ...activeTheme.typography });
    setSpacing({ ...DEFAULT_SPACING, ...activeTheme.spacing });
    setEffects({ ...DEFAULT_EFFECTS, ...activeTheme.effects });
    clearColorPreview();
    setHasChanges(false);
  }, [activeTheme, clearColorPreview]);

  // Copy from preset
  const handleCopyFromPreset = useCallback((preset: any) => {
    setColors({ ...DEFAULT_COLORS, ...preset.colors });
    setTypography({ ...DEFAULT_TYPOGRAPHY, ...preset.typography });
    setSpacing({ ...DEFAULT_SPACING, ...preset.spacing });
    setEffects({ ...DEFAULT_EFFECTS, ...preset.effects });
    setIsDark(preset.is_dark);
    previewColors(preset.colors);
    setHasChanges(true);
  }, [previewColors]);

  // Save theme
  const handleSave = useCallback(async () => {
    const themeData: UserThemeCreate = {
      name: themeName,
      is_dark: isDark,
      colors,
      typography,
      spacing,
      effects,
      preview_colors: [colors.background, colors.primary, colors.accent, colors.foreground],
      is_public: false,
    };

    try {
      await createTheme(themeData);
      setShowSaveDialog(false);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }, [themeName, isDark, colors, typography, spacing, effects, createTheme]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading">Theme Editor</h2>
          <p className="text-muted-gray text-sm">
            Customize your dashboard appearance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            disabled={!hasChanges}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Save className="h-4 w-4 mr-1.5" />
            Save Theme
          </Button>
        </div>
      </div>

      {/* Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Start from a Preset
          </CardTitle>
          <CardDescription>
            Choose a preset theme as your starting point
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePresetGrid onSelect={handleCopyFromPreset} />
        </CardContent>
      </Card>

      {/* Editor Tabs */}
      <Tabs defaultValue="colors" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="colors" className="gap-1.5">
            <Palette className="h-4 w-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography" className="gap-1.5">
            <Type className="h-4 w-4" />
            Type
          </TabsTrigger>
          <TabsTrigger value="spacing" className="gap-1.5">
            <Sliders className="h-4 w-4" />
            Spacing
          </TabsTrigger>
          <TabsTrigger value="effects" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Effects
          </TabsTrigger>
        </TabsList>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Background Colors</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ThemeColorPicker
                label="Background"
                value={colors.background}
                onChange={(v) => updateColor('background', v)}
              />
              <ThemeColorPicker
                label="Secondary Background"
                value={colors.backgroundSecondary}
                onChange={(v) => updateColor('backgroundSecondary', v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Brand Colors</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ThemeColorPicker
                label="Primary"
                value={colors.primary}
                onChange={(v) => updateColor('primary', v)}
                contrastWith={colors.background}
              />
              <ThemeColorPicker
                label="Accent"
                value={colors.accent}
                onChange={(v) => updateColor('accent', v)}
                contrastWith={colors.background}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Text Colors</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ThemeColorPicker
                label="Foreground"
                value={colors.foreground}
                onChange={(v) => updateColor('foreground', v)}
                contrastWith={colors.background}
              />
              <ThemeColorPicker
                label="Muted"
                value={colors.muted}
                onChange={(v) => updateColor('muted', v)}
                contrastWith={colors.background}
                minContrastRatio={3}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">UI Colors</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ThemeColorPicker
                label="Border"
                value={colors.border}
                onChange={(v) => updateColor('border', v)}
              />
              <ThemeColorPicker
                label="Success"
                value={colors.success}
                onChange={(v) => updateColor('success', v)}
                contrastWith={colors.background}
              />
              <ThemeColorPicker
                label="Destructive"
                value={colors.destructive}
                onChange={(v) => updateColor('destructive', v)}
                contrastWith={colors.background}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Font Families</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Heading Font</Label>
                <Select
                  value={typography.fontHeading}
                  onValueChange={(v) => setTypography((prev) => ({ ...prev, fontHeading: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter, system-ui, sans-serif">Inter</SelectItem>
                    <SelectItem value="Space Grotesk, system-ui, sans-serif">Space Grotesk</SelectItem>
                    <SelectItem value="IBM Plex Sans, system-ui, sans-serif">IBM Plex Sans</SelectItem>
                    <SelectItem value="system-ui, sans-serif">System UI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Body Font</Label>
                <Select
                  value={typography.fontBody}
                  onValueChange={(v) => setTypography((prev) => ({ ...prev, fontBody: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter, system-ui, sans-serif">Inter</SelectItem>
                    <SelectItem value="IBM Plex Sans, system-ui, sans-serif">IBM Plex Sans</SelectItem>
                    <SelectItem value="system-ui, sans-serif">System UI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spacing Tab */}
        <TabsContent value="spacing">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Layout Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Border Radius</Label>
                <Select
                  value={spacing.borderRadius}
                  onValueChange={(v: any) => setSpacing((prev) => ({ ...prev, borderRadius: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Sharp)</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="full">Full (Pill)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Density</Label>
                <Select
                  value={spacing.density}
                  onValueChange={(v: any) => setSpacing((prev) => ({ ...prev, density: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="spacious">Spacious</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Effects Tab */}
        <TabsContent value="effects">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Visual Effects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Animations</Label>
                  <p className="text-sm text-muted-gray">
                    Smooth transitions and motion effects
                  </p>
                </div>
                <Switch
                  checked={effects.enableAnimations}
                  onCheckedChange={(v) => setEffects((prev) => ({ ...prev, enableAnimations: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Blur Effects</Label>
                  <p className="text-sm text-muted-gray">
                    Frosted glass effect on overlays
                  </p>
                </div>
                <Switch
                  checked={effects.enableBlur}
                  onCheckedChange={(v) => setEffects((prev) => ({ ...prev, enableBlur: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Film Grain Overlay</Label>
                  <p className="text-sm text-muted-gray">
                    Subtle film grain texture
                  </p>
                </div>
                <Switch
                  checked={effects.enableGrain}
                  onCheckedChange={(v) => setEffects((prev) => ({ ...prev, enableGrain: v }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Custom Theme</AlertDialogTitle>
            <AlertDialogDescription>
              Give your theme a name to save it to your collection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="theme-name">Theme Name</Label>
            <Input
              id="theme-name"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="My Custom Theme"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSave}
              disabled={isCreating || !themeName.trim()}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {isCreating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save Theme
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
