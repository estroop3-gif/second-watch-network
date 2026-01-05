/**
 * DraggableSectionWrapper
 * Wraps a dashboard section to make it draggable and provides edit controls
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDashboardSettings } from '@/context/DashboardSettingsContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  GripVertical,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Square,
} from 'lucide-react';
import type { SectionSize } from '@/types/dashboard';
import type { DashboardSectionConfig } from '@/components/dashboard/config/dashboardConfig';

interface MergedSection extends DashboardSectionConfig {
  customization: {
    sectionId: string;
    visible: boolean;
    order: number;
    size: SectionSize;
  };
}

interface DraggableSectionWrapperProps {
  section: MergedSection;
  isDragging: boolean;
  children: React.ReactNode;
}

const SIZE_ICONS = {
  small: Minimize2,
  medium: Square,
  large: Maximize2,
};

const SIZE_LABELS = {
  small: 'S',
  medium: 'M',
  large: 'L',
};

export function DraggableSectionWrapper({
  section,
  isDragging,
  children,
}: DraggableSectionWrapperProps) {
  const {
    setSectionVisibility,
    setSectionSize,
  } = useDashboardSettings();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentSize = section.customization.size;

  const cycleSize = () => {
    const sizes: SectionSize[] = ['small', 'medium', 'large'];
    const currentIndex = sizes.indexOf(currentSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setSectionSize(section.id, sizes[nextIndex]);
  };

  const toggleVisibility = () => {
    setSectionVisibility(section.id, !section.customization.visible);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border-2 transition-all duration-200',
        isDragging
          ? 'opacity-50 border-accent-yellow'
          : 'border-transparent hover:border-muted-gray/30',
        // Size-based styling
        currentSize === 'small' && 'md:w-1/2 lg:w-1/3',
        currentSize === 'large' && 'md:col-span-2'
      )}
    >
      {/* Edit controls - shown on hover and always visible in edit mode */}
      <div className="absolute -top-10 left-0 right-0 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-charcoal-black/95 rounded-t-lg px-2 py-1 z-10 border border-muted-gray/20">
        {/* Drag handle and title */}
        <div className="flex items-center gap-2">
          <button
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted-gray/20 rounded"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-gray" />
          </button>
          <span className="text-sm font-medium text-bone-white">{section.title}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Size toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={cycleSize}
            className="h-7 px-2 text-xs"
            title={`Size: ${currentSize} (click to cycle)`}
          >
            <span className="text-muted-gray font-mono">{SIZE_LABELS[currentSize]}</span>
          </Button>

          {/* Visibility toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleVisibility}
            className="h-7 w-7 p-0"
            title={section.customization.visible ? 'Hide section' : 'Show section'}
          >
            {section.customization.visible ? (
              <EyeOff className="h-4 w-4 text-muted-gray" />
            ) : (
              <Eye className="h-4 w-4 text-muted-gray" />
            )}
          </Button>
        </div>
      </div>

      {/* Section content */}
      <div className={cn(
        'transition-opacity',
        !section.customization.visible && 'opacity-50'
      )}>
        {children}
      </div>
    </div>
  );
}
