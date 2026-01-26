/**
 * HotSetTimeline - Visual timeline showing planned vs actual progress
 *
 * Features:
 * - Horizontal timeline with hour markers
 * - Planned blocks (top row) in muted colors
 * - Actual blocks (bottom row) in vivid colors
 * - "NOW" marker with current time
 * - Deviation indicator
 * - Clickable blocks to show details
 */
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  HourScheduleBlock,
  HotSetSceneLog,
  HotSetScheduleBlock,
  HotSetTimeline as TimelineData,
} from '@/types/backlot';
import { formatScheduleTime } from '@/hooks/backlot/useHotSet';
import { Film, Coffee, Truck, Target, Clock, ChevronDown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HotSetTimelineProps {
  importedSchedule: HourScheduleBlock[];
  completedScenes: HotSetSceneLog[];
  currentScene: HotSetSceneLog | null;
  scheduleBlocks: HotSetScheduleBlock[];
  timeline: TimelineData | null;
  deviationMinutes: number;
  onBlockClick?: (block: HourScheduleBlock) => void;
  onSceneClick?: (sceneNumber: string) => void;
  projectId?: string;
  timezone?: string | null;
}

// Convert HH:MM to minutes from midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Get block color based on type
function getBlockColor(type: string, isMuted: boolean): string {
  const colors: Record<string, { muted: string; vivid: string }> = {
    scene: { muted: 'bg-blue-500/30', vivid: 'bg-blue-500' },
    meal: { muted: 'bg-green-500/30', vivid: 'bg-green-500' },
    company_move: { muted: 'bg-orange-500/30', vivid: 'bg-orange-500' },
    activity: { muted: 'bg-purple-500/30', vivid: 'bg-purple-500' },
    crew_call: { muted: 'bg-accent-yellow/30', vivid: 'bg-accent-yellow' },
    first_shot: { muted: 'bg-primary-red/30', vivid: 'bg-primary-red' },
    wrap: { muted: 'bg-muted-gray/30', vivid: 'bg-muted-gray' },
    segment: { muted: 'bg-cyan-500/30', vivid: 'bg-cyan-500' },
    custom: { muted: 'bg-pink-500/30', vivid: 'bg-pink-500' },
  };
  return colors[type]?.[isMuted ? 'muted' : 'vivid'] || colors.custom[isMuted ? 'muted' : 'vivid'];
}

// Get block icon
function getBlockIcon(type: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    scene: <Film className="w-3 h-3" />,
    meal: <Coffee className="w-3 h-3" />,
    company_move: <Truck className="w-3 h-3" />,
    activity: <Target className="w-3 h-3" />,
    crew_call: <Clock className="w-3 h-3" />,
    first_shot: <Film className="w-3 h-3" />,
    wrap: <Clock className="w-3 h-3" />,
  };
  return icons[type] || <Target className="w-3 h-3" />;
}

export const HotSetTimeline: React.FC<HotSetTimelineProps> = ({
  importedSchedule,
  completedScenes,
  currentScene,
  scheduleBlocks,
  timeline,
  deviationMinutes,
  onBlockClick,
  onSceneClick,
  projectId,
  timezone,
}) => {
  // Calculate timeline bounds
  const { startMinutes, endMinutes, totalMinutes, hourMarkers } = useMemo(() => {
    if (!timeline) {
      return { startMinutes: 360, endMinutes: 1080, totalMinutes: 720, hourMarkers: [] };
    }

    const start = timeToMinutes(timeline.day_start);
    const end = timeToMinutes(timeline.day_end);
    const total = end - start;

    // Generate hour markers
    const markers: number[] = [];
    const startHour = Math.ceil(start / 60);
    const endHour = Math.floor(end / 60);
    for (let h = startHour; h <= endHour; h++) {
      markers.push(h * 60);
    }

    return { startMinutes: start, endMinutes: end, totalMinutes: total, hourMarkers: markers };
  }, [timeline]);

  // Calculate current time position
  const nowPosition = useMemo(() => {
    if (!timeline) return 50;
    const currentMinutes = timeToMinutes(timeline.current_time);
    return ((currentMinutes - startMinutes) / totalMinutes) * 100;
  }, [timeline, startMinutes, totalMinutes]);

  // Build actual progress blocks
  const actualBlocks = useMemo(() => {
    const blocks: Array<{
      type: string;
      name: string;
      startMinutes: number;
      durationMinutes: number;
      status: string;
    }> = [];

    // Add completed scenes
    let position = 0;
    for (const scene of completedScenes) {
      const duration = scene.actual_duration_minutes || scene.estimated_minutes || 30;
      blocks.push({
        type: 'scene',
        name: `Scene ${scene.scene_number || ''}`,
        startMinutes: startMinutes + position,
        durationMinutes: duration,
        status: 'completed',
      });
      position += duration;
    }

    // Add current scene (in progress)
    if (currentScene) {
      const elapsed = currentScene.actual_start_time
        ? Math.floor(
            (Date.now() - new Date(currentScene.actual_start_time).getTime()) / (1000 * 60)
          )
        : 0;
      blocks.push({
        type: 'scene',
        name: `Scene ${currentScene.scene_number || ''}`,
        startMinutes: startMinutes + position,
        durationMinutes: Math.max(elapsed, 15),
        status: 'in_progress',
      });
    }

    // Add completed schedule blocks (meals, moves)
    for (const block of scheduleBlocks) {
      if (block.status === 'completed' && block.actual_start_time && block.actual_end_time) {
        const startTime = new Date(block.actual_start_time);
        const endTime = new Date(block.actual_end_time);
        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        // Approximate position based on schedule
        blocks.push({
          type: block.block_type,
          name: block.name,
          startMinutes: timeToMinutes(block.expected_start_time),
          durationMinutes: duration,
          status: 'completed',
        });
      }
    }

    return blocks;
  }, [completedScenes, currentScene, scheduleBlocks, startMinutes]);

  if (!importedSchedule.length) {
    return (
      <div className="text-center text-muted-gray py-4">
        No schedule imported. Timeline not available.
      </div>
    );
  }

  // Fallback to vertical list view when timeline data is not available (before day starts)
  if (!timeline) {
    return (
      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
        {importedSchedule.map((block, index) => {
          const isScene = block.type === 'scene';
          const isClickable = isScene && onSceneClick && block.scene_number;

          return (
            <div
              key={block.id || index}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                block.type === 'scene' && 'bg-blue-500/10 border-blue-500/20',
                block.type === 'meal' && 'bg-green-500/10 border-green-500/20',
                block.type === 'company_move' && 'bg-orange-500/10 border-orange-500/20',
                block.type === 'activity' && 'bg-purple-500/10 border-purple-500/20',
                block.type === 'crew_call' && 'bg-accent-yellow/10 border-accent-yellow/20',
                block.type === 'first_shot' && 'bg-primary-red/10 border-primary-red/20',
                block.type === 'wrap' && 'bg-muted-gray/10 border-muted-gray/20',
                isClickable && 'cursor-pointer hover:bg-blue-500/20 hover:border-blue-500/40'
              )}
              onClick={() => {
                if (isClickable && block.scene_number) {
                  onSceneClick(block.scene_number);
                }
              }}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={isClickable ? (e) => {
                if (e.key === 'Enter' && block.scene_number) {
                  onSceneClick(block.scene_number);
                }
              } : undefined}
            >
              {/* Time */}
              <div className="w-16 shrink-0 text-right">
                <span className="text-sm font-mono text-bone-white">
                  {formatScheduleTime(block.start_time, timezone)}
                </span>
              </div>

              {/* Icon */}
              <div className={cn(
                'p-1.5 rounded',
                block.type === 'scene' && 'bg-blue-500/20 text-blue-400',
                block.type === 'meal' && 'bg-green-500/20 text-green-400',
                block.type === 'company_move' && 'bg-orange-500/20 text-orange-400',
                block.type === 'activity' && 'bg-purple-500/20 text-purple-400',
                block.type === 'crew_call' && 'bg-accent-yellow/20 text-accent-yellow',
                block.type === 'first_shot' && 'bg-primary-red/20 text-primary-red',
                block.type === 'wrap' && 'bg-muted-gray/20 text-muted-gray'
              )}>
                {getBlockIcon(block.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-bone-white truncate">
                  {block.type === 'scene'
                    ? `Scene ${block.scene_number || '?'}`
                    : block.activity_name || block.type.replace('_', ' ')}
                </div>
                {block.scene_slugline && (
                  <div className="text-xs text-muted-gray truncate">
                    {block.scene_slugline}
                  </div>
                )}
                {block.location_name && block.type !== 'scene' && (
                  <div className="text-xs text-muted-gray truncate">
                    {block.location_name}
                  </div>
                )}
              </div>

              {/* Duration */}
              <div className="text-xs text-muted-gray shrink-0">
                {block.duration_minutes}m
              </div>

              {/* Click hint for scenes */}
              {isClickable && (
                <ChevronDown className="w-4 h-4 text-muted-gray rotate-[-90deg]" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="bg-soft-black rounded-lg border border-muted-gray/30 p-4">
        {/* Header with time range and deviation */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-gray">
            {formatScheduleTime(timeline?.day_start, timezone)} - {formatScheduleTime(timeline?.day_end, timezone)}
          </div>
          <div
            className={cn(
              'text-sm font-medium',
              deviationMinutes > 15
                ? 'text-red-400'
                : deviationMinutes > 0
                  ? 'text-yellow-400'
                  : deviationMinutes < -15
                    ? 'text-green-400'
                    : 'text-bone-white'
            )}
          >
            {deviationMinutes > 0
              ? `+${deviationMinutes}m behind`
              : deviationMinutes < 0
                ? `${Math.abs(deviationMinutes)}m ahead`
                : 'On schedule'}
          </div>
        </div>

        {/* Hour markers */}
        <div className="relative h-6 mb-2">
          {hourMarkers.map((minutes) => {
            const position = ((minutes - startMinutes) / totalMinutes) * 100;
            const hour = Math.floor(minutes / 60);
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return (
              <div
                key={minutes}
                className="absolute text-xs text-muted-gray transform -translate-x-1/2"
                style={{ left: `${position}%` }}
              >
                {displayHour}
                {period}
              </div>
            );
          })}
        </div>

        {/* Planned schedule row */}
        <div className="relative h-8 bg-charcoal-black/50 rounded mb-1">
          <div className="absolute inset-0 flex items-center px-1">
            <span className="text-xs text-muted-gray mr-2 w-12">Plan</span>
            <div className="relative flex-1 h-6">
              {importedSchedule.map((block) => {
                const blockStart = timeToMinutes(block.start_time);
                const left = ((blockStart - startMinutes) / totalMinutes) * 100;
                const width = (block.duration_minutes / totalMinutes) * 100;

                return (
                  <Tooltip key={block.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'absolute h-5 rounded-sm flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80',
                          getBlockColor(block.type, true)
                        )}
                        style={{
                          left: `${Math.max(0, left)}%`,
                          width: `${Math.min(100 - left, width)}%`,
                        }}
                        onClick={() => onBlockClick?.(block)}
                      >
                        {width > 3 && getBlockIcon(block.type)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-charcoal-black border-muted-gray/30">
                      <div className="text-sm">
                        <div className="font-medium">
                          {block.type === 'scene'
                            ? `Scene ${block.scene_number || ''}`
                            : block.activity_name ||
                              block.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </div>
                        <div className="text-muted-gray">
                          {formatScheduleTime(block.start_time, timezone)} -{' '}
                          {formatScheduleTime(block.end_time, timezone)}
                        </div>
                        <div className="text-muted-gray">{block.duration_minutes} min</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actual progress row */}
        <div className="relative h-8 bg-charcoal-black/50 rounded mb-2">
          <div className="absolute inset-0 flex items-center px-1">
            <span className="text-xs text-muted-gray mr-2 w-12">Actual</span>
            <div className="relative flex-1 h-6">
              {actualBlocks.map((block, index) => {
                const left = ((block.startMinutes - startMinutes) / totalMinutes) * 100;
                const width = (block.durationMinutes / totalMinutes) * 100;

                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'absolute h-5 rounded-sm flex items-center justify-center',
                          getBlockColor(block.type, false),
                          block.status === 'in_progress' && 'animate-pulse'
                        )}
                        style={{
                          left: `${Math.max(0, left)}%`,
                          width: `${Math.min(100 - left, width)}%`,
                        }}
                      >
                        {width > 3 && getBlockIcon(block.type)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-charcoal-black border-muted-gray/30">
                      <div className="text-sm">
                        <div className="font-medium">{block.name}</div>
                        <div className="text-muted-gray">{block.durationMinutes} min</div>
                        <div className="text-muted-gray capitalize">{block.status}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        {/* NOW marker */}
        {nowPosition >= 0 && nowPosition <= 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary-red z-10"
            style={{ left: `calc(${nowPosition}% + 56px)` }}
          >
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
              <ChevronDown className="w-3 h-3 text-primary-red" />
            </div>
            <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-primary-red whitespace-nowrap">
              NOW
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-muted-gray/20">
          <div className="flex items-center gap-1 text-xs text-muted-gray">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span>Scene</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-gray">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span>Meal</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-gray">
            <div className="w-3 h-3 rounded-sm bg-orange-500" />
            <span>Move</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-gray">
            <div className="w-3 h-3 rounded-sm bg-purple-500" />
            <span>Activity</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default HotSetTimeline;
