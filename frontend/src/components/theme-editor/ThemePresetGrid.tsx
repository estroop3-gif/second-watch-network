/**
 * ThemePresetGrid
 * Grid of preset themes to choose from
 */

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { Check, Moon, Sun } from 'lucide-react';
import type { PresetTheme } from '@/types/theme';

interface ThemePresetGridProps {
  onSelect?: (preset: PresetTheme) => void;
  className?: string;
}

export function ThemePresetGrid({ onSelect, className }: ThemePresetGridProps) {
  const { presets, activeTheme, applyPreset, startPreview, endPreview, isLoading } = useTheme();

  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="aspect-[4/3] rounded-lg bg-muted-gray/10 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
      {presets.map((preset) => {
        const isActive = activeTheme.id === preset.id;

        return (
          <button
            key={preset.id}
            onClick={() => {
              if (onSelect) {
                onSelect(preset);
              } else {
                applyPreset(preset.id);
              }
            }}
            onMouseEnter={() => startPreview(preset)}
            onMouseLeave={() => endPreview()}
            className={cn(
              'group relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all duration-200',
              'hover:scale-[1.02] hover:shadow-lg',
              isActive
                ? 'border-accent-yellow ring-2 ring-accent-yellow/30'
                : 'border-muted-gray/30 hover:border-muted-gray'
            )}
          >
            {/* Color preview */}
            <div className="absolute inset-0 flex flex-col">
              {/* Top section - primary background */}
              <div
                className="flex-1"
                style={{ backgroundColor: preset.colors.background }}
              >
                {/* Preview dots */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {preset.preview_colors?.slice(0, 4).map((color, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full border border-white/20"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom section - secondary background */}
              <div
                className="h-8"
                style={{ backgroundColor: preset.colors.backgroundSecondary }}
              />
            </div>

            {/* Theme name and mode indicator */}
            <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-medium"
                  style={{ color: preset.colors.foreground }}
                >
                  {preset.name}
                </span>
                {preset.is_dark ? (
                  <Moon className="h-3.5 w-3.5 text-muted-gray" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-accent-yellow" />
                )}
              </div>
            </div>

            {/* Active indicator */}
            {isActive && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-accent-yellow flex items-center justify-center">
                  <Check className="h-3 w-3 text-charcoal-black" />
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
