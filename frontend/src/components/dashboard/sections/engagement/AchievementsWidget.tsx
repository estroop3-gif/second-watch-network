/**
 * AchievementsWidget
 * Shows user's achievements, progress, and total points
 */

import { Link } from 'react-router-dom';
import { useAchievements, useRecentAchievements, Achievement } from '@/hooks/useAchievements';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Trophy,
  Star,
  Film,
  Flame,
  MessageSquare,
  Vote,
  ChevronRight,
  Lock,
} from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// Get category icon
function getCategoryIcon(category: Achievement['category']) {
  switch (category) {
    case 'watching':
      return Film;
    case 'streak':
      return Flame;
    case 'community':
      return MessageSquare;
    case 'voting':
      return Vote;
    case 'creator':
      return Star;
    default:
      return Trophy;
  }
}

// Get category color
function getCategoryColor(category: Achievement['category']) {
  switch (category) {
    case 'watching':
      return 'text-blue-400';
    case 'streak':
      return 'text-orange-400';
    case 'community':
      return 'text-green-400';
    case 'voting':
      return 'text-purple-400';
    case 'creator':
      return 'text-accent-yellow';
    default:
      return 'text-muted-gray';
  }
}

// Format time ago
function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AchievementsWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useAchievements();
  const { data: recentData } = useRecentAchievements(3);

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error || !data) {
    return null;
  }

  const { achievements, total_points, earned_count, total_count } = data;

  // Get next achievements to earn (not yet earned, sorted by progress)
  const inProgress = achievements
    .filter(a => !a.earned_at && a.progress !== null && a.progress > 0)
    .sort((a, b) => {
      const aThreshold = a.requirements?.threshold || 1;
      const bThreshold = b.requirements?.threshold || 1;
      const aProgress = (a.progress || 0) / aThreshold;
      const bProgress = (b.progress || 0) / bThreshold;
      return bProgress - aProgress;
    })
    .slice(0, 2);

  // Recent achievements
  const recent = recentData?.achievements || [];

  return (
    <div className={`p-4 bg-charcoal-black border border-accent-yellow/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent-yellow" />
          <h3 className="font-heading text-bone-white">Achievements</h3>
          <Badge className="bg-accent-yellow text-charcoal-black text-xs px-1.5 py-0">
            {total_points} pts
          </Badge>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/account/achievements">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 p-2 bg-muted-gray/10 rounded">
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-accent-yellow">{earned_count}</div>
          <div className="text-xs text-muted-gray">Earned</div>
        </div>
        <div className="w-px h-8 bg-muted-gray/20" />
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-muted-gray">{total_count - earned_count}</div>
          <div className="text-xs text-muted-gray">To Go</div>
        </div>
        <div className="w-px h-8 bg-muted-gray/20" />
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-bone-white">{total_points}</div>
          <div className="text-xs text-muted-gray">Points</div>
        </div>
      </div>

      {/* Recent Achievements */}
      {recent.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-muted-gray mb-2">Recently Earned</div>
          <div className="flex gap-2">
            {recent.map(achievement => {
              const Icon = getCategoryIcon(achievement.category);
              const color = getCategoryColor(achievement.category);

              return (
                <div
                  key={achievement.id}
                  className="flex items-center gap-2 p-2 bg-muted-gray/10 rounded flex-1"
                  title={achievement.description || achievement.name}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-current/10 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-bone-white truncate">
                      {achievement.name}
                    </div>
                    <div className="text-xs text-muted-gray">
                      {formatTimeAgo(achievement.earned_at!)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* In Progress */}
      {inProgress.length > 0 && (
        <div>
          <div className="text-xs text-muted-gray mb-2">In Progress</div>
          <div className="space-y-2">
            {inProgress.map(achievement => {
              const Icon = getCategoryIcon(achievement.category);
              const color = getCategoryColor(achievement.category);
              const threshold = achievement.requirements?.threshold || 1;
              const progress = achievement.progress || 0;
              const percent = Math.min((progress / threshold) * 100, 100);

              return (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 p-2 bg-muted-gray/10 rounded"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-muted-gray/20 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-bone-white truncate">
                        {achievement.name}
                      </span>
                      <span className="text-xs text-muted-gray">
                        {progress}/{threshold}
                      </span>
                    </div>
                    <Progress value={percent} className="h-1.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recent.length === 0 && inProgress.length === 0 && (
        <div className="text-center py-4">
          <Lock className="w-8 h-8 text-muted-gray mx-auto mb-2" />
          <p className="text-sm text-muted-gray">
            Start watching to unlock achievements!
          </p>
          <Button size="sm" className="mt-2" asChild>
            <Link to="/watch">Browse Content</Link>
          </Button>
        </div>
      )}

      {/* View All CTA */}
      <Button variant="ghost" className="w-full mt-3 text-muted-gray hover:text-bone-white" asChild>
        <Link to="/account/achievements">
          View All Achievements
        </Link>
      </Button>
    </div>
  );
}

export default AchievementsWidget;
