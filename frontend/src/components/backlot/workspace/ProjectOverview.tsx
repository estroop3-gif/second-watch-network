/**
 * ProjectOverview - Dashboard view for a project showing stats and quick actions
 * Fetches project data directly for live updates when project details change.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  CheckSquare,
  MapPin,
  Package,
  Users,
  Megaphone,
  Clock,
  Target,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { BacklotProject } from '@/types/backlot';
import { useProjectDashboard, useProject } from '@/hooks/backlot';
import { formatDistanceToNow, format, isAfter, isBefore, addDays } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

interface ProjectOverviewProps {
  project: BacklotProject;
  permission: {
    canView: boolean;
    canEdit: boolean;
    isAdmin: boolean;
    isOwner: boolean;
    role: string | null;
  } | null;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  color?: string;
  isLoading?: boolean;
}> = ({ title, value, icon, subtitle, color = 'text-accent-yellow', isLoading }) => (
  <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
    <div className="flex items-center gap-3 mb-2">
      <div className={`${color}`}>{icon}</div>
      <span className="text-sm text-muted-gray">{title}</span>
    </div>
    {isLoading ? (
      <>
        <Skeleton className="h-8 w-16 bg-muted-gray/20" />
        {subtitle && <Skeleton className="h-3 w-20 mt-2 bg-muted-gray/10" />}
      </>
    ) : (
      <>
        <div className="text-2xl font-bold text-bone-white">{value}</div>
        {subtitle && <div className="text-xs text-muted-gray mt-1">{subtitle}</div>}
      </>
    )}
  </div>
);

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ project: initialProject, permission }) => {
  // Fetch fresh project data for live updates
  const { data: liveProject, isLoading: projectLoading } = useProject(initialProject.id);

  // Use live project data if available, fallback to initial prop
  const project = liveProject || initialProject;

  // Single optimized API call for all dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useProjectDashboard(project.id);

  const isLoading = projectLoading || dashboardLoading;

  // Extract data with defaults
  const taskStats = dashboardData?.task_stats;
  const days = dashboardData?.days || [];
  const locationsCount = dashboardData?.locations_count || 0;
  const members = dashboardData?.members || [];
  const updates = dashboardData?.updates || [];
  const gearCount = dashboardData?.gear_count || 0;

  // Calculate progress
  const taskProgress = taskStats
    ? Math.round((taskStats.completed / Math.max(taskStats.total, 1)) * 100)
    : 0;

  // Find upcoming shoot days
  const today = new Date();
  const upcomingDays = days
    .filter((d) => isAfter(parseLocalDate(d.date), addDays(today, -1)) && !d.is_completed)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Cover Image */}
          {project.cover_image_url && (
            <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={project.cover_image_url}
                alt={project.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-heading text-bone-white mb-2">{project.title}</h2>
            {project.logline && (
              <p className="text-muted-gray mb-4">{project.logline}</p>
            )}
            <div className="flex flex-wrap gap-2 text-sm text-muted-gray">
              {project.project_type && (
                <Badge variant="outline" className="border-muted-gray/30">
                  {project.project_type}
                </Badge>
              )}
              {project.genre && (
                <Badge variant="outline" className="border-muted-gray/30">
                  {project.genre}
                </Badge>
              )}
              {project.format && (
                <Badge variant="outline" className="border-muted-gray/30">
                  {project.format}
                </Badge>
              )}
              {project.runtime_minutes && (
                <Badge variant="outline" className="border-muted-gray/30">
                  {project.runtime_minutes} min
                </Badge>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-shrink-0 text-right">
            {project.target_start_date && (
              <div className="text-sm text-muted-gray">
                <span className="text-bone-white">Start:</span>{' '}
                {format(parseLocalDate(project.target_start_date), 'MMM d, yyyy')}
              </div>
            )}
            {project.target_end_date && (
              <div className="text-sm text-muted-gray">
                <span className="text-bone-white">Wrap:</span>{' '}
                {format(parseLocalDate(project.target_end_date), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Tasks"
          value={`${taskStats?.completed || 0}/${taskStats?.total || 0}`}
          icon={<CheckSquare className="w-5 h-5" />}
          subtitle={`${taskProgress}% complete`}
          isLoading={isLoading}
        />
        <StatCard
          title="Shoot Days"
          value={days.length}
          icon={<Calendar className="w-5 h-5" />}
          subtitle={`${upcomingDays.length} upcoming`}
          color="text-blue-400"
          isLoading={isLoading}
        />
        <StatCard
          title="Locations"
          value={locationsCount}
          icon={<MapPin className="w-5 h-5" />}
          color="text-green-400"
          isLoading={isLoading}
        />
        <StatCard
          title="Team"
          value={(dashboardData?.members_count || 0) + 1}
          icon={<Users className="w-5 h-5" />}
          subtitle="members"
          color="text-purple-400"
          isLoading={isLoading}
        />
      </div>

      {/* Task Progress */}
      {taskStats && taskStats.total > 0 && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-bone-white">Task Progress</h3>
            <span className="text-sm text-muted-gray">{taskProgress}%</span>
          </div>
          <Progress value={taskProgress} className="h-2" />
          <div className="flex gap-4 mt-3 text-xs text-muted-gray">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-gray/50" />
              Todo: {taskStats.todo}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              In Progress: {taskStats.in_progress}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Review: {taskStats.review}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Done: {taskStats.completed}
            </span>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Shoot Days */}
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
            <h3 className="font-medium text-bone-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent-yellow" />
              Upcoming Shoot Days
            </h3>
            {permission?.canEdit && (
              <Button variant="ghost" size="sm" className="text-accent-yellow hover:text-bone-white">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            )}
          </div>
          {isLoading ? (
            <div className="divide-y divide-muted-gray/10">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4">
                  <Skeleton className="h-5 w-48 bg-muted-gray/20 mb-2" />
                  <Skeleton className="h-4 w-32 bg-muted-gray/10" />
                </div>
              ))}
            </div>
          ) : upcomingDays.length > 0 ? (
            <div className="divide-y divide-muted-gray/10">
              {upcomingDays.map((day) => (
                <div key={day.id} className="p-4 hover:bg-muted-gray/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-bone-white">
                        Day {day.day_number}: {day.title || format(parseLocalDate(day.date), 'EEEE')}
                      </div>
                      <div className="text-sm text-muted-gray">
                        {format(parseLocalDate(day.date), 'MMMM d, yyyy')}
                        {day.general_call_time && ` • Call: ${day.general_call_time}`}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-muted-gray/30 text-xs">
                      {formatDistanceToNow(parseLocalDate(day.date), { addSuffix: true })}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-gray text-sm">
              No upcoming shoot days scheduled
            </div>
          )}
        </div>

        {/* Recent Updates */}
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
            <h3 className="font-medium text-bone-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-accent-yellow" />
              Recent Updates
            </h3>
            {permission?.canEdit && (
              <Button variant="ghost" size="sm" className="text-accent-yellow hover:text-bone-white">
                <Plus className="w-4 h-4 mr-1" />
                Post
              </Button>
            )}
          </div>
          {isLoading ? (
            <div className="divide-y divide-muted-gray/10">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-full bg-muted-gray/20" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 bg-muted-gray/20 mb-2" />
                      <Skeleton className="h-3 w-full bg-muted-gray/10 mb-1" />
                      <Skeleton className="h-3 w-20 bg-muted-gray/10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : updates.length > 0 ? (
            <div className="divide-y divide-muted-gray/10">
              {updates.slice(0, 3).map((update) => (
                <div key={update.id} className="p-4 hover:bg-muted-gray/5 transition-colors">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={update.author?.avatar_url || ''} />
                      <AvatarFallback className="text-xs">
                        {(update.author?.display_name || 'U').slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-bone-white text-sm line-clamp-1">
                        {update.title}
                      </div>
                      <div className="text-xs text-muted-gray line-clamp-2">{update.content}</div>
                      <div className="text-xs text-muted-gray mt-1">
                        {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-gray text-sm">No updates yet</div>
          )}
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
          <h3 className="font-medium text-bone-white flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-yellow" />
            Team ({(dashboardData?.members_count || 0) + 1})
          </h3>
          {permission?.isAdmin && (
            <Button variant="ghost" size="sm" className="text-accent-yellow hover:text-bone-white">
              <Plus className="w-4 h-4 mr-1" />
              Invite
            </Button>
          )}
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-32 rounded-full bg-muted-gray/20" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Owner */}
              {project.owner && (
                <div className="flex items-center gap-2 bg-muted-gray/10 rounded-full px-3 py-1.5">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={project.owner.avatar_url || ''} />
                    <AvatarFallback className="text-[10px]">
                      {(project.owner.display_name || project.owner.full_name || 'O').slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-bone-white">
                    {project.owner.display_name || project.owner.full_name || 'Owner'}
                  </span>
                  <Badge variant="outline" className="text-[10px] border-accent-yellow/30 text-accent-yellow">
                    Owner
                  </Badge>
                </div>
              )}
              {/* Members */}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 bg-muted-gray/10 rounded-full px-3 py-1.5"
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={member.profile?.avatar_url || ''} />
                    <AvatarFallback className="text-[10px]">
                      {(member.profile?.display_name || 'M').slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-bone-white">
                    {member.profile?.display_name || member.profile?.full_name || 'Member'}
                  </span>
                  {member.production_role && (
                    <span className="text-xs text-muted-gray">{member.production_role}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectOverview;
