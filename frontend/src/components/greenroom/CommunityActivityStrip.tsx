/**
 * CommunityActivityStrip Component
 * Shows recent community activity in the Green Room
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  Send,
  Vote,
  MessageSquare,
  Trophy,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Project, greenroomAPI, Cycle } from '@/lib/api/greenroom';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'submission' | 'vote' | 'comment' | 'winner' | 'cycle';
  message: string;
  projectId?: number;
  projectTitle?: string;
  cycleId?: number;
  timestamp: Date;
}

interface CommunityActivityStripProps {
  currentCycle: Cycle | null;
}

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'submission':
      return <Send className="h-4 w-4 text-blue-400" />;
    case 'vote':
      return <Vote className="h-4 w-4 text-emerald-400" />;
    case 'comment':
      return <MessageSquare className="h-4 w-4 text-purple-400" />;
    case 'winner':
      return <Trophy className="h-4 w-4 text-accent-yellow" />;
    case 'cycle':
      return <Sparkles className="h-4 w-4 text-pink-400" />;
    default:
      return <Activity className="h-4 w-4 text-muted-gray" />;
  }
};

export const CommunityActivityStrip: React.FC<CommunityActivityStripProps> = ({
  currentCycle,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      if (!currentCycle) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // TODO: When backend has activity endpoint, use it
        // For now, synthesize activity from recent projects
        const recentProjects = await greenroomAPI.listProjects(currentCycle.id, {
          status: 'approved',
          sort_by: 'recent',
          limit: 5,
        });

        // Generate activity items from recent projects
        const generatedActivities: ActivityItem[] = recentProjects.map((project, index) => ({
          id: `submission-${project.id}`,
          type: 'submission' as const,
          message: `${project.filmmaker_name || 'A filmmaker'} submitted "${project.title}"`,
          projectId: project.id,
          projectTitle: project.title,
          cycleId: project.cycle_id,
          timestamp: new Date(project.created_at),
        }));

        // Add some vote activity (synthesized)
        if (recentProjects.length > 0 && recentProjects[0].vote_count > 0) {
          generatedActivities.unshift({
            id: `vote-recent`,
            type: 'vote',
            message: `"${recentProjects[0].title}" is gaining traction with ${recentProjects[0].vote_count} votes`,
            projectId: recentProjects[0].id,
            projectTitle: recentProjects[0].title,
            cycleId: recentProjects[0].cycle_id,
            timestamp: new Date(),
          });
        }

        // Add cycle activity
        if (currentCycle.status === 'active') {
          generatedActivities.push({
            id: `cycle-${currentCycle.id}`,
            type: 'cycle',
            message: `${currentCycle.name} voting is now live!`,
            cycleId: currentCycle.id,
            timestamp: new Date(currentCycle.start_date),
          });
        }

        setActivities(generatedActivities.slice(0, 6));
      } catch (error) {
        console.error('Failed to load activity:', error);
        setActivities([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadActivity();
  }, [currentCycle]);

  if (isLoading) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-bone-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Community Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-bone-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Community Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Activity className="h-10 w-10 text-muted-gray mx-auto mb-3" />
            <p className="text-sm text-muted-gray">No recent activity yet.</p>
            <p className="text-xs text-muted-gray mt-1">
              Activity will appear as projects are submitted and voted on.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-bone-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          Community Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 bg-charcoal-black/60 rounded-lg border border-muted-gray/20 hover:border-emerald-600/30 transition-colors"
            >
              <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-bone-white line-clamp-2">
                  {activity.message}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-3 w-3 text-muted-gray" />
                  <span className="text-xs text-muted-gray">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </span>
                </div>
              </div>
              {activity.cycleId && (
                <Link
                  to={`/greenroom/cycles/${activity.cycleId}`}
                  className="text-xs text-emerald-400 hover:underline flex-shrink-0"
                >
                  View
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CommunityActivityStrip;
