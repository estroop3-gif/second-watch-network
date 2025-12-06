/**
 * PublicProjectPage - Public-facing page for a Backlot project
 * Accessible via /projects/[slug] for public and unlisted projects
 */
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Film,
  Calendar,
  Clock,
  MapPin,
  Users,
  Lock,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react';
import { useProjectBySlug, usePublicUpdates, useProjectMembers } from '@/hooks/backlot';
import { BacklotProjectStatus } from '@/types/backlot';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_LABELS: Record<BacklotProjectStatus, string> = {
  pre_production: 'Pre-Production',
  production: 'Production',
  post_production: 'Post-Production',
  completed: 'Completed',
  on_hold: 'On Hold',
  archived: 'Archived',
};

const STATUS_COLORS: Record<BacklotProjectStatus, string> = {
  pre_production: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  production: 'bg-green-500/20 text-green-400 border-green-500/30',
  post_production: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30',
  on_hold: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  archived: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
};

const PublicProjectPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: project, isLoading, error } = useProjectBySlug(slug || null);
  const { data: updates } = usePublicUpdates(project?.id || null, 5);
  const { members } = useProjectMembers(project?.id || null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black">
        <div className="container mx-auto px-4 max-w-4xl py-8">
          <Skeleton className="h-64 w-full rounded-lg mb-8" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
          <h2 className="text-2xl font-heading text-bone-white mb-4">Project Not Found</h2>
          <p className="text-muted-gray mb-6">
            This project doesn't exist or is not publicly accessible.
          </p>
          <Link to="/">
            <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check visibility
  if (project.visibility === 'private') {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
          <h2 className="text-2xl font-heading text-bone-white mb-4">Private Project</h2>
          <p className="text-muted-gray mb-6">This project is private and not publicly viewable.</p>
          <Link to="/">
            <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Cover Image */}
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-muted-gray/20 to-charcoal-black">
        {project.cover_image_url ? (
          <img
            src={project.cover_image_url}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-24 h-24 text-muted-gray/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-black to-transparent" />
      </div>

      <div className="container mx-auto px-4 max-w-4xl -mt-24 relative z-10 pb-16">
        {/* Project Header */}
        <div className="bg-charcoal-black/90 backdrop-blur border border-muted-gray/20 rounded-lg p-6 md:p-8 mb-8">
          {/* Title & Status */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-heading text-bone-white mb-2">
                {project.title}
              </h1>
              {project.logline && (
                <p className="text-lg text-muted-gray">{project.logline}</p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 text-sm ${STATUS_COLORS[project.status]}`}
            >
              {STATUS_LABELS[project.status]}
            </Badge>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-3 mb-6">
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
                <Clock className="w-3 h-3 mr-1" />
                {project.runtime_minutes} min
              </Badge>
            )}
          </div>

          {/* Timeline */}
          {(project.target_start_date || project.target_end_date) && (
            <div className="flex flex-wrap gap-4 text-sm text-muted-gray mb-6">
              {project.target_start_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Start: {format(new Date(project.target_start_date), 'MMMM d, yyyy')}
                </div>
              )}
              {project.target_end_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Wrap: {format(new Date(project.target_end_date), 'MMMM d, yyyy')}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {project.description && (
            <div className="prose prose-invert max-w-none">
              <p className="text-muted-gray whitespace-pre-wrap">{project.description}</p>
            </div>
          )}

          {/* Owner */}
          {project.owner && (
            <div className="mt-6 pt-6 border-t border-muted-gray/20">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={project.owner.avatar_url || ''} />
                  <AvatarFallback>
                    {(project.owner.display_name || project.owner.full_name || 'O').slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-bone-white font-medium">
                    {project.owner.display_name || project.owner.full_name || 'Project Owner'}
                  </div>
                  {project.owner.username && (
                    <Link
                      to={`/profile/${project.owner.username}`}
                      className="text-sm text-accent-yellow hover:underline"
                    >
                      View Profile
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Updates */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-heading text-bone-white">Updates</h2>

            {updates && updates.length > 0 ? (
              <div className="space-y-4">
                {updates.map((update) => (
                  <div
                    key={update.id}
                    className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={update.author?.avatar_url || ''} />
                        <AvatarFallback>
                          {(update.author?.display_name || 'U').slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-bone-white">
                          {update.author?.display_name || update.author?.full_name || 'Team'}
                        </div>
                        <div className="text-xs text-muted-gray">
                          {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    <h3 className="font-medium text-bone-white mb-2">{update.title}</h3>
                    <p className="text-sm text-muted-gray whitespace-pre-wrap">{update.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-8 text-center">
                <p className="text-muted-gray">No public updates yet.</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team */}
            <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
              <h3 className="font-medium text-bone-white flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-accent-yellow" />
                Team
              </h3>
              <div className="space-y-3">
                {/* Owner */}
                {project.owner && (
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={project.owner.avatar_url || ''} />
                      <AvatarFallback className="text-xs">
                        {(project.owner.display_name || 'O').slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-bone-white truncate">
                        {project.owner.display_name || project.owner.full_name}
                      </div>
                      <div className="text-xs text-muted-gray">Owner</div>
                    </div>
                  </div>
                )}
                {/* Members */}
                {members.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={member.profile?.avatar_url || ''} />
                      <AvatarFallback className="text-xs">
                        {(member.profile?.display_name || 'M').slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-bone-white truncate">
                        {member.profile?.display_name || member.profile?.full_name}
                      </div>
                      {member.production_role && (
                        <div className="text-xs text-muted-gray">{member.production_role}</div>
                      )}
                    </div>
                  </div>
                ))}
                {members.length > 5 && (
                  <div className="text-xs text-muted-gray">+{members.length - 5} more</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProjectPage;
