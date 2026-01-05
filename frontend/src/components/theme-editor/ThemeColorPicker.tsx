/**
 * ThemeColorPicker
 * Color picker with accessibility validation and contrast ratio display
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ThemeColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  contrastWith?: string;
  minContrastRatio?: number;
  className?: string;
}

// Calculate relative luminance for WCAG contrast
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getContrastLevel(ratio: number): {
  level: 'fail' | 'AA-large' | 'AA' | 'AAA';
  label: string;
  color: string;
} {
  if (ratio >= 7) {
    return { level: 'AAA', label: 'AAA', color: 'text-green-400' };
  } else if (ratio >= 4.5) {
    return { level: 'AA', label: 'AA', color: 'text-green-400' };
  } else if (ratio >= 3) {
    return { level: 'AA-large', label: 'AA (large)', color: 'text-yellow-400' };
  } else {
    return { level: 'fail', label: 'Fail', color: 'text-red-400' };
  }
}

export function ThemeColorPicker({
  label,
  value,
  onChange,
  contrastWith,
  minContrastRatio = 4.5,
  className,
}: ThemeColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      // Validate hex format
      if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  const handleColorPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      onChange(newValue);
    },
    [onChange]
  );

  // Update input value when prop changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const contrastRatio = contrastWith ? getContrastRatio(value, contrastWith) : null;
  const contrastLevel = contrastRatio ? getContrastLevel(contrastRatio) : null;
  const meetsMinContrast = contrastRatio ? contrastRatio >= minContrastRatio : true;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-gray">{label}</Label>
        {contrastRatio && contrastLevel && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn('flex items-center gap-1 text-xs', contrastLevel.color)}>
                {meetsMinContrast ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                <span>{contrastRatio.toFixed(2)}:1</span>
                <span className="ml-1 font-medium">{contrastLevel.label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Contrast ratio against background</p>
              <p className="text-muted-gray text-xs">
                WCAG AA requires 4.5:1 for normal text
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex gap-2">
        {/* Color picker */}
        <div
          className="relative w-10 h-10 rounded-md border border-muted-gray/30 overflow-hidden cursor-pointer"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={handleColorPickerChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Hex input */}
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="#000000"
          className={cn(
            'flex-1 font-mono text-sm',
            !meetsMinContrast && 'border-red-400/50 focus-visible:ring-red-400'
          )}
        />
      </div>

      {/* Contrast preview */}
      {contrastWith && (
        <div
          className="p-2 rounded text-sm"
          style={{
            backgroundColor: contrastWith,
            color: value,
          }}
        >
          Sample text preview
        </div>
      )}
    </div>
  );
}
