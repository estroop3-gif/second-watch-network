/**
 * CurrentActivityCard - Unified card for current scene OR activity in progress
 *
 * Handles:
 * - Scene in progress (with timer, complete/skip buttons)
 * - Activity/meal in progress (start/complete controls)
 * - Nothing in progress (show "Start Next" option)
 */
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clapperboard,
  Coffee,
  Truck,
  Play,
  CheckCircle2,
  SkipForward,
  Clock,
  Activity,
  Users,
  Target,
  Flag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HotSetSceneLog, ProjectedScheduleItem } from '@/types/backlot';
import { formatSeconds } from '@/hooks/backlot';

// Calculate elapsed seconds from ISO timestamp
function calculateElapsedSeconds(startTime: string | null): number {
  if (!startTime) return 0;
  try {
    const start = new Date(startTime);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / 1000);
  } catch {
    return 0;
  }
}

// Live timer component
const LiveTimer: React.FC<{ startTime: string | null; className?: string }> = ({
  startTime,
  className,
}) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setSeconds(0);
      return;
    }

    setSeconds(calculateElapsedSeconds(startTime));

    const interval = setInterval(() => {
      setSeconds(calculateElapsedSeconds(startTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime) return <span className="text-muted-gray">--:--</span>;

  return <span className={cn('font-mono text-3xl sm:text-4xl', className)}>{formatSeconds(seconds)}</span>;
};

interface CurrentActivityCardProps {
  currentScene: HotSetSceneLog | null;
  currentActivity: ProjectedScheduleItem | null;
  currentItem?: ProjectedScheduleItem | null; // The currently active item (any type)
  nextScene: HotSetSceneLog | null;
  nextActivity: ProjectedScheduleItem | null;
  nextItem?: ProjectedScheduleItem | null; // The next item to start (any type)
  isActive: boolean;
  isWrapped: boolean;
  canEdit: boolean;
  // Scene actions
  onStartScene?: (sceneId: string) => void;
  onCompleteScene?: (sceneId: string) => void;
  onSkipScene?: (sceneId: string) => void;
  // Activity actions
  onStartActivity?: (blockId: string) => void;
  onCompleteActivity?: (blockId: string) => void;
  onSkipActivity?: (blockId: string) => void;
  // Session actions
  onStartDay?: () => void;
  // Loading states
  isStartingScene?: boolean;
  isCompletingScene?: boolean;
  isSkippingScene?: boolean;
  isStartingActivity?: boolean;
  isCompletingActivity?: boolean;
  isSkippingActivity?: boolean;
  isStartingDay?: boolean;
  className?: string;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'meal':
      return Coffee;
    case 'company_move':
      return Truck;
    case 'scene':
      return Clapperboard;
    case 'crew_call':
      return Users;
    case 'first_shot':
      return Target;
    case 'wrap':
      return Flag;
    case 'activity':
      return Activity;
    default:
      return Activity;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'meal':
      return 'text-green-400 border-green-500/30';
    case 'company_move':
      return 'text-orange-400 border-orange-500/30';
    case 'scene':
      return 'text-accent-yellow border-accent-yellow/30';
    case 'crew_call':
      return 'text-blue-400 border-blue-500/30';
    case 'first_shot':
      return 'text-purple-400 border-purple-500/30';
    case 'wrap':
      return 'text-red-400 border-red-500/30';
    case 'activity':
      return 'text-cyan-400 border-cyan-500/30';
    default:
      return 'text-purple-400 border-purple-500/30';
  }
};

// Get human-readable label for item type
const getActivityLabel = (type: string) => {
  switch (type) {
    case 'meal': return 'Meal Break';
    case 'company_move': return 'Company Move';
    case 'scene': return 'Scene';
    case 'crew_call': return 'Crew Call';
    case 'first_shot': return 'First Shot';
    case 'wrap': return 'Wrap';
    case 'activity': return 'Activity';
    default: return type.replace(/_/g, ' ');
  }
};

export const CurrentActivityCard: React.FC<CurrentActivityCardProps> = ({
  currentScene,
  currentActivity,
  currentItem,
  nextScene,
  nextActivity,
  nextItem,
  isActive,
  isWrapped,
  canEdit,
  onStartScene,
  onCompleteScene,
  onSkipScene,
  onStartActivity,
  onCompleteActivity,
  onSkipActivity,
  onStartDay,
  isStartingScene,
  isCompletingScene,
  isSkippingScene,
  isStartingActivity,
  isCompletingActivity,
  isSkippingActivity,
  isStartingDay,
  className,
}) => {
  // Determine what's currently active - NO scene priority, show whatever is in_progress
  // Use currentItem if provided (new unified approach), fall back to old props
  const activeItem = currentItem || currentActivity;
  const hasCurrentScene = !!currentScene;
  const hasCurrentActivity = !!activeItem && activeItem.status === 'in_progress' && activeItem.type !== 'scene';

  // Show whichever is actually in progress
  const showScene = hasCurrentScene;
  const showActivity = !hasCurrentScene && hasCurrentActivity;

  // Use nextItem if provided (new unified approach), fall back to old props
  const nextItemToStart = nextItem || nextActivity;
  const hasNextScene = !!nextScene;
  const hasNextActivity = !!nextItemToStart && nextItemToStart.status === 'pending';

  // Get the appropriate icon and colors
  const ActivityIcon = activeItem ? getActivityIcon(activeItem.type) : Clapperboard;
  const activityColor = activeItem ? getActivityColor(activeItem.type) : '';

  return (
    <Card className={cn('bg-soft-black', showScene ? 'border-accent-yellow/30' : showActivity ? activityColor : 'border-muted-gray/20', className)}>
      <CardHeader className="border-b border-muted-gray/20">
        <CardTitle className="flex items-center gap-2">
          {showScene ? (
            <>
              <Clapperboard className="w-5 h-5 text-accent-yellow" />
              Now Shooting
            </>
          ) : showActivity && activeItem ? (
            <>
              <ActivityIcon className={cn('w-5 h-5', activityColor.split(' ')[0])} />
              {getActivityLabel(activeItem.type)}
            </>
          ) : (
            <>
              <Clock className="w-5 h-5 text-muted-gray" />
              Ready
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {/* Current Scene */}
        {showScene && currentScene && (
          <div className="text-center space-y-3 sm:space-y-4">
            <div>
              <span className="text-4xl sm:text-6xl font-bold text-accent-yellow">
                {currentScene.scene_number || 'Scene'}
              </span>
              {currentScene.int_ext && (
                <Badge variant="outline" className="ml-2 sm:ml-3 text-sm sm:text-lg">
                  {currentScene.int_ext}
                </Badge>
              )}
            </div>
            <p className="text-lg sm:text-xl text-bone-white truncate">
              {currentScene.set_name || currentScene.description}
            </p>

            {/* Timer */}
            <div className="py-4 sm:py-6">
              <LiveTimer startTime={currentScene.actual_start_time || null} />
              <p className="text-xs sm:text-sm text-muted-gray mt-2">
                Est: {currentScene.estimated_minutes || 30} min
              </p>
            </div>

            {/* Controls */}
            {canEdit && (
              <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
                <Button
                  size="default"
                  onClick={() => onCompleteScene?.(currentScene.id)}
                  disabled={isCompletingScene}
                  className="bg-green-600 hover:bg-green-500 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Complete Scene</span>
                  <span className="sm:hidden">Done</span>
                </Button>
                <Button
                  size="default"
                  variant="outline"
                  onClick={() => onSkipScene?.(currentScene.id)}
                  disabled={isSkippingScene}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                  <span className="hidden sm:inline">Skip</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Current Activity (meal, company move, crew_call, first_shot, wrap, etc.) */}
        {showActivity && activeItem && (
          <div className="text-center space-y-3 sm:space-y-4">
            <div>
              <ActivityIcon className={cn('w-12 h-12 sm:w-16 sm:h-16 mx-auto', activityColor.split(' ')[0])} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-bone-white truncate">
                {activeItem.name}
              </h3>
              {activeItem.description && (
                <p className="text-sm text-muted-gray mt-1 truncate">{activeItem.description}</p>
              )}
            </div>

            {/* Timer */}
            <div className="py-4 sm:py-6">
              <LiveTimer
                startTime={activeItem.actual_start_time || null}
                className={activityColor.split(' ')[0]}
              />
              <p className="text-xs sm:text-sm text-muted-gray mt-2">
                of {activeItem.planned_duration_minutes} min
              </p>
            </div>

            {/* Controls */}
            {canEdit && activeItem.source_id && (
              <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
                <Button
                  size="default"
                  onClick={() => onCompleteActivity?.(activeItem.source_id!)}
                  disabled={isCompletingActivity}
                  className={activeItem.type === 'wrap'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-green-600 hover:bg-green-500 text-white'}
                >
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                  {activeItem.type === 'meal' ? 'End Meal' :
                   activeItem.type === 'wrap' ? 'Wrap Day' : 'Complete'}
                </Button>
                {/* Don't show skip for wrap - it doesn't make sense to skip wrapping */}
                {activeItem.type !== 'wrap' && (
                  <Button
                    size="default"
                    variant="outline"
                    onClick={() => onSkipActivity?.(activeItem.source_id!)}
                    disabled={isSkippingActivity}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                    <span className="hidden sm:inline">Skip</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Nothing in progress */}
        {!showScene && !showActivity && (
          <div className="text-center py-8">
            {!isActive && !isWrapped ? (
              <>
                <p className="text-muted-gray mb-4">Day not started yet</p>
                {canEdit && onStartDay && (
                  <Button
                    size="lg"
                    onClick={onStartDay}
                    disabled={isStartingDay}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Day
                  </Button>
                )}
              </>
            ) : isWrapped ? (
              <div className="text-green-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4" />
                <p className="text-xl font-medium">Day Wrapped</p>
              </div>
            ) : nextItemToStart ? (
              // Show next item regardless of type (chronological progression)
              <>
                <p className="text-muted-gray mb-4">
                  {nextItemToStart.type === 'scene' ? 'Ready for next scene' :
                   `Ready for ${getActivityLabel(nextItemToStart.type).toLowerCase()}`}
                </p>
                {canEdit && (
                  nextItemToStart.type === 'scene' && nextScene ? (
                    <Button
                      size="lg"
                      onClick={() => onStartScene?.(nextScene.id)}
                      disabled={isStartingScene}
                      className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Start {nextScene.scene_number || 'Next Scene'}
                    </Button>
                  ) : nextItemToStart.source_id && nextItemToStart.source_type === 'schedule_block' ? (
                    <Button
                      size="lg"
                      onClick={() => onStartActivity?.(nextItemToStart.source_id!)}
                      disabled={isStartingActivity}
                      className={cn('hover:opacity-90',
                        nextItemToStart.type === 'meal' ? 'bg-green-500 text-charcoal-black' :
                        nextItemToStart.type === 'company_move' ? 'bg-orange-500 text-charcoal-black' :
                        nextItemToStart.type === 'crew_call' ? 'bg-blue-500 text-charcoal-black' :
                        nextItemToStart.type === 'first_shot' ? 'bg-purple-500 text-charcoal-black' :
                        nextItemToStart.type === 'wrap' ? 'bg-red-600 text-white' :
                        'bg-purple-500 text-charcoal-black'
                      )}
                    >
                      <Play className="w-5 h-5 mr-2" />
                      {nextItemToStart.type === 'wrap' ? 'Begin Wrap' : `Start ${nextItemToStart.name}`}
                    </Button>
                  ) : null
                )}
              </>
            ) : hasNextScene && nextScene ? (
              // Fallback to legacy nextScene prop
              <>
                <p className="text-muted-gray mb-4">Ready for next scene</p>
                {canEdit && (
                  <Button
                    size="lg"
                    onClick={() => onStartScene?.(nextScene.id)}
                    disabled={isStartingScene}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start {nextScene.scene_number || 'Next Scene'}
                  </Button>
                )}
              </>
            ) : hasNextActivity && nextActivity?.source_id && nextActivity?.source_type === 'schedule_block' ? (
              // Fallback to legacy nextActivity prop
              <>
                <p className="text-muted-gray mb-4">Ready for {getActivityLabel(nextActivity.type).toLowerCase()}</p>
                {canEdit && (
                  <Button
                    size="lg"
                    onClick={() => onStartActivity?.(nextActivity.source_id!)}
                    disabled={isStartingActivity}
                    className={cn('hover:opacity-90',
                      nextActivity.type === 'meal' ? 'bg-green-500 text-charcoal-black' :
                      nextActivity.type === 'company_move' ? 'bg-orange-500 text-charcoal-black' :
                      nextActivity.type === 'crew_call' ? 'bg-blue-500 text-charcoal-black' :
                      nextActivity.type === 'first_shot' ? 'bg-purple-500 text-charcoal-black' :
                      nextActivity.type === 'wrap' ? 'bg-red-600 text-white' :
                      'bg-purple-500 text-charcoal-black'
                    )}
                  >
                    <Play className="w-5 h-5 mr-2" />
                    {nextActivity.type === 'wrap' ? 'Begin Wrap' : `Start ${nextActivity.name}`}
                  </Button>
                )}
              </>
            ) : (
              <p className="text-muted-gray">No scenes or activities remaining</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
