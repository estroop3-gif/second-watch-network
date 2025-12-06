/**
 * BacklotHome - Main landing page for the Backlot Production Hub
 * Lists user's projects with create project functionality
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Search,
  Film,
  Calendar,
  Users,
  CheckSquare,
  Settings,
  MoreVertical,
  Lock,
  Globe,
  Eye,
  Clapperboard,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjects } from '@/hooks/backlot';
import { BacklotProject, BacklotProjectStatus, BacklotVisibility } from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';
import CreateProjectModal from '@/components/backlot/CreateProjectModal';

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

const VisibilityIcon: React.FC<{ visibility: BacklotVisibility }> = ({ visibility }) => {
  switch (visibility) {
    case 'private':
      return <Lock className="w-3 h-3" />;
    case 'unlisted':
      return <Eye className="w-3 h-3" />;
    case 'public':
      return <Globe className="w-3 h-3" />;
  }
};

const ProjectCard: React.FC<{ project: BacklotProject; onDelete: (id: string) => void }> = ({
  project,
  onDelete,
}) => {
  const navigate = useNavigate();

  return (
    <div
      className="group bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden hover:border-accent-yellow/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/backlot/projects/${project.id}`)}
    >
      {/* Cover Image or Placeholder */}
      <div className="relative h-32 bg-gradient-to-br from-muted-gray/20 to-charcoal-black">
        {project.cover_image_url ? (
          <img
            src={project.cover_image_url}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Clapperboard className="w-12 h-12 text-muted-gray/30" />
          </div>
        )}
        {/* Visibility Badge */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className="bg-charcoal-black/80 border-muted-gray/30 text-xs flex items-center gap-1"
          >
            <VisibilityIcon visibility={project.visibility} />
            {project.visibility}
          </Badge>
        </div>
        {/* Actions */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-charcoal-black/80 hover:bg-charcoal-black"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => navigate(`/backlot/projects/${project.id}`)}>
                <Film className="w-4 h-4 mr-2" />
                Open Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/backlot/projects/${project.id}/settings`)}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400"
                onClick={() => onDelete(project.id)}
              >
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-bone-white line-clamp-1">{project.title}</h3>
          <Badge variant="outline" className={`text-xs shrink-0 ${STATUS_COLORS[project.status]}`}>
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>

        {project.logline && (
          <p className="text-sm text-muted-gray line-clamp-2 mb-3">{project.logline}</p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-gray">
          <div className="flex items-center gap-1">
            {project.owner && (
              <Avatar className="w-5 h-5">
                <AvatarImage src={project.owner.avatar_url || ''} />
                <AvatarFallback className="text-[10px]">
                  {(project.owner.display_name || project.owner.full_name || 'U').slice(0, 1)}
                </AvatarFallback>
              </Avatar>
            )}
            <span>{project.owner?.display_name || project.owner?.full_name || 'Owner'}</span>
          </div>
          <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
};

const ProjectCardSkeleton: React.FC = () => (
  <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden">
    <Skeleton className="h-32 w-full" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  </div>
);

const BacklotHome: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BacklotProjectStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { projects, isLoading, deleteProject } = useProjects({
    status: statusFilter,
    search: search || undefined,
  });

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      await deleteProject.mutateAsync(id);
    }
  };

  return (
    <div className="container mx-auto px-4 max-w-6xl py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-2 -rotate-1">
          The <span className="font-spray text-accent-yellow">Backlot</span>
        </h1>
        <p className="text-muted-gray">Your production hub. Manage projects, schedules, and crew.</p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-charcoal-black/50 border-muted-gray/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BacklotProjectStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-44 bg-charcoal-black/50 border-muted-gray/30">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={handleDeleteProject} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Clapperboard className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-bone-white mb-2">No projects yet</h3>
          <p className="text-muted-gray mb-6">
            Create your first project to start managing your production.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

export default BacklotHome;
