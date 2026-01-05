/**
 * WatchStreaksWidget
 * Shows user's watch streak, weekly calendar, and watch stats
 */

import { Link } from 'react-router-dom';
import { useWatchStats } from '@/hooks/useWatchStats';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Flame,
  Clock,
  Play,
  Film,
  ChevronRight,
  Trophy,
} from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// Format minutes to hours/minutes
function formatWatchTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function WatchStreaksWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useWatchStats(14);

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error || !data) {
    return null;
  }

  const { streak, period_stats, calendar } = data;

  // Determine streak status
  const isActiveStreak = streak.current > 0;
  const streakColor = isActiveStreak ? 'text-orange-400' : 'text-muted-gray';

  return (
    <div className={`p-4 bg-charcoal-black border border-orange-500/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className={`w-5 h-5 ${streakColor}`} />
          <h3 className="font-heading text-bone-white">Watch Streak</h3>
          {isActiveStreak && (
            <Badge className="bg-orange-500 text-white text-xs px-1.5 py-0">
              {streak.current} day{streak.current !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/account/activity">
            History
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Streak & Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Current Streak */}
        <div className="text-center">
          <div className={`text-3xl font-bold ${streakColor}`}>
            {streak.current}
          </div>
          <div className="text-xs text-muted-gray">Current</div>
        </div>

        {/* Best Streak */}
        <div className="text-center">
          <div className="text-3xl font-bold text-accent-yellow flex items-center justify-center gap-1">
            <Trophy className="w-4 h-4" />
            {streak.longest}
          </div>
          <div className="text-xs text-muted-gray">Best</div>
        </div>

        {/* Total Days */}
        <div className="text-center">
          <div className="text-3xl font-bold text-bone-white">
            {streak.total_watch_days}
          </div>
          <div className="text-xs text-muted-gray">Total Days</div>
        </div>
      </div>

      {/* Weekly Calendar */}
      <div className="mb-4">
        <div className="text-xs text-muted-gray mb-2">This Week</div>
        <div className="flex justify-between gap-1">
          {calendar.map((day, index) => {
            const isToday = index === calendar.length - 1;
            return (
              <div
                key={day.date}
                className="flex flex-col items-center gap-1"
              >
                <div className="text-xs text-muted-gray">
                  {day.day_name}
                </div>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    day.watched
                      ? 'bg-orange-500 text-white'
                      : isToday
                      ? 'border-2 border-dashed border-muted-gray text-muted-gray'
                      : 'bg-muted-gray/20 text-muted-gray/50'
                  }`}
                >
                  {day.watched ? (
                    <Flame className="w-4 h-4" />
                  ) : (
                    <span className="text-xs">{new Date(day.date).getDate()}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Period Stats */}
      <div className="border-t border-muted-gray/20 pt-3">
        <div className="text-xs text-muted-gray mb-2">Last {period_stats.days} Days</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-gray" />
            <div>
              <div className="text-sm font-medium text-bone-white">
                {formatWatchTime(period_stats.total_minutes)}
              </div>
              <div className="text-xs text-muted-gray">Watched</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-muted-gray" />
            <div>
              <div className="text-sm font-medium text-bone-white">
                {period_stats.total_episodes}
              </div>
              <div className="text-xs text-muted-gray">Episodes</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-muted-gray" />
            <div>
              <div className="text-sm font-medium text-bone-white">
                {period_stats.total_shorts}
              </div>
              <div className="text-xs text-muted-gray">Shorts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Motivation/CTA */}
      {!isActiveStreak && (
        <div className="mt-3 p-2 bg-orange-500/10 border border-orange-500/30 rounded text-center">
          <p className="text-xs text-orange-400">
            Watch something today to start a new streak!
          </p>
          <Button size="sm" className="mt-2 bg-orange-500 hover:bg-orange-600" asChild>
            <Link to="/watch">
              Browse Content
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default WatchStreaksWidget;
