/**
 * Segment Presets Library
 *
 * System presets for non-scripted content production (documentaries, reality TV, corporate).
 * Categories: Interview, B-roll, Technical, Talent, Presentation, Performance, Location
 */

import {
  NonScriptedSegmentPreset,
  NonScriptedSegmentCategory,
} from '@/types/backlot';

// ============================================================================
// CATEGORY METADATA
// ============================================================================

export interface SegmentCategoryMeta {
  id: NonScriptedSegmentCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const SEGMENT_CATEGORIES: SegmentCategoryMeta[] = [
  {
    id: 'interview',
    name: 'Interview',
    description: 'Sit-down interviews, talking heads, panel discussions',
    icon: 'MessageSquare',
    color: 'blue',
  },
  {
    id: 'broll',
    name: 'B-Roll',
    description: 'Supplementary footage, establishing shots, cutaways',
    icon: 'Video',
    color: 'green',
  },
  {
    id: 'technical',
    name: 'Technical',
    description: 'Setup, lighting, camera repositioning, sound checks',
    icon: 'Wrench',
    color: 'yellow',
  },
  {
    id: 'talent',
    name: 'Talent',
    description: 'Hair & makeup, wardrobe, subject briefing',
    icon: 'User',
    color: 'pink',
  },
  {
    id: 'presentation',
    name: 'Presentation',
    description: 'Product demos, keynotes, tutorials',
    icon: 'Presentation',
    color: 'orange',
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Musical performances, dance, stunts, action sequences',
    icon: 'Music',
    color: 'red',
  },
  {
    id: 'location',
    name: 'Location',
    description: 'Location-specific shoots, travel, site preparation',
    icon: 'MapPin',
    color: 'purple',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'User-defined segment type',
    icon: 'Layers',
    color: 'gray',
  },
];

export function getCategoryMeta(category: NonScriptedSegmentCategory): SegmentCategoryMeta {
  return SEGMENT_CATEGORIES.find(c => c.id === category) || SEGMENT_CATEGORIES[SEGMENT_CATEGORIES.length - 1];
}

// ============================================================================
// SYSTEM PRESETS
// ============================================================================

export const SYSTEM_SEGMENT_PRESETS: NonScriptedSegmentPreset[] = [
  // Interview Presets
  {
    id: 'interview-standard',
    category: 'interview',
    name: 'Standard Interview',
    description: 'Single subject interview with standard lighting setup',
    duration_min_minutes: 20,
    duration_max_minutes: 45,
    duration_default_minutes: 30,
    icon: 'MessageSquare',
    color: 'blue',
    is_system_preset: true,
  },
  {
    id: 'interview-expert',
    category: 'interview',
    name: 'Expert Interview',
    description: 'In-depth expert or SME interview',
    duration_min_minutes: 30,
    duration_max_minutes: 60,
    duration_default_minutes: 45,
    icon: 'MessageSquare',
    color: 'blue',
    is_system_preset: true,
  },
  {
    id: 'interview-voxpop',
    category: 'interview',
    name: 'Vox Pop / Street',
    description: 'Quick street interviews or person-on-the-street',
    duration_min_minutes: 10,
    duration_max_minutes: 20,
    duration_default_minutes: 15,
    icon: 'MessageSquare',
    color: 'blue',
    is_system_preset: true,
  },
  {
    id: 'interview-panel',
    category: 'interview',
    name: 'Panel Discussion',
    description: 'Multi-person panel or roundtable discussion',
    duration_min_minutes: 30,
    duration_max_minutes: 60,
    duration_default_minutes: 45,
    icon: 'MessageSquare',
    color: 'blue',
    is_system_preset: true,
  },

  // B-Roll Presets
  {
    id: 'broll-establishing',
    category: 'broll',
    name: 'Establishing Shots',
    description: 'Exterior/interior establishing shots of location',
    duration_min_minutes: 15,
    duration_max_minutes: 45,
    duration_default_minutes: 30,
    icon: 'Video',
    color: 'green',
    is_system_preset: true,
  },
  {
    id: 'broll-activity',
    category: 'broll',
    name: 'Activity Coverage',
    description: 'Coverage of activities, processes, or events',
    duration_min_minutes: 30,
    duration_max_minutes: 90,
    duration_default_minutes: 60,
    icon: 'Video',
    color: 'green',
    is_system_preset: true,
  },
  {
    id: 'broll-detail',
    category: 'broll',
    name: 'Detail Shots',
    description: 'Close-up detail shots and insert coverage',
    duration_min_minutes: 15,
    duration_max_minutes: 30,
    duration_default_minutes: 20,
    icon: 'Video',
    color: 'green',
    is_system_preset: true,
  },
  {
    id: 'broll-timelapse',
    category: 'broll',
    name: 'Timelapse',
    description: 'Extended timelapse or hyperlapse capture',
    duration_min_minutes: 60,
    duration_max_minutes: 240,
    duration_default_minutes: 120,
    icon: 'Video',
    color: 'green',
    is_system_preset: true,
  },

  // Technical Presets
  {
    id: 'technical-lighting',
    category: 'technical',
    name: 'Lighting Setup',
    description: 'Lighting setup and adjustment',
    duration_min_minutes: 15,
    duration_max_minutes: 45,
    duration_default_minutes: 30,
    icon: 'Wrench',
    color: 'yellow',
    is_system_preset: true,
  },
  {
    id: 'technical-camera',
    category: 'technical',
    name: 'Camera Reposition',
    description: 'Camera setup changes and repositioning',
    duration_min_minutes: 10,
    duration_max_minutes: 30,
    duration_default_minutes: 20,
    icon: 'Wrench',
    color: 'yellow',
    is_system_preset: true,
  },
  {
    id: 'technical-drone',
    category: 'technical',
    name: 'Drone Operations',
    description: 'Aerial/drone photography session',
    duration_min_minutes: 30,
    duration_max_minutes: 90,
    duration_default_minutes: 60,
    icon: 'Wrench',
    color: 'yellow',
    is_system_preset: true,
  },
  {
    id: 'technical-sound',
    category: 'technical',
    name: 'Sound Check',
    description: 'Audio setup and sound check',
    duration_min_minutes: 10,
    duration_max_minutes: 20,
    duration_default_minutes: 15,
    icon: 'Wrench',
    color: 'yellow',
    is_system_preset: true,
  },

  // Talent Presets
  {
    id: 'talent-makeup',
    category: 'talent',
    name: 'Hair & Makeup',
    description: 'Hair and makeup preparation',
    duration_min_minutes: 30,
    duration_max_minutes: 90,
    duration_default_minutes: 45,
    icon: 'User',
    color: 'pink',
    is_system_preset: true,
  },
  {
    id: 'talent-wardrobe',
    category: 'talent',
    name: 'Wardrobe',
    description: 'Wardrobe fitting and changes',
    duration_min_minutes: 15,
    duration_max_minutes: 30,
    duration_default_minutes: 20,
    icon: 'User',
    color: 'pink',
    is_system_preset: true,
  },
  {
    id: 'talent-briefing',
    category: 'talent',
    name: 'Subject Briefing',
    description: 'Pre-shoot briefing with talent/subject',
    duration_min_minutes: 10,
    duration_max_minutes: 20,
    duration_default_minutes: 15,
    icon: 'User',
    color: 'pink',
    is_system_preset: true,
  },

  // Presentation Presets
  {
    id: 'presentation-demo',
    category: 'presentation',
    name: 'Product Demo',
    description: 'Product demonstration or walkthrough',
    duration_min_minutes: 15,
    duration_max_minutes: 45,
    duration_default_minutes: 30,
    icon: 'Presentation',
    color: 'orange',
    is_system_preset: true,
  },
  {
    id: 'presentation-keynote',
    category: 'presentation',
    name: 'Keynote/Pitch',
    description: 'Keynote presentation or pitch recording',
    duration_min_minutes: 30,
    duration_max_minutes: 60,
    duration_default_minutes: 45,
    icon: 'Presentation',
    color: 'orange',
    is_system_preset: true,
  },
  {
    id: 'presentation-tutorial',
    category: 'presentation',
    name: 'Tutorial/How-To',
    description: 'Tutorial or instructional content',
    duration_min_minutes: 20,
    duration_max_minutes: 40,
    duration_default_minutes: 30,
    icon: 'Presentation',
    color: 'orange',
    is_system_preset: true,
  },

  // Performance Presets
  {
    id: 'performance-music',
    category: 'performance',
    name: 'Musical Performance',
    description: 'Live or staged musical performance',
    duration_min_minutes: 15,
    duration_max_minutes: 60,
    duration_default_minutes: 30,
    icon: 'Music',
    color: 'red',
    is_system_preset: true,
  },
  {
    id: 'performance-dance',
    category: 'performance',
    name: 'Dance/Choreography',
    description: 'Dance performance or choreographed sequence',
    duration_min_minutes: 20,
    duration_max_minutes: 45,
    duration_default_minutes: 30,
    icon: 'Music',
    color: 'red',
    is_system_preset: true,
  },
  {
    id: 'performance-stunt',
    category: 'performance',
    name: 'Stunt/Action',
    description: 'Stunt work or action sequence',
    duration_min_minutes: 30,
    duration_max_minutes: 90,
    duration_default_minutes: 60,
    icon: 'Music',
    color: 'red',
    is_system_preset: true,
  },

  // Location Presets
  {
    id: 'location-scout',
    category: 'location',
    name: 'Location Scout',
    description: 'Location scouting and assessment',
    duration_min_minutes: 30,
    duration_max_minutes: 90,
    duration_default_minutes: 60,
    icon: 'MapPin',
    color: 'purple',
    is_system_preset: true,
  },
  {
    id: 'location-prep',
    category: 'location',
    name: 'Site Preparation',
    description: 'Location preparation and setup',
    duration_min_minutes: 20,
    duration_max_minutes: 60,
    duration_default_minutes: 30,
    icon: 'MapPin',
    color: 'purple',
    is_system_preset: true,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get presets by category
 */
export function getPresetsByCategory(
  category: NonScriptedSegmentCategory,
  includeUserPresets?: NonScriptedSegmentPreset[]
): NonScriptedSegmentPreset[] {
  const systemPresets = SYSTEM_SEGMENT_PRESETS.filter(p => p.category === category);
  const userPresets = includeUserPresets?.filter(p => p.category === category) || [];
  return [...systemPresets, ...userPresets];
}

/**
 * Get all presets grouped by category
 */
export function getPresetsGroupedByCategory(
  includeUserPresets?: NonScriptedSegmentPreset[]
): Map<NonScriptedSegmentCategory, NonScriptedSegmentPreset[]> {
  const groups = new Map<NonScriptedSegmentCategory, NonScriptedSegmentPreset[]>();

  for (const category of SEGMENT_CATEGORIES) {
    const presets = getPresetsByCategory(category.id, includeUserPresets);
    if (presets.length > 0) {
      groups.set(category.id, presets);
    }
  }

  return groups;
}

/**
 * Get a specific preset by ID
 */
export function getPresetById(
  presetId: string,
  userPresets?: NonScriptedSegmentPreset[]
): NonScriptedSegmentPreset | undefined {
  return (
    SYSTEM_SEGMENT_PRESETS.find(p => p.id === presetId) ||
    userPresets?.find(p => p.id === presetId)
  );
}

/**
 * Create a new user preset
 */
export function createUserPreset(
  overrides: Partial<NonScriptedSegmentPreset> & {
    category: NonScriptedSegmentCategory;
    name: string;
  }
): NonScriptedSegmentPreset {
  const categoryMeta = getCategoryMeta(overrides.category);

  return {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    duration_min_minutes: 15,
    duration_max_minutes: 60,
    duration_default_minutes: 30,
    icon: categoryMeta.icon,
    color: categoryMeta.color,
    is_system_preset: false,
    ...overrides,
  };
}

/**
 * Get color class for segment category (Tailwind)
 */
export function getSegmentCategoryColor(category: NonScriptedSegmentCategory): string {
  switch (category) {
    case 'interview':
      return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
    case 'broll':
      return 'bg-green-500/20 border-green-500/40 text-green-400';
    case 'technical':
      return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
    case 'talent':
      return 'bg-pink-500/20 border-pink-500/40 text-pink-400';
    case 'presentation':
      return 'bg-orange-500/20 border-orange-500/40 text-orange-400';
    case 'performance':
      return 'bg-red-500/20 border-red-500/40 text-red-400';
    case 'location':
      return 'bg-purple-500/20 border-purple-500/40 text-purple-400';
    case 'custom':
    default:
      return 'bg-muted-gray/20 border-muted-gray/40 text-muted-gray';
  }
}

/**
 * Format duration range for display
 */
export function formatDurationRange(preset: NonScriptedSegmentPreset): string {
  if (preset.duration_min_minutes === preset.duration_max_minutes) {
    return `${preset.duration_min_minutes} min`;
  }
  return `${preset.duration_min_minutes}-${preset.duration_max_minutes} min`;
}
