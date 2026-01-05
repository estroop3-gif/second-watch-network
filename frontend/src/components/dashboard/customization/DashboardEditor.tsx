/**
 * DashboardEditor
 * Container component that enables drag-and-drop section reordering in edit mode
 */

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDashboardSettings } from '@/context/DashboardSettingsContext';
import { DraggableSectionWrapper } from './DraggableSectionWrapper';
import { EditModeToolbar } from './EditModeToolbar';
import { SectionTogglePanel } from './SectionTogglePanel';
import { cn } from '@/lib/utils';

interface DashboardEditorProps {
  children: React.ReactNode;
  renderSection: (sectionId: string) => React.ReactNode;
}

export function DashboardEditor({ children, renderSection }: DashboardEditorProps) {
  const {
    isEditing,
    visibleSections,
    hiddenSections,
    setSectionOrder,
    isSaving,
  } = useDashboardSettings();

  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag before activating
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = visibleSections.findIndex((s) => s.id === active.id);
      const newIndex = visibleSections.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Build new order array
        const newOrder = [...visibleSections];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);

        // Update order with section IDs
        setSectionOrder(newOrder.map((s) => s.id));
      }
    }

    setActiveId(null);
  };

  // If not editing, just render children normally
  if (!isEditing) {
    return <>{children}</>;
  }

  // Get the active section for the drag overlay
  const activeSection = visibleSections.find((s) => s.id === activeId);

  return (
    <div className="relative">
      {/* Edit mode indicator */}
      <div className="mb-4 p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg flex items-center gap-2">
        <div className="w-2 h-2 bg-accent-yellow rounded-full animate-pulse" />
        <span className="text-accent-yellow text-sm font-medium">
          Edit Mode - Drag sections to reorder, use controls to resize or hide
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleSections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {visibleSections.map((section) => (
              <DraggableSectionWrapper
                key={section.id}
                section={section}
                isDragging={activeId === section.id}
              >
                {renderSection(section.id)}
              </DraggableSectionWrapper>
            ))}
          </div>
        </SortableContext>

        {/* Drag overlay */}
        <DragOverlay>
          {activeId && activeSection ? (
            <div className="opacity-80 shadow-2xl rounded-lg border-2 border-accent-yellow bg-charcoal-black p-4">
              <div className="font-medium text-bone-white">{activeSection.title}</div>
              <div className="text-sm text-muted-gray">{activeSection.description}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Hidden sections panel */}
      {hiddenSections.length > 0 && (
        <SectionTogglePanel />
      )}

      {/* Floating toolbar */}
      <EditModeToolbar />
    </div>
  );
}
