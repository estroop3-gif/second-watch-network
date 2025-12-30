/**
 * BacklotHome - Main landing page for the Backlot Production Hub
 * Lists user's projects with create project functionality
 * Now includes My Projects and Public tabs
 */
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  FolderOpen,
  Briefcase,
  Check,
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
import { useProjects, usePublicProjects, PublicBacklotProject } from '@/hooks/backlot/useProjects';
import { BacklotProject, BacklotProjectStatus, BacklotVisibility } from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';
import CreateProjectModal from '@/components/backlot/CreateProjectModal';
import BacklotUpgradePrompt from '@/components/backlot/BacklotUpgradePrompt';
import DonateModal from '@/components/backlot/DonateModal';
import DonationProgress from '@/components/backlot/DonationProgress';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Heart, ExternalLink, Mail } from 'lucide-react';

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

// Ownership filter options
type OwnershipFilter = 'all' | 'owner' | 'member';

const OWNERSHIP_OPTIONS: { value: OwnershipFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <FolderOpen className="w-4 h-4" /> },
  { value: 'owner', label: 'Created by Me', icon: <Film className="w-4 h-4" /> },
  { value: 'member', label: 'Working On', icon: <Briefcase className="w-4 h-4" /> },
];

// Public project card - simplified, read-only
const PublicProjectCard: React.FC<{
  project: PublicBacklotProject;
  onViewDetails: (project: PublicBacklotProject) => void;
}> = ({ project, onViewDetails }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (project.has_access) {
      navigate(`/backlot/projects/${project.id}`);
    } else {
      onViewDetails(project);
    }
  };

  return (
    <div
      className={cn(
        "group bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden transition-colors cursor-pointer",
        project.has_access
          ? "hover:border-green-500/50"
          : "hover:border-accent-yellow/30"
      )}
      onClick={handleClick}
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
        {/* Public Badge */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className="bg-charcoal-black/80 border-green-500/30 text-green-400 text-xs flex items-center gap-1"
          >
            <Globe className="w-3 h-3" />
            Public
          </Badge>
        </div>
        {/* Has Access Badge */}
        {project.has_access && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-500/20 border-green-500/50 text-green-400 text-xs flex items-center gap-1">
              <Check className="w-3 h-3" />
              You're on this project
            </Badge>
          </div>
        )}
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
          {!project.has_access && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 border-primary-red/50 text-primary-red hover:bg-primary-red/10"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(project);
              }}
            >
              <Heart className="w-3 h-3 mr-1" />
              Support
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Public project detail modal - read-only view with support options
const PublicProjectModal: React.FC<{
  project: PublicBacklotProject | null;
  isOpen: boolean;
  onClose: () => void;
  onDonate: () => void;
}> = ({ project, isOpen, onClose, onDonate }) => {
  const navigate = useNavigate();

  if (!project) return null;

  const ownerName = project.owner?.display_name || project.owner?.full_name || 'Owner';
  const ownerUsername = project.owner?.username;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-charcoal-black border-muted-gray max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-bone-white text-xl">{project.title}</DialogTitle>
          <DialogDescription className="text-muted-gray">
            A public project on Second Watch Network
          </DialogDescription>
        </DialogHeader>

        {/* Cover Image */}
        {project.cover_image_url && (
          <div className="relative h-48 bg-gradient-to-br from-muted-gray/20 to-charcoal-black rounded-lg overflow-hidden">
            <img
              src={project.cover_image_url}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Project Info */}
        <div className="space-y-4">
          {/* Status & Type */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={STATUS_COLORS[project.status]}>
              {STATUS_LABELS[project.status]}
            </Badge>
            {project.project_type && (
              <Badge variant="outline" className="border-muted-gray/50 text-muted-gray">
                {project.project_type}
              </Badge>
            )}
            {project.genre && (
              <Badge variant="outline" className="border-muted-gray/50 text-muted-gray">
                {project.genre}
              </Badge>
            )}
          </div>

          {/* Logline */}
          {project.logline && (
            <p className="text-bone-white/90 italic">"{project.logline}"</p>
          )}

          {/* Description */}
          {project.description && (
            <p className="text-muted-gray text-sm">{project.description}</p>
          )}

          {/* Owner */}
          <div className="flex items-center gap-3 py-3 border-t border-b border-muted-gray/30">
            <Avatar className="w-10 h-10">
              <AvatarImage src={project.owner?.avatar_url || ''} />
              <AvatarFallback>{ownerName.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-bone-white font-medium">{ownerName}</p>
              {ownerUsername && (
                <Link
                  to={`/profile/${ownerUsername}`}
                  className="text-sm text-accent-yellow hover:underline flex items-center gap-1"
                  onClick={onClose}
                >
                  View Profile
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Donation Progress */}
          <div className="py-2">
            <DonationProgress projectId={project.id} />
          </div>

          {/* Support Section */}
          <div className="bg-muted-gray/10 p-4 rounded-lg border border-muted-gray/20">
            <h4 className="text-bone-white font-medium mb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary-red" />
              Support This Project
            </h4>
            <p className="text-muted-gray text-sm mb-4">
              Help bring this project to life by making a donation or reaching out to the creator.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={onDonate}
                className="flex-1 bg-primary-red hover:bg-primary-red/90 text-bone-white"
              >
                <Heart className="w-4 h-4 mr-2" />
                Donate
              </Button>
              {ownerUsername && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onClose();
                    navigate(`/messages?to=${ownerUsername}`);
                  }}
                  className="flex-1 border-muted-gray text-bone-white hover:bg-muted-gray/30"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Message Creator
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BacklotHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'my-projects';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BacklotProjectStatus | 'all'>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Public project modal state
  const [selectedPublicProject, setSelectedPublicProject] = useState<PublicBacklotProject | null>(null);
  const [showPublicModal, setShowPublicModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);

  // Check backlot access
  const { data: accessData, isLoading: isCheckingAccess } = useQuery({
    queryKey: ['backlot-access'],
    queryFn: () => api.checkBacklotAccess(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // My projects (with ownership filter)
  const { projects: myProjects, isLoading: isLoadingMy, deleteProject } = useProjects({
    status: statusFilter,
    search: search || undefined,
    ownership: ownershipFilter,
  });

  // Public projects
  const { projects: publicProjects, isLoading: isLoadingPublic } = usePublicProjects({
    status: statusFilter,
    search: search || undefined,
  });

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      await deleteProject.mutateAsync(id);
    }
  };

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    // Reset filters when switching tabs
    setSearch('');
    setStatusFilter('all');
    setOwnershipFilter('all');
  };

  const handleViewPublicProject = (project: PublicBacklotProject) => {
    setSelectedPublicProject(project);
    setShowPublicModal(true);
  };

  const handleOpenDonateModal = () => {
    setShowPublicModal(false);
    setShowDonateModal(true);
  };

  const handleCloseDonateModal = () => {
    setShowDonateModal(false);
    // Re-open the public modal
    setShowPublicModal(true);
  };

  // Show loading while checking access
  if (isCheckingAccess) {
    return (
      <div className="container mx-auto px-4 max-w-6xl py-8">
        <div className="text-center mb-8">
          <Skeleton className="h-16 w-64 mx-auto mb-4" />
          <Skeleton className="h-4 w-96 mx-auto" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Show upgrade prompt if no access
  if (!accessData?.has_access) {
    return <BacklotUpgradePrompt />;
  }

  return (
    <div className="container mx-auto px-4 max-w-6xl py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-2 -rotate-1">
          The <span className="font-spray text-accent-yellow">Backlot</span>
        </h1>
        <p className="text-muted-gray">Your production hub. Manage projects, schedules, and crew.</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
            <TabsTrigger value="my-projects" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <FolderOpen className="w-4 h-4 mr-2" />
              My Projects
            </TabsTrigger>
            <TabsTrigger value="public" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <Globe className="w-4 h-4 mr-2" />
              Public
            </TabsTrigger>
          </TabsList>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-charcoal-black/50 border-muted-gray/30"
            />
          </div>

          {/* Ownership filter - only for My Projects tab */}
          {activeTab === 'my-projects' && (
            <div className="flex gap-1 bg-charcoal-black/50 border border-muted-gray/30 rounded-md p-1">
              {OWNERSHIP_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => setOwnershipFilter(option.value)}
                  className={cn(
                    "text-xs h-8",
                    ownershipFilter === option.value
                      ? "bg-accent-yellow text-charcoal-black hover:bg-accent-yellow"
                      : "text-muted-gray hover:text-bone-white"
                  )}
                >
                  {option.icon}
                  <span className="ml-1 hidden sm:inline">{option.label}</span>
                </Button>
              ))}
            </div>
          )}

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
        </div>

        {/* My Projects Tab */}
        <TabsContent value="my-projects" className="mt-6">
          {isLoadingMy ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : myProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myProjects.map((project) => (
                <ProjectCard key={project.id} project={project} onDelete={handleDeleteProject} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
              <Clapperboard className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-bone-white mb-2">
                {ownershipFilter === 'owner'
                  ? 'No projects created yet'
                  : ownershipFilter === 'member'
                  ? "You're not working on any projects"
                  : 'No projects yet'}
              </h3>
              <p className="text-muted-gray mb-6">
                {ownershipFilter === 'owner'
                  ? 'Create your first project to start managing your production.'
                  : ownershipFilter === 'member'
                  ? 'Join a project team or get invited to collaborate.'
                  : 'Create your first project to start managing your production.'}
              </p>
              {ownershipFilter !== 'member' && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Public Tab */}
        <TabsContent value="public" className="mt-6">
          {isLoadingPublic ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : publicProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicProjects.map((project) => (
                <PublicProjectCard
                  key={project.id}
                  project={project}
                  onViewDetails={handleViewPublicProject}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
              <Globe className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-bone-white mb-2">No public projects</h3>
              <p className="text-muted-gray">
                There are no public projects available at this time.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Public Project Modal */}
      <PublicProjectModal
        project={selectedPublicProject}
        isOpen={showPublicModal}
        onClose={() => {
          setShowPublicModal(false);
          setSelectedPublicProject(null);
        }}
        onDonate={handleOpenDonateModal}
      />

      {/* Donate Modal */}
      {selectedPublicProject && (
        <DonateModal
          isOpen={showDonateModal}
          onClose={handleCloseDonateModal}
          projectId={selectedPublicProject.id}
          projectTitle={selectedPublicProject.title}
          donationMessage={selectedPublicProject.donation_message}
        />
      )}
    </div>
  );
};

export default BacklotHome;
