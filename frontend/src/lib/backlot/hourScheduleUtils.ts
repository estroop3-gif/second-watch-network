/**
 * Hour Schedule Utilities
 *
 * Functions for generating and managing hour-by-hour production schedules.
 * Includes scene duration calculation, meal break insertion, company move detection,
 * and bidirectional sync with call sheet schedule_blocks.
 */

import {
  HourScheduleBlock,
  HourScheduleBlockType,
  HourScheduleConfig,
  ProductionDayScene,
  ScheduleBlock,
  DEFAULT_HOUR_SCHEDULE_CONFIG,
  PAGES_PER_HOUR_PRESETS,
  NonScriptedSegment,
  HourScheduleMode,
  NonScriptedSegmentCategory,
} from '@/types/backlot';
import { getSegmentCategoryColor } from './segmentPresets';

// ============================================================================
// CONSTANTS
// ============================================================================

export { PAGES_PER_HOUR_PRESETS };

export const FIRST_SHOT_OFFSET_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export const MEAL_AFTER_HOURS_OPTIONS = [
  { value: 5, label: '5 hours' },
  { value: 5.5, label: '5.5 hours' },
  { value: 6, label: '6 hours (Union Default)' },
  { value: 6.5, label: '6.5 hours' },
];

export const MEAL_DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

export const COMPANY_MOVE_DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

// Default activity blocks that can be added to schedule
export interface DefaultActivityBlock {
  type: HourScheduleBlockType;
  activity_name: string;
  default_duration_minutes: number;
  is_fixed_time?: boolean;  // If true, time is absolute, not relative
  typical_offset_minutes?: number; // Typical offset from crew call
}

export const DEFAULT_ACTIVITY_BLOCKS: DefaultActivityBlock[] = [
  { type: 'crew_call', activity_name: 'Crew Call', default_duration_minutes: 0, is_fixed_time: true },
  { type: 'activity', activity_name: 'Breakfast Available', default_duration_minutes: 30, typical_offset_minutes: 0 },
  { type: 'activity', activity_name: 'Blocking/Rehearsal', default_duration_minutes: 30, typical_offset_minutes: 45 },
  { type: 'first_shot', activity_name: 'First Shot', default_duration_minutes: 0, is_fixed_time: true },
  { type: 'meal', activity_name: 'Lunch', default_duration_minutes: 30 },
  { type: 'activity', activity_name: 'Afternoon Blocking', default_duration_minutes: 20 },
  { type: 'wrap', activity_name: 'Wrap', default_duration_minutes: 0 },
];

// ============================================================================
// TIME HELPERS
// ============================================================================

/**
 * Parse HH:MM time string to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to HH:MM format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Format time for display (e.g., "7:00 AM")
 */
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const totalMinutes = timeToMinutes(time) + minutes;
  return minutesToTime(totalMinutes);
}

/**
 * Generate a unique ID for schedule blocks
 */
export function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// SCENE DURATION CALCULATION
// ============================================================================

/**
 * Scene complexity type for duration estimation
 */
export type SceneComplexity = 'simple' | 'moderate' | 'complex';

/**
 * Options for calculating scene duration with enhanced accuracy
 */
export interface SceneDurationOptions {
  isExterior?: boolean;          // EXT scenes need more setup
  hasLightingChange?: boolean;   // Day/night in same scene
  complexity?: SceneComplexity;  // Based on page length or manual override
}

/**
 * Scene data shape for complexity detection
 */
interface SceneData {
  int_ext?: string;
  time_of_day?: string;
  page_length?: number;
}

/**
 * Detect scene complexity based on scene data
 */
export function detectSceneComplexity(scene: SceneData | null | undefined): {
  isExterior: boolean;
  timeOfDay: string | null;
  complexity: SceneComplexity;
} {
  const intExt = scene?.int_ext || '';
  const isExterior = intExt.toUpperCase().includes('EXT');
  const timeOfDay = scene?.time_of_day || null;
  const pageLength = scene?.page_length || 0;

  // Complexity based on page length
  let complexity: SceneComplexity = 'simple';
  if (pageLength >= 2) complexity = 'complex';
  else if (pageLength >= 0.5) complexity = 'moderate';

  return { isExterior, timeOfDay, complexity };
}

/**
 * Calculate scene duration based on page count and pages per hour rate
 * Enhanced version with complexity-based estimation when page count is missing
 *
 * @param pageCount - Number of pages in the scene
 * @param pagesPerHour - Production speed (e.g., 0.5 for drama, 1.0 for comedy)
 * @param options - Optional modifiers for more accurate estimation
 * @returns Duration in minutes, rounded to nearest 5, minimum 15 minutes
 */
export function calculateSceneDuration(
  pageCount: number,
  pagesPerHour: number,
  options?: SceneDurationOptions
): number {
  // If no page count, estimate based on complexity (not flat 15)
  if (pageCount <= 0 || pagesPerHour <= 0) {
    if (options?.complexity === 'complex') return 30;
    if (options?.complexity === 'moderate') return 20;
    return 15; // simple default
  }

  const baseMinutes = (pageCount / pagesPerHour) * 60;
  let adjustedMinutes = baseMinutes;

  // Apply multipliers for scene conditions
  if (options?.isExterior) adjustedMinutes *= 1.15;       // 15% more for EXT
  if (options?.hasLightingChange) adjustedMinutes *= 1.1; // 10% more for lighting changes

  // Round to nearest 5, minimum 15
  return Math.max(15, Math.ceil(adjustedMinutes / 5) * 5);
}

/**
 * Get preset label for pages per hour value
 */
export function getPagesPerHourLabel(pagesPerHour: number): string {
  if (pagesPerHour <= 0.25) return 'Drama (Slow)';
  if (pagesPerHour <= 0.35) return 'Action Heavy';
  if (pagesPerHour <= 0.5) return 'Drama (Standard)';
  if (pagesPerHour >= 1.0) return 'Comedy/Sitcom';
  return 'Custom';
}

// ============================================================================
// RESET BLOCK DETECTION AND CREATION
// ============================================================================

export type ResetType = 'camera' | 'lighting' | 'major_setup';

export interface ResetInfo {
  type: ResetType;
  minutes: number;
  reason: string;
}

/**
 * Detect if a reset is needed between two scenes
 * Returns the type and duration of reset needed, or null if no reset
 */
export function detectResetNeeded(
  prevScene: SceneData | null | undefined,
  nextScene: SceneData | null | undefined,
  config: HourScheduleConfig
): ResetInfo | null {
  if (!config.enable_auto_resets) return null;

  const prevTime = (prevScene?.time_of_day || '').toLowerCase();
  const nextTime = (nextScene?.time_of_day || '').toLowerCase();
  const prevIntExt = prevScene?.int_ext || '';
  const nextIntExt = nextScene?.int_ext || '';

  // Check for day/night lighting change
  const dayKeywords = ['day', 'morning', 'afternoon'];
  const nightKeywords = ['night', 'evening', 'dusk', 'dawn'];

  const prevIsDay = dayKeywords.some(k => prevTime.includes(k));
  const prevIsNight = nightKeywords.some(k => prevTime.includes(k));
  const nextIsDay = dayKeywords.some(k => nextTime.includes(k));
  const nextIsNight = nightKeywords.some(k => nextTime.includes(k));

  // Day-to-night or night-to-day transition
  if ((prevIsDay && nextIsNight) || (prevIsNight && nextIsDay)) {
    return {
      type: 'lighting',
      minutes: config.lighting_reset_minutes || 20,
      reason: `${prevIsDay ? 'Day' : 'Night'} to ${nextIsDay ? 'Day' : 'Night'}`,
    };
  }

  // Check for INT/EXT change
  const prevIsInt = prevIntExt.toUpperCase().includes('INT') && !prevIntExt.toUpperCase().includes('EXT');
  const prevIsExt = prevIntExt.toUpperCase().includes('EXT') && !prevIntExt.toUpperCase().includes('INT');
  const nextIsInt = nextIntExt.toUpperCase().includes('INT') && !nextIntExt.toUpperCase().includes('EXT');
  const nextIsExt = nextIntExt.toUpperCase().includes('EXT') && !nextIntExt.toUpperCase().includes('INT');

  if ((prevIsInt && nextIsExt) || (prevIsExt && nextIsInt)) {
    return {
      type: 'major_setup',
      minutes: config.major_setup_minutes || 30,
      reason: `${prevIsInt ? 'INT' : 'EXT'} to ${nextIsInt ? 'INT' : 'EXT'}`,
    };
  }

  // Default camera reset between all scenes
  return {
    type: 'camera',
    minutes: config.camera_reset_minutes || 10,
    reason: 'Standard reset',
  };
}

/**
 * Create a reset block
 */
export function createResetBlock(
  startTime: string,
  resetInfo: ResetInfo,
  fromScene?: string,
  toScene?: string
): HourScheduleBlock {
  const labels: Record<ResetType, string> = {
    camera: 'Camera/Lighting Reset',
    lighting: 'Lighting Reset (Day/Night)',
    major_setup: 'Major Setup Change (INT/EXT)',
  };

  const blockType = resetInfo.type === 'lighting' ? 'lighting_reset' : 'camera_reset';

  return createBlock(blockType, startTime, resetInfo.minutes, {
    activity_name: labels[resetInfo.type],
    activity_notes: resetInfo.reason,
  });
}

// ============================================================================
// SCHEDULE GENERATION
// ============================================================================

/**
 * Create a schedule block
 */
export function createBlock(
  type: HourScheduleBlockType,
  startTime: string,
  durationMinutes: number,
  options: Partial<HourScheduleBlock> = {}
): HourScheduleBlock {
  return {
    id: generateBlockId(),
    type,
    start_time: startTime,
    end_time: addMinutesToTime(startTime, durationMinutes),
    duration_minutes: durationMinutes,
    sort_order: 0,
    ...options,
  };
}

/**
 * Get the page count from a ProductionDayScene
 * Handles null/undefined values and returns actual page count or null if not available
 */
export function getScenePageCount(scene: ProductionDayScene): number | null {
  const pageLength = scene.scene?.page_length;
  // Return null if not set, so callers can handle missing data explicitly
  if (pageLength === null || pageLength === undefined) {
    return null;
  }
  return pageLength;
}

/**
 * Create a scene block from production day scene
 * Uses actual page_length when available, falls back to complexity-based duration when not set
 */
export function createSceneBlock(
  scene: ProductionDayScene,
  startTime: string,
  pagesPerHour: number
): HourScheduleBlock {
  // Get actual page count - may be null if not set on the scene
  const actualPageCount = getScenePageCount(scene);

  // Detect scene complexity for smarter duration estimation
  const sceneInfo = detectSceneComplexity(scene.scene);

  // Use actual page count if available, otherwise use 0 which will trigger complexity-based estimation
  const pageCountForCalc = actualPageCount ?? 0;
  const duration = calculateSceneDuration(pageCountForCalc, pagesPerHour, {
    isExterior: sceneInfo.isExterior,
    complexity: sceneInfo.complexity,
  });

  return createBlock('scene', startTime, duration, {
    scene_id: scene.scene_id,
    scene_number: scene.scene?.scene_number,
    scene_slugline: scene.scene?.slugline || scene.scene?.set_name,
    // Store the actual page count (which may be null/0) for display purposes
    page_count: actualPageCount ?? undefined,
    activity_notes: scene.notes || undefined,
  });
}

/**
 * Create a segment block from non-scripted segment
 */
export function createSegmentBlock(
  segment: NonScriptedSegment,
  startTime: string
): HourScheduleBlock {
  return createBlock('segment', startTime, segment.duration_minutes, {
    activity_name: segment.name,
    activity_notes: segment.notes,
    segment_category: segment.category,
    segment_preset_id: segment.preset_id,
    segment_description: segment.description,
    location_id: segment.location_id,
    location_name: segment.location_name,
  });
}

/**
 * Insert meal breaks into schedule based on elapsed time from first shot
 */
export function insertMealBreaks(
  schedule: HourScheduleBlock[],
  config: HourScheduleConfig,
  firstShotTime: string
): HourScheduleBlock[] {
  const result: HourScheduleBlock[] = [];
  const firstShotMinutes = timeToMinutes(firstShotTime);
  let mealInserted = false;
  let meal2Inserted = false;

  for (const block of schedule) {
    const blockStartMinutes = timeToMinutes(block.start_time);
    const elapsedHours = (blockStartMinutes - firstShotMinutes) / 60;

    // Check if we need to insert first meal
    if (!mealInserted && elapsedHours >= config.meal_1_after_hours) {
      const mealBlock = createBlock('meal', block.start_time, config.meal_1_duration_minutes, {
        activity_name: 'Lunch',
      });
      result.push(mealBlock);
      mealInserted = true;

      // Shift this block's start time
      block.start_time = mealBlock.end_time;
      block.end_time = addMinutesToTime(block.start_time, block.duration_minutes);
    }

    // Check if we need to insert second meal
    if (config.meal_2_enabled && mealInserted && !meal2Inserted) {
      const elapsedFromMeal = elapsedHours - config.meal_1_after_hours;
      if (elapsedFromMeal >= config.meal_2_after_hours - config.meal_1_after_hours) {
        const meal2Block = createBlock('meal', block.start_time, config.meal_2_duration_minutes, {
          activity_name: 'Second Meal',
        });
        result.push(meal2Block);
        meal2Inserted = true;

        block.start_time = meal2Block.end_time;
        block.end_time = addMinutesToTime(block.start_time, block.duration_minutes);
      }
    }

    result.push(block);
  }

  return result;
}

/**
 * Insert company moves between scenes at different locations
 */
export function insertCompanyMoves(
  schedule: HourScheduleBlock[],
  defaultMoveDuration: number
): HourScheduleBlock[] {
  const result: HourScheduleBlock[] = [];
  let lastLocationId: string | undefined;

  for (let i = 0; i < schedule.length; i++) {
    const block = schedule[i];

    // Only check scene blocks for location changes
    if (block.type === 'scene' && block.location_id) {
      if (lastLocationId && lastLocationId !== block.location_id) {
        // Insert company move
        const moveBlock = createBlock('company_move', block.start_time, defaultMoveDuration, {
          activity_name: 'Company Move',
          location_name: block.location_name,
          location_id: block.location_id,
        });
        result.push(moveBlock);

        // Shift this block
        block.start_time = moveBlock.end_time;
        block.end_time = addMinutesToTime(block.start_time, block.duration_minutes);
      }
      lastLocationId = block.location_id;
    }

    result.push(block);
  }

  return result;
}

/**
 * Insert reset blocks between scene blocks based on scene transitions
 */
export function insertResetBlocks(
  contentBlocks: HourScheduleBlock[],
  scenes: ProductionDayScene[],
  config: HourScheduleConfig
): HourScheduleBlock[] {
  if (!config.enable_auto_resets) return contentBlocks;

  const result: HourScheduleBlock[] = [];

  // Create a map of scene_id to scene data for looking up scene info
  const sceneMap = new Map<string, SceneData>();
  for (const s of scenes) {
    if (s.scene_id && s.scene) {
      sceneMap.set(s.scene_id, s.scene as SceneData);
    }
  }

  let prevSceneBlock: HourScheduleBlock | null = null;

  for (let i = 0; i < contentBlocks.length; i++) {
    const block = contentBlocks[i];

    // Check if we need to insert reset before this scene block
    if (block.type === 'scene' && prevSceneBlock?.type === 'scene') {
      const prevScene = prevSceneBlock.scene_id ? sceneMap.get(prevSceneBlock.scene_id) : null;
      const currentScene = block.scene_id ? sceneMap.get(block.scene_id) : null;

      if (prevScene && currentScene) {
        const resetInfo = detectResetNeeded(prevScene, currentScene, config);

        if (resetInfo) {
          // Insert reset block before current scene
          const resetBlock = createResetBlock(block.start_time, resetInfo);
          result.push(resetBlock);

          // Shift current block's time
          block.start_time = resetBlock.end_time;
          block.end_time = addMinutesToTime(block.start_time, block.duration_minutes);
        }
      }
    }

    result.push(block);

    // Track the previous scene block for comparison
    if (block.type === 'scene') {
      prevSceneBlock = block;
    }
  }

  return result;
}

/**
 * Generate full hour schedule from scenes and configuration (legacy, scripted-only)
 */
export function generateHourSchedule(
  scenes: ProductionDayScene[],
  config: HourScheduleConfig = DEFAULT_HOUR_SCHEDULE_CONFIG
): HourScheduleBlock[] {
  return generateHourScheduleWithSegments(scenes, [], config, 'scripted');
}

/**
 * Generate hour schedule with support for scenes, segments, and mixed mode
 */
export function generateHourScheduleWithSegments(
  scenes: ProductionDayScene[],
  segments: NonScriptedSegment[],
  config: HourScheduleConfig = DEFAULT_HOUR_SCHEDULE_CONFIG,
  mode: HourScheduleMode = 'scripted'
): HourScheduleBlock[] {
  const schedule: HourScheduleBlock[] = [];
  let currentTime = config.crew_call_time;

  // 1. Crew Call
  schedule.push(createBlock('crew_call', currentTime, 0, {
    activity_name: 'Crew Call',
  }));

  // 2. Pre-shoot activities (based on first shot offset)
  const firstShotTime = addMinutesToTime(currentTime, config.first_shot_offset_minutes);

  // Add breakfast if there's time
  if (config.first_shot_offset_minutes >= 45) {
    schedule.push(createBlock('activity', currentTime, 30, {
      activity_name: 'Breakfast Available',
    }));
    currentTime = addMinutesToTime(currentTime, 30);
  }

  // Add blocking/rehearsal (for scripted modes)
  if ((mode === 'scripted' || mode === 'mixed') && config.first_shot_offset_minutes >= 30) {
    const blockingDuration = Math.min(30, config.first_shot_offset_minutes - 30);
    if (blockingDuration > 0) {
      schedule.push(createBlock('activity', currentTime, blockingDuration, {
        activity_name: 'Blocking/Rehearsal',
      }));
      currentTime = addMinutesToTime(currentTime, blockingDuration);
    }
  }

  // For non-scripted, add briefing instead
  if (mode === 'non_scripted' && config.first_shot_offset_minutes >= 30) {
    const briefingDuration = Math.min(20, config.first_shot_offset_minutes - 30);
    if (briefingDuration > 0) {
      schedule.push(createBlock('activity', currentTime, briefingDuration, {
        activity_name: 'Production Briefing',
      }));
      currentTime = addMinutesToTime(currentTime, briefingDuration);
    }
  }

  // 3. First Shot marker
  schedule.push(createBlock('first_shot', firstShotTime, 0, {
    activity_name: mode === 'non_scripted' ? 'First Setup' : 'First Shot',
  }));
  currentTime = firstShotTime;

  // 4. Content blocks based on mode
  const contentBlocks: HourScheduleBlock[] = [];
  const bufferMinutes = config.segment_buffer_minutes || config.scene_buffer_minutes;

  if (mode === 'scripted') {
    // Scene blocks only
    const sortedScenes = [...scenes].sort((a, b) => a.sort_order - b.sort_order);
    for (const scene of sortedScenes) {
      const sceneBlock = createSceneBlock(scene, currentTime, config.pages_per_hour);
      contentBlocks.push(sceneBlock);
      currentTime = addMinutesToTime(currentTime, sceneBlock.duration_minutes + config.scene_buffer_minutes);
    }
  } else if (mode === 'non_scripted') {
    // Segment blocks only
    const sortedSegments = [...segments].sort((a, b) => a.sort_order - b.sort_order);

    // Optionally group by location
    const processedSegments = config.group_by_location
      ? groupSegmentsByLocation(sortedSegments)
      : sortedSegments;

    for (const segment of processedSegments) {
      const segmentBlock = createSegmentBlock(segment, currentTime);
      contentBlocks.push(segmentBlock);
      currentTime = addMinutesToTime(currentTime, segment.duration_minutes + bufferMinutes);
    }
  } else if (mode === 'mixed') {
    // Interleave scenes and segments by sort_order
    const sortedScenes = [...scenes].sort((a, b) => a.sort_order - b.sort_order);
    const sortedSegments = [...segments].sort((a, b) => a.sort_order - b.sort_order);

    // Combine into unified list with type marker
    interface ContentItem {
      type: 'scene' | 'segment';
      data: ProductionDayScene | NonScriptedSegment;
      sort_order: number;
    }

    const combinedContent: ContentItem[] = [
      ...sortedScenes.map(s => ({ type: 'scene' as const, data: s, sort_order: s.sort_order })),
      ...sortedSegments.map(s => ({ type: 'segment' as const, data: s, sort_order: s.sort_order })),
    ].sort((a, b) => a.sort_order - b.sort_order);

    for (const item of combinedContent) {
      if (item.type === 'scene') {
        const scene = item.data as ProductionDayScene;
        const sceneBlock = createSceneBlock(scene, currentTime, config.pages_per_hour);
        contentBlocks.push(sceneBlock);
        currentTime = addMinutesToTime(currentTime, sceneBlock.duration_minutes + config.scene_buffer_minutes);
      } else {
        const segment = item.data as NonScriptedSegment;
        const segmentBlock = createSegmentBlock(segment, currentTime);
        contentBlocks.push(segmentBlock);
        currentTime = addMinutesToTime(currentTime, segment.duration_minutes + bufferMinutes);
      }
    }
  }

  // 5. Insert reset blocks between scenes (camera/lighting resets)
  const blocksWithResets = insertResetBlocks(contentBlocks, scenes, config);

  // 6. Insert company moves (for blocks with different locations)
  const blocksWithMoves = insertCompanyMovesForBlocks(blocksWithResets, config.default_move_duration_minutes);

  // 7. Insert meal breaks
  const blocksWithMeals = insertMealBreaks(blocksWithMoves, config, firstShotTime);

  schedule.push(...blocksWithMeals);

  // 8. Wrap
  const lastBlock = schedule[schedule.length - 1];
  const wrapTime = lastBlock ? lastBlock.end_time : currentTime;
  schedule.push(createBlock('wrap', wrapTime, 0, {
    activity_name: 'Wrap',
  }));

  // Assign sort orders
  schedule.forEach((block, index) => {
    block.sort_order = index;
  });

  return schedule;
}

/**
 * Group segments by location for optimal scheduling
 */
function groupSegmentsByLocation(segments: NonScriptedSegment[]): NonScriptedSegment[] {
  // Group by location_id (undefined goes to 'no-location')
  const byLocation = new Map<string, NonScriptedSegment[]>();

  for (const segment of segments) {
    const locationKey = segment.location_id || 'no-location';
    if (!byLocation.has(locationKey)) {
      byLocation.set(locationKey, []);
    }
    byLocation.get(locationKey)!.push(segment);
  }

  // Flatten, maintaining internal order within each location group
  const result: NonScriptedSegment[] = [];
  let sortOrder = 0;

  byLocation.forEach((locationSegments) => {
    for (const segment of locationSegments) {
      result.push({ ...segment, sort_order: sortOrder++ });
    }
  });

  return result;
}

/**
 * Insert company moves between blocks at different locations (works for both scenes and segments)
 */
function insertCompanyMovesForBlocks(
  blocks: HourScheduleBlock[],
  defaultMoveDuration: number
): HourScheduleBlock[] {
  const result: HourScheduleBlock[] = [];
  let lastLocationId: string | undefined;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Check for location changes in both scene and segment blocks
    const blockLocationId = block.location_id;

    if (blockLocationId && lastLocationId && lastLocationId !== blockLocationId) {
      // Insert company move
      const moveBlock = createBlock('company_move', block.start_time, defaultMoveDuration, {
        activity_name: 'Company Move',
        location_name: block.location_name,
        location_id: blockLocationId,
      });
      result.push(moveBlock);

      // Shift this block
      block.start_time = moveBlock.end_time;
      block.end_time = addMinutesToTime(block.start_time, block.duration_minutes);
    }

    if (blockLocationId) {
      lastLocationId = blockLocationId;
    }

    result.push(block);
  }

  return result;
}

/**
 * Recalculate times for a schedule when blocks are reordered or modified
 */
export function recalculateScheduleTimes(
  schedule: HourScheduleBlock[],
  crewCallTime: string,
  config: HourScheduleConfig
): HourScheduleBlock[] {
  const result: HourScheduleBlock[] = [];
  let currentTime = crewCallTime;

  for (const block of schedule) {
    const updatedBlock = { ...block };

    if (block.type === 'crew_call') {
      updatedBlock.start_time = crewCallTime;
      updatedBlock.end_time = crewCallTime;
    } else if (block.duration_minutes === 0) {
      // Zero-duration markers (first_shot, wrap)
      updatedBlock.start_time = currentTime;
      updatedBlock.end_time = currentTime;
    } else {
      updatedBlock.start_time = currentTime;
      updatedBlock.end_time = addMinutesToTime(currentTime, block.duration_minutes);
      currentTime = addMinutesToTime(currentTime, block.duration_minutes + config.scene_buffer_minutes);
    }

    result.push(updatedBlock);
  }

  return result;
}

// ============================================================================
// CALL SHEET SYNC
// ============================================================================

/**
 * Convert hour schedule blocks to call sheet schedule_blocks format
 * Filters out scene blocks (scenes shown separately on call sheets)
 */
export function hourScheduleToCallSheetBlocks(
  hourSchedule: HourScheduleBlock[]
): ScheduleBlock[] {
  return hourSchedule
    .filter(block => block.type !== 'scene') // Scenes are listed separately
    .map(block => ({
      time: formatTimeDisplay(block.start_time),
      activity: block.activity_name || getDefaultActivityName(block.type),
      notes: block.activity_notes,
    }));
}

/**
 * Get default activity name for block type
 */
function getDefaultActivityName(type: HourScheduleBlockType): string {
  switch (type) {
    case 'crew_call': return 'Crew Call';
    case 'first_shot': return 'First Shot';
    case 'meal': return 'Meal Break';
    case 'company_move': return 'Company Move';
    case 'wrap': return 'Wrap';
    case 'activity': return 'Activity';
    case 'custom': return 'Custom Activity';
    case 'segment': return 'Segment';
    case 'camera_reset': return 'Camera/Lighting Reset';
    case 'lighting_reset': return 'Major Lighting Reset';
    default: return 'Activity';
  }
}

/**
 * Infer block type from activity name
 */
function inferBlockType(activity: string): HourScheduleBlockType {
  const activityLower = activity.toLowerCase();

  if (activityLower.includes('crew call') || activityLower.includes('call time')) return 'crew_call';
  if (activityLower.includes('first shot')) return 'first_shot';
  if (activityLower.includes('lunch') || activityLower.includes('meal') ||
      activityLower.includes('breakfast') || activityLower.includes('dinner')) return 'meal';
  if (activityLower.includes('wrap')) return 'wrap';
  if (activityLower.includes('move') || activityLower.includes('travel')) return 'company_move';

  return 'activity';
}

/**
 * Parse time display string to HH:MM format
 */
function parseTimeDisplay(time: string): string {
  // Handle formats like "7:00 AM", "12:30 PM", "07:00"
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return '00:00';

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

/**
 * Convert call sheet schedule_blocks to hour schedule format
 * Merges with scene timing information
 */
export function callSheetBlocksToHourSchedule(
  scheduleBlocks: ScheduleBlock[],
  scenes: ProductionDayScene[],
  config: HourScheduleConfig = DEFAULT_HOUR_SCHEDULE_CONFIG
): HourScheduleBlock[] {
  const result: HourScheduleBlock[] = [];
  let sortOrder = 0;

  // First, convert schedule blocks to hour schedule blocks
  for (const block of scheduleBlocks) {
    const startTime = parseTimeDisplay(block.time);
    const type = inferBlockType(block.activity);

    // Estimate duration based on type
    let durationMinutes = 0;
    if (type === 'meal') durationMinutes = config.meal_1_duration_minutes;
    else if (type === 'activity') durationMinutes = 30;
    else if (type === 'company_move') durationMinutes = config.default_move_duration_minutes;

    result.push(createBlock(type, startTime, durationMinutes, {
      activity_name: block.activity,
      activity_notes: block.notes,
      sort_order: sortOrder++,
    }));
  }

  // Then, interleave scenes based on their order
  // This is a simplified approach - in practice, you may want more sophisticated merging
  if (scenes.length > 0) {
    const firstShotBlock = result.find(b => b.type === 'first_shot');
    let sceneStartTime = firstShotBlock?.start_time || config.crew_call_time;

    const sortedScenes = [...scenes].sort((a, b) => a.sort_order - b.sort_order);
    const sceneBlocks: HourScheduleBlock[] = [];

    for (const scene of sortedScenes) {
      const sceneBlock = createSceneBlock(scene, sceneStartTime, config.pages_per_hour);
      sceneBlock.sort_order = sortOrder++;
      sceneBlocks.push(sceneBlock);
      sceneStartTime = addMinutesToTime(sceneStartTime, sceneBlock.duration_minutes + config.scene_buffer_minutes);
    }

    // Merge scene blocks into result
    // Find first shot index and insert scenes after it
    const firstShotIndex = result.findIndex(b => b.type === 'first_shot');
    if (firstShotIndex >= 0) {
      result.splice(firstShotIndex + 1, 0, ...sceneBlocks);
    } else {
      result.push(...sceneBlocks);
    }
  }

  // Re-sort by sort_order
  result.sort((a, b) => a.sort_order - b.sort_order);

  // Recalculate sort orders
  result.forEach((block, index) => {
    block.sort_order = index;
  });

  return result;
}

// ============================================================================
// VALIDATION & HELPERS
// ============================================================================

/**
 * Validate schedule configuration
 */
export function validateConfig(config: Partial<HourScheduleConfig>): string[] {
  const errors: string[] = [];

  if (config.pages_per_hour !== undefined && (config.pages_per_hour <= 0 || config.pages_per_hour > 10)) {
    errors.push('Pages per hour must be between 0 and 10');
  }

  if (config.first_shot_offset_minutes !== undefined && config.first_shot_offset_minutes < 0) {
    errors.push('First shot offset cannot be negative');
  }

  if (config.meal_1_after_hours !== undefined && (config.meal_1_after_hours < 1 || config.meal_1_after_hours > 12)) {
    errors.push('First meal timing must be between 1 and 12 hours');
  }

  return errors;
}

/**
 * Calculate total schedule duration in minutes
 */
export function calculateTotalDuration(schedule: HourScheduleBlock[]): number {
  if (schedule.length === 0) return 0;

  const firstBlock = schedule[0];
  const lastBlock = schedule[schedule.length - 1];

  return timeToMinutes(lastBlock.end_time) - timeToMinutes(firstBlock.start_time);
}

/**
 * Calculate total scene pages in schedule
 */
export function calculateTotalPages(schedule: HourScheduleBlock[]): number {
  return schedule
    .filter(b => b.type === 'scene' && b.page_count != null)
    .reduce((sum, b) => sum + (b.page_count || 0), 0);
}

/**
 * Get schedule summary for preview
 */
export interface ScheduleSummary {
  totalDurationMinutes: number;
  totalDurationFormatted: string;
  sceneCount: number;
  segmentCount: number;
  totalPages: number;
  mealCount: number;
  companyMoveCount: number;
  crewCallTime: string;
  wrapTime: string;
}

export function getScheduleSummary(schedule: HourScheduleBlock[]): ScheduleSummary {
  const totalMinutes = calculateTotalDuration(schedule);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const crewCallBlock = schedule.find(b => b.type === 'crew_call');
  const wrapBlock = schedule.find(b => b.type === 'wrap');

  return {
    totalDurationMinutes: totalMinutes,
    totalDurationFormatted: `${hours}h ${mins}m`,
    sceneCount: schedule.filter(b => b.type === 'scene').length,
    segmentCount: schedule.filter(b => b.type === 'segment').length,
    totalPages: calculateTotalPages(schedule),
    mealCount: schedule.filter(b => b.type === 'meal').length,
    companyMoveCount: schedule.filter(b => b.type === 'company_move').length,
    crewCallTime: crewCallBlock?.start_time || '06:00',
    wrapTime: wrapBlock?.start_time || '18:00',
  };
}

/**
 * Check if two schedules are effectively equal (for sync detection)
 */
export function areSchedulesEqual(
  schedule1: HourScheduleBlock[],
  schedule2: HourScheduleBlock[]
): boolean {
  if (schedule1.length !== schedule2.length) return false;

  for (let i = 0; i < schedule1.length; i++) {
    const a = schedule1[i];
    const b = schedule2[i];

    if (a.type !== b.type ||
        a.start_time !== b.start_time ||
        a.duration_minutes !== b.duration_minutes ||
        a.activity_name !== b.activity_name ||
        a.scene_id !== b.scene_id) {
      return false;
    }
  }

  return true;
}
