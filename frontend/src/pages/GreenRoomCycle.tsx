/**
 * Cycle Detail Page
 * View projects and vote
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { greenroomAPI, Cycle, Project, VotingTicket } from '@/lib/api/greenroom';
import { ProjectCard } from '@/components/greenroom/ProjectCard';
import { VoteModal } from '@/components/greenroom/VoteModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Ticket, ShoppingCart, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function GreenRoomCycle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cycleId = parseInt(id || '0');

  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tickets, setTickets] = useState<VotingTicket[]>([]);
  const [sortBy, setSortBy] = useState<'votes' | 'recent'>('votes');

  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (cycleId) {
      loadData();
    }
  }, [cycleId, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cycleData, projectsData, ticketsData] = await Promise.all([
        greenroomAPI.getCycle(cycleId),
        greenroomAPI.listProjects(cycleId, { sort_by: sortBy }),
        greenroomAPI.getMyTickets().catch(() => []), // May fail if not authenticated
      ]);

      setCycle(cycleData);
      setProjects(projectsData);
      setTickets(ticketsData.filter((t) => t.cycle_id === cycleId));
    } catch (error) {
      console.error('Failed to load cycle:', error);
      toast.error('Failed to load cycle details');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = (project: Project) => {
    setSelectedProject(project);
    setVoteModalOpen(true);
  };

  const confirmVote = async (ticketCount: number) => {
    if (!selectedProject) return;

    try {
      await greenroomAPI.castVote({
        project_id: selectedProject.id,
        tickets_allocated: ticketCount,
      });

      toast.success(`Successfully voted with ${ticketCount} ticket${ticketCount !== 1 ? 's' : ''}!`);

      // Reload data to show updated vote counts
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cast vote');
      throw error;
    }
  };

  const handlePurchaseTickets = () => {
    // TODO: Implement ticket purchase flow
    toast.info('Ticket purchase coming soon!');
  };

  const totalAvailableTickets = tickets.reduce((sum, t) => sum + t.tickets_available, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Cycle not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <Link to="/greenroom">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Green Room
          </Button>
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">{cycle.name}</h1>
            {cycle.description && (
              <p className="text-lg text-muted-foreground">{cycle.description}</p>
            )}
          </div>
          <Badge variant={cycle.status === 'active' ? 'default' : 'secondary'}>
            {cycle.status}
          </Badge>
        </div>
      </div>

      {/* Ticket Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Your Voting Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{totalAvailableTickets}</p>
              <p className="text-sm text-muted-foreground">tickets available</p>
            </div>
            <Button onClick={handlePurchaseTickets}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Purchase Tickets
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Projects */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Projects ({projects.length})
        </h2>

        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <TabsList>
            <TabsTrigger value="votes">Most Votes</TabsTrigger>
            <TabsTrigger value="recent">Most Recent</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onVote={handleVote}
            onViewDetails={(p) => navigate(`/greenroom/projects/${p.id}`)}
            showVoteButton={cycle.status === 'active'}
            userVoteCount={project.user_vote_count}
          />
        ))}
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No projects submitted yet for this cycle.
          </CardContent>
        </Card>
      )}

      {/* Vote Modal */}
      <VoteModal
        open={voteModalOpen}
        onOpenChange={setVoteModalOpen}
        project={selectedProject}
        availableTickets={totalAvailableTickets}
        onConfirmVote={confirmVote}
        userExistingVotes={selectedProject?.user_vote_count || 0}
      />
    </div>
  );
}
