/**
 * GreenRoomWidget
 * Green Room project discovery - voting, crowdfunding, recent winners
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { greenroomAPI, type Cycle, type Project } from '@/lib/api/greenroom';
import { useAuth } from '@/context/AuthContext';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Sparkles, Vote, Trophy, Timer, Ticket, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// Format time remaining
function formatTimeRemaining(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs < 0) return 'Ended';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }
  return `${hours}h left`;
}

export function GreenRoomWidget({ className = '' }: SectionProps) {
  const { isAuthenticated } = useAuth();

  // Get active cycle
  const { data: cycles, isLoading: cyclesLoading } = useQuery({
    queryKey: ['greenroom-cycles', 'active'],
    queryFn: () => greenroomAPI.listCycles('active'),
    staleTime: 5 * 60 * 1000,
  });

  const activeCycle = cycles?.[0];

  // Get top projects from active cycle
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['greenroom-projects', activeCycle?.id, 'top'],
    queryFn: () =>
      greenroomAPI.listProjects(activeCycle!.id, {
        status: 'approved',
        sort_by: 'votes',
        limit: 3,
      }),
    enabled: !!activeCycle,
    staleTime: 2 * 60 * 1000,
  });

  // Get user's tickets (if authenticated)
  const { data: tickets } = useQuery({
    queryKey: ['greenroom-my-tickets'],
    queryFn: () => greenroomAPI.getMyTickets(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  // Calculate available tickets for active cycle
  const activeTickets = tickets?.find(t => t.cycle_id === activeCycle?.id);
  const availableTickets = activeTickets?.tickets_available || 0;

  // Get recent results from closed cycles
  const { data: closedCycles } = useQuery({
    queryKey: ['greenroom-cycles', 'closed'],
    queryFn: () => greenroomAPI.listCycles('closed'),
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = cyclesLoading || projectsLoading;

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  // If no active cycle and no closed cycles, don't show
  if (!activeCycle && (!closedCycles || closedCycles.length === 0)) {
    return null;
  }

  return (
    <div className={`p-4 bg-charcoal-black border border-accent-yellow/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent-yellow" />
          <h3 className="font-heading text-bone-white">Green Room</h3>
          {activeCycle && (
            <span className="px-2 py-0.5 bg-accent-yellow/20 rounded-full text-xs text-accent-yellow">
              Voting Open
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/greenroom">
            Explore
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Active Voting Cycle */}
      {activeCycle && (
        <div className="mb-4">
          {/* Cycle Info */}
          <div className="flex items-center justify-between mb-3 p-2 bg-accent-yellow/10 rounded-lg">
            <div>
              <p className="font-medium text-bone-white text-sm">{activeCycle.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-gray">
                <Timer className="w-3 h-3" />
                <span>{formatTimeRemaining(activeCycle.end_date)}</span>
                <span>•</span>
                <span>{activeCycle.project_count || 0} projects</span>
              </div>
            </div>
            {isAuthenticated && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-accent-yellow">
                  <Ticket className="w-4 h-4" />
                  <span className="font-medium">{availableTickets}</span>
                </div>
                <p className="text-xs text-muted-gray">tickets</p>
              </div>
            )}
          </div>

          {/* Top Projects */}
          {projects && projects.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-gray uppercase tracking-wider">Top Projects</p>
              {projects.map((project: Project, index: number) => (
                <Link
                  key={project.id}
                  to={`/greenroom/cycle/${activeCycle.id}?project=${project.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted-gray/10 transition-colors"
                >
                  {/* Rank */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    index === 0 ? 'bg-accent-yellow text-charcoal-black' :
                    index === 1 ? 'bg-bone-white/20 text-bone-white' :
                    'bg-muted-gray/20 text-muted-gray'
                  }`}>
                    <span className="text-xs font-bold">{index + 1}</span>
                  </div>

                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded overflow-hidden bg-muted-gray/20 flex-shrink-0">
                    {project.image_url ? (
                      <img
                        src={project.image_url}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-muted-gray" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-bone-white text-sm truncate">{project.title}</p>
                    <p className="text-xs text-muted-gray truncate">
                      by {project.filmmaker_name || 'Anonymous'}
                    </p>
                  </div>

                  {/* Votes */}
                  <div className="flex items-center gap-1 text-accent-yellow">
                    <Vote className="w-4 h-4" />
                    <span className="font-medium text-sm">{project.vote_count}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Vote CTA */}
          {isAuthenticated && availableTickets > 0 && (
            <Button className="w-full mt-3 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90" asChild>
              <Link to={`/greenroom/cycle/${activeCycle.id}`}>
                <Vote className="w-4 h-4 mr-2" />
                Cast Your Votes
              </Link>
            </Button>
          )}

          {/* Get Tickets CTA */}
          {isAuthenticated && availableTickets === 0 && (
            <Button variant="outline" className="w-full mt-3 border-accent-yellow text-accent-yellow hover:bg-accent-yellow/10" asChild>
              <Link to={`/greenroom/cycle/${activeCycle.id}`}>
                <Ticket className="w-4 h-4 mr-2" />
                Get Voting Tickets
              </Link>
            </Button>
          )}

          {/* Sign up CTA for guests */}
          {!isAuthenticated && (
            <Button variant="outline" className="w-full mt-3" asChild>
              <Link to="/signup">
                Sign up to vote
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Recent Winners */}
      {closedCycles && closedCycles.length > 0 && (
        <div className={activeCycle ? 'pt-3 border-t border-muted-gray/20' : ''}>
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-accent-yellow" />
            <p className="text-xs text-muted-gray uppercase tracking-wider">Recent Winners</p>
          </div>
          <div className="flex gap-2">
            {closedCycles.slice(0, 2).map((cycle: Cycle) => (
              <Link
                key={cycle.id}
                to={`/greenroom/cycle/${cycle.id}/results`}
                className="flex-1 p-2 rounded-lg bg-muted-gray/10 hover:bg-muted-gray/20 transition-colors"
              >
                <p className="text-sm font-medium text-bone-white truncate">{cycle.name}</p>
                <p className="text-xs text-muted-gray">
                  {cycle.total_votes || 0} votes
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GreenRoomWidget;
