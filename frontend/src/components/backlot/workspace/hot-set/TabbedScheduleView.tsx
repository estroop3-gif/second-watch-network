/**
 * TabbedScheduleView - Tabbed interface for viewing schedule in different ways
 *
 * Three tabs:
 * 1. Current & Upcoming - Large current activity card + next 3 items
 * 2. Full Day Schedule - All items with planned vs actual/projected times
 * 3. Completed - History of completed items with summary stats
 */
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectedScheduleItem, HotSetSceneLog } from '@/types/backlot';
import { CurrentActivityCard } from './CurrentActivityCard';
import { ScheduleItemRow } from './ScheduleItemRow';
import { formatScheduleTime } from '@/hooks/backlot';

interface TabbedScheduleViewProps {
  items: ProjectedScheduleItem[];
  currentScene: HotSetSceneLog | null;
  nextScenes: HotSetSceneLog[];
  isActive: boolean;
  isWrapped: boolean;
  canEdit: boolean;
  defaultTab?: 'current' | 'full' | 'completed';
  // Scene actions
  onStartScene?: (sceneId: string) => void;
  onCompleteScene?: (sceneId: string) => void;
  onSkipScene?: (sceneId: string) => void;
  onClickScene?: (sceneId: string) => void;
  // Activity actions
  onStartActivity?: (blockId: string) => void;
  onCompleteActivity?: (blockId: string) => void;
  onSkipActivity?: (blockId: string) => void;
  onStartDay?: () => void;
  // Loading states
  isStartingScene?: boolean;
  isCompletingScene?: boolean;
  isSkippingScene?: boolean;
  isStartingActivity?: boolean;
  isCompletingActivity?: boolean;
  isSkippingActivity?: boolean;
  isStartingDay?: boolean;
  isLoading?: boolean;
  className?: string;
  timezone?: string | null;
}

export const TabbedScheduleView: React.FC<TabbedScheduleViewProps> = ({
  items,
  currentScene,
  nextScenes,
  isActive,
  isWrapped,
  canEdit,
  defaultTab = 'current',
  onStartScene,
  onCompleteScene,
  onSkipScene,
  onClickScene,
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
  isLoading,
  className,
  timezone,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Split items by status
  const completedItems = items.filter(i => i.status === 'completed');

  // Find the current item - whatever is in_progress or is_current (regardless of type)
  const currentItem = items.find(i => i.is_current || i.status === 'in_progress');

  // Get the next items chronologically (not just scenes)
  // Shows the linear progression: Crew Call → First Shot → Scene 1 → Meal → Scene 2, etc.
  const upcomingItems = items.filter(
    i => i.status === 'pending' && !i.is_current && i.id !== currentItem?.id
  ).slice(0, 5); // Show next 5 items for better context

  // For CurrentActivityCard - find if current is a scene or activity
  const currentIsScene = currentItem?.type === 'scene';
  const currentActivity = currentItem && !currentIsScene ? currentItem : null;

  // Find the next item to start (first pending item regardless of type)
  const nextPendingItem = items.find(
    i => i.status === 'pending' && i.id !== currentItem?.id
  ) || null;

  // Separate next scene vs next activity for CurrentActivityCard compatibility
  const nextActivityItem = nextPendingItem && nextPendingItem.type !== 'scene' ? nextPendingItem : null;

  // Calculate stats
  const totalItems = items.length;
  const completedCount = completedItems.length;
  const percentComplete = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  // Calculate overall variance
  const overallVariance = currentItem?.variance_from_plan ?? 0;
  const isAhead = overallVariance > 0;
  const isBehind = overallVariance < 0;

  // Find projected wrap time
  const lastItem = items[items.length - 1];
  const projectedWrap = lastItem?.projected_end_time || lastItem?.planned_end_time;
  const plannedWrap = lastItem?.planned_end_time;

  // Calculate total variance for completed items
  const totalVariance = completedItems.reduce((sum, item) => {
    if (item.actual_duration_minutes && item.planned_duration_minutes) {
      return sum + (item.planned_duration_minutes - item.actual_duration_minutes);
    }
    return sum;
  }, 0);

  return (
    <div className={cn('space-y-4', className)}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3 bg-charcoal-black border border-muted-gray/20">
          <TabsTrigger value="current" className="relative">
            <Play className="w-4 h-4 mr-2" />
            Current
            {currentItem && (
              <Badge
                variant="outline"
                className="ml-2 bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30"
              >
                Live
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="full">
            <Calendar className="w-4 h-4 mr-2" />
            Full Day
            <Badge variant="outline" className="ml-2 text-xs">
              {completedCount}/{totalItems}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Completed
            <Badge variant="outline" className="ml-2 text-xs">
              {completedCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Current & Upcoming */}
        <TabsContent value="current" className="space-y-4">
          {/* Current Activity Card - Shows whatever is currently in progress */}
          <CurrentActivityCard
            currentScene={currentScene}
            currentActivity={currentActivity}
            currentItem={currentItem}
            nextScene={nextScenes[0] || null}
            nextActivity={nextActivityItem}
            nextItem={nextPendingItem}
            isActive={isActive}
            isWrapped={isWrapped}
            canEdit={canEdit}
            onStartScene={onStartScene}
            onCompleteScene={onCompleteScene}
            onSkipScene={onSkipScene}
            onStartActivity={onStartActivity}
            onCompleteActivity={onCompleteActivity}
            onSkipActivity={onSkipActivity}
            onStartDay={onStartDay}
            isStartingScene={isStartingScene}
            isCompletingScene={isCompletingScene}
            isSkippingScene={isSkippingScene}
            isStartingActivity={isStartingActivity}
            isCompletingActivity={isCompletingActivity}
            isSkippingActivity={isSkippingActivity}
            isStartingDay={isStartingDay}
          />

          {/* Next Items Preview - Shows chronological progression through day */}
          {upcomingItems.length > 0 && (
            <Card className="bg-soft-black border-muted-gray/20">
              <div className="px-4 py-3 border-b border-muted-gray/20">
                <h3 className="text-sm font-medium text-bone-white">Coming Up Next</h3>
              </div>
              <div className="p-3 space-y-2">
                {upcomingItems.map((item, index) => {
                  // Format item type label nicely
                  const getTypeLabel = (type: string) => {
                    switch (type) {
                      case 'scene': return 'Scene';
                      case 'meal': return 'Meal';
                      case 'company_move': return 'Move';
                      case 'crew_call': return 'Crew Call';
                      case 'first_shot': return 'First Shot';
                      case 'wrap': return 'Wrap';
                      case 'activity': return 'Activity';
                      default: return type.replace(/_/g, ' ');
                    }
                  };

                  // Get badge color based on type
                  const getTypeBadgeClass = (type: string) => {
                    switch (type) {
                      case 'scene': return 'text-accent-yellow border-accent-yellow/30';
                      case 'meal': return 'text-green-400 border-green-500/30';
                      case 'company_move': return 'text-orange-400 border-orange-500/30';
                      case 'crew_call': return 'text-blue-400 border-blue-500/30';
                      case 'first_shot': return 'text-purple-400 border-purple-500/30';
                      case 'wrap': return 'text-red-400 border-red-500/30';
                      default: return 'text-muted-gray border-muted-gray/30';
                    }
                  };

                  return (
                    <div
                      key={item.id || index}
                      className="p-3 rounded-lg bg-charcoal-black/50 border border-muted-gray/10 hover:border-muted-gray/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-xs capitalize', getTypeBadgeClass(item.type))}>
                            {getTypeLabel(item.type)}
                          </Badge>
                          <span className="font-semibold text-bone-white">{item.name}</span>
                        </div>
                        <span className="text-xs text-muted-gray">
                          {formatScheduleTime(item.projected_start_time || item.planned_start_time, timezone)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-gray">{item.description}</p>
                      )}
                      <div className="mt-2 text-xs text-muted-gray">
                        Duration: {item.planned_duration_minutes}m
                        {item.variance_from_plan !== undefined && item.variance_from_plan !== 0 && (
                          <span className={cn(
                            'ml-2',
                            item.variance_from_plan > 0 ? 'text-green-400' : 'text-red-400'
                          )}>
                            ({item.variance_from_plan > 0 ? '+' : ''}{item.variance_from_plan}m cumulative)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Schedule Overview */}
          {items.length > 0 && (
            <Card className="bg-soft-black border-muted-gray/20">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-gray">Progress</span>
                  <span className="text-sm font-semibold text-bone-white">
                    {completedCount} / {totalItems} ({percentComplete}%)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-gray">Cumulative Variance</span>
                  <div className="flex items-center gap-2">
                    {overallVariance === 0 ? (
                      <>
                        <Minus className="w-4 h-4 text-bone-white" />
                        <span className="text-sm font-semibold text-bone-white">On Time</span>
                      </>
                    ) : isAhead ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-semibold text-green-400">
                          {Math.abs(overallVariance)}m Ahead
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-semibold text-red-400">
                          {Math.abs(overallVariance)}m Behind
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {projectedWrap && plannedWrap && (
                  <div className="flex items-center justify-between pt-2 border-t border-muted-gray/20">
                    <span className="text-sm text-muted-gray">Projected Wrap</span>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-bone-white">
                        {formatScheduleTime(projectedWrap, timezone)}
                      </div>
                      {plannedWrap !== projectedWrap && (
                        <div className="text-xs text-muted-gray">
                          Was: {formatScheduleTime(plannedWrap, timezone)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Full Day Schedule */}
        <TabsContent value="full">
          <Card className="bg-soft-black border-muted-gray/20">
            <div className="px-4 py-3 border-b border-muted-gray/20 flex items-center justify-between">
              <h3 className="text-sm font-medium text-bone-white">Full Day Schedule</h3>
              <div className="flex items-center gap-3 text-sm">
                {overallVariance !== 0 && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      isAhead && 'text-green-400 border-green-500/30',
                      isBehind && 'text-red-400 border-red-500/30'
                    )}
                  >
                    {isAhead ? '+' : ''}{overallVariance}m
                  </Badge>
                )}
                {projectedWrap && (
                  <div className="flex items-center gap-1 text-muted-gray">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">
                      Wrap: {formatScheduleTime(projectedWrap, timezone)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-3 space-y-1">
              {items.map((item, index) => (
                <ScheduleItemRow
                  key={item.id || index}
                  item={item}
                  canEdit={canEdit}
                  onStartActivity={onStartActivity}
                  onCompleteActivity={onCompleteActivity}
                  onSkipActivity={onSkipActivity}
                  onStartScene={onStartScene}
                  onClickScene={onClickScene}
                  isLoading={isLoading}
                  showProjectedTimes
                  timezone={timezone}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="px-4 py-2 border-t border-muted-gray/20 flex items-center gap-4 text-xs text-muted-gray">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-accent-yellow" />
                <span>Current</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-gray/30" />
                <span>Pending</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Completed */}
        <TabsContent value="completed">
          <Card className="bg-soft-black border-muted-gray/20">
            <div className="px-4 py-3 border-b border-muted-gray/20">
              <h3 className="text-sm font-medium text-bone-white">Completed Items</h3>
            </div>

            {/* Summary Stats */}
            {completedItems.length > 0 && (
              <div className="px-4 py-3 border-b border-muted-gray/20 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-gray mb-1">Total Completed</div>
                  <div className="text-xl font-bold text-bone-white">{completedCount}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-gray mb-1">Total Variance</div>
                  <div className={cn(
                    'text-xl font-bold',
                    totalVariance > 0 ? 'text-green-400' : totalVariance < 0 ? 'text-red-400' : 'text-bone-white'
                  )}>
                    {totalVariance > 0 ? '+' : ''}{totalVariance}m
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-gray mb-1">Avg per Item</div>
                  <div className="text-xl font-bold text-bone-white">
                    {completedCount > 0 ? Math.round(totalVariance / completedCount) : 0}m
                  </div>
                </div>
              </div>
            )}

            {/* Completed Items List */}
            <div className="p-3 space-y-1">
              {completedItems.length > 0 ? (
                completedItems.map((item, index) => (
                  <ScheduleItemRow
                    key={item.id || index}
                    item={item}
                    canEdit={false}
                    onClickScene={onClickScene}
                    showActualTimes
                    timezone={timezone}
                  />
                ))
              ) : (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-muted-gray/30 mb-3" />
                  <p className="text-muted-gray">No items completed yet</p>
                  <p className="text-sm text-muted-gray/70 mt-1">
                    Completed scenes and activities will appear here
                  </p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
