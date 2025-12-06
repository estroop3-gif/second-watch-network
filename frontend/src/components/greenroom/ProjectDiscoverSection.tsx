/**
 * ProjectDiscoverSection Component
 * Tabbed project discovery area for the Green Room Hub
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  TrendingUp,
  Clock,
  Flame,
  ExternalLink,
  Vote,
  MessageSquare,
  User,
  Play,
} from 'lucide-react';
import { Project, Cycle, greenroomAPI } from '@/lib/api/greenroom';
import { cn } from '@/lib/utils';

interface ProjectDiscoverSectionProps {
  currentCycle: Cycle | null;
  cycles: Cycle[];
  onVoteClick?: (project: Project) => void;
  availableTickets?: number;
}

type DiscoveryTab = 'featured' | 'new' | 'rising' | 'closing';

const PROJECT_CATEGORIES = [
  'All',
  'Drama',
  'Comedy',
  'Action',
  'Documentary',
  'Horror',
  'Sci-Fi',
  'Faith-Based',
];

export const ProjectDiscoverSection: React.FC<ProjectDiscoverSectionProps> = ({
  currentCycle,
  cycles,
  onVoteClick,
  availableTickets = 0,
}) => {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('featured');
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(
    currentCycle?.id || null
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentCycle?.id && !selectedCycleId) {
      setSelectedCycleId(currentCycle.id);
    }
  }, [currentCycle]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!selectedCycleId) return;

      setIsLoading(true);
      try {
        let sortBy: 'votes' | 'recent' | 'title' = 'votes';

        switch (activeTab) {
          case 'new':
            sortBy = 'recent';
            break;
          case 'rising':
          case 'featured':
          case 'closing':
            sortBy = 'votes';
            break;
        }

        const fetchedProjects = await greenroomAPI.listProjects(selectedCycleId, {
          status: 'approved',
          sort_by: sortBy,
          limit: 12,
        });

        // Apply category filter client-side
        let filtered = fetchedProjects;
        if (selectedCategory !== 'All') {
          filtered = fetchedProjects.filter(p => p.category === selectedCategory);
        }

        setProjects(filtered);
      } catch (error) {
        console.error('Failed to load projects:', error);
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [selectedCycleId, activeTab, selectedCategory]);

  const renderProjectCard = (project: Project) => (
    <Card
      key={project.id}
      className="bg-charcoal-black/50 border-muted-gray hover:border-emerald-600/50 transition-all group overflow-hidden"
    >
      {/* Project Image */}
      {project.image_url && (
        <div className="relative h-40 overflow-hidden">
          <img
            src={project.image_url}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {project.video_url && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="h-12 w-12 text-white" />
            </div>
          )}
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        {/* Category Badge */}
        {project.category && (
          <Badge variant="outline" className="text-xs border-emerald-600/50 text-emerald-400">
            {project.category}
          </Badge>
        )}

        {/* Title */}
        <h3 className="text-lg font-semibold text-bone-white line-clamp-1 group-hover:text-emerald-400 transition-colors">
          {project.title}
        </h3>

        {/* Description/Logline */}
        <p className="text-sm text-bone-white/70 line-clamp-2">
          {project.description}
        </p>

        {/* Creator */}
        <div className="flex items-center gap-2 text-sm text-muted-gray">
          <User className="h-4 w-4" />
          <span>{project.filmmaker_name || 'Anonymous'}</span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between pt-2 border-t border-muted-gray/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-accent-yellow">
              <Vote className="h-4 w-4" />
              <span className="text-sm font-semibold">{project.vote_count}</span>
            </div>
            {/* TODO: Add comment count when backend supports it */}
          </div>

          <div className="flex items-center gap-2">
            {onVoteClick && availableTickets > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white"
                onClick={() => onVoteClick(project)}
              >
                Vote
              </Button>
            )}
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-bone-white/70 hover:text-bone-white"
            >
              <Link to={`/greenroom/cycles/${project.cycle_id}`}>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderLoadingSkeletons = () => (
    <>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="bg-charcoal-black/50 border-muted-gray">
          <div className="h-40 bg-muted-gray/20 animate-pulse" />
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </>
  );

  return (
    <Card className="bg-charcoal-black/30 border-muted-gray">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle className="text-xl text-bone-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Discover Projects
          </CardTitle>

          {/* Filters */}
          <div className="flex items-center gap-3">
            {/* Cycle Selector */}
            {cycles.length > 1 && (
              <Select
                value={selectedCycleId?.toString() || ''}
                onValueChange={(val) => setSelectedCycleId(Number(val))}
              >
                <SelectTrigger className="w-[180px] bg-charcoal-black border-muted-gray text-bone-white">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray">
                  {cycles.map((cycle) => (
                    <SelectItem
                      key={cycle.id}
                      value={cycle.id.toString()}
                      className="text-bone-white hover:bg-muted-gray/50"
                    >
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Category Filter */}
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-[140px] bg-charcoal-black border-muted-gray text-bone-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray">
                {PROJECT_CATEGORIES.map((cat) => (
                  <SelectItem
                    key={cat}
                    value={cat}
                    className="text-bone-white hover:bg-muted-gray/50"
                  >
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DiscoveryTab)}>
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/50">
            <TabsTrigger
              value="featured"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Featured
            </TabsTrigger>
            <TabsTrigger
              value="new"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <Flame className="h-4 w-4 mr-1.5" />
              New
            </TabsTrigger>
            <TabsTrigger
              value="rising"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <TrendingUp className="h-4 w-4 mr-1.5" />
              Rising
            </TabsTrigger>
            <TabsTrigger
              value="closing"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <Clock className="h-4 w-4 mr-1.5" />
              Closing Soon
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderLoadingSkeletons()}
              </div>
            ) : projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(renderProjectCard)}
              </div>
            ) : (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 text-muted-gray mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-bone-white mb-2">
                  No projects found
                </h3>
                <p className="text-muted-gray">
                  {selectedCategory !== 'All'
                    ? `No ${selectedCategory} projects in this cycle yet.`
                    : 'No approved projects in this cycle yet.'}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* View All Link */}
        {currentCycle && projects.length > 0 && (
          <div className="text-center">
            <Button
              asChild
              variant="outline"
              className="border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white"
            >
              <Link to={`/greenroom/cycles/${currentCycle.id}`}>
                View All Projects
                <ExternalLink className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectDiscoverSection;
