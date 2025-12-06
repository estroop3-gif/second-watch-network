/**
 * YourGreenRoomPanel Component
 * Personal Green Room dashboard showing user's projects, votes, and activity
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User,
  Send,
  Vote,
  Ticket,
  Film,
  ArrowRight,
  ExternalLink,
  TrendingUp,
  Star,
} from 'lucide-react';
import { Project, Vote as VoteType, VotingTicket, UserStats, greenroomAPI, Cycle } from '@/lib/api/greenroom';

interface YourGreenRoomPanelProps {
  currentCycle: Cycle | null;
  isFilmmaker: boolean;
  isAuthenticated: boolean;
}

export const YourGreenRoomPanel: React.FC<YourGreenRoomPanelProps> = ({
  currentCycle,
  isFilmmaker,
  isAuthenticated,
}) => {
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myVotes, setMyVotes] = useState<VoteType[]>([]);
  const [myTickets, setMyTickets] = useState<VotingTicket | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [projects, votes, tickets, stats] = await Promise.all([
          isFilmmaker ? greenroomAPI.getMyProjects().catch(() => []) : Promise.resolve([]),
          currentCycle ? greenroomAPI.getMyVotes(currentCycle.id).catch(() => []) : Promise.resolve([]),
          currentCycle ? greenroomAPI.getMyTickets().catch(() => null) : Promise.resolve(null),
          greenroomAPI.getMyStats().catch(() => null),
        ]);

        setMyProjects(projects);
        setMyVotes(votes);
        setMyTickets(tickets);
        setUserStats(stats);
      } catch (error) {
        console.error('Failed to load user Green Room data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [isAuthenticated, isFilmmaker, currentCycle]);

  // Get the user's project in current cycle
  const currentCycleProject = myProjects.find(p => p.cycle_id === currentCycle?.id);

  if (!isAuthenticated) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray">
        <CardHeader>
          <CardTitle className="text-lg text-bone-white flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-400" />
            Your Green Room
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <User className="h-12 w-12 text-muted-gray mx-auto mb-4" />
          <p className="text-bone-white/70 mb-4">
            Sign in to track your projects, votes, and tickets.
          </p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link to="/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray">
        <CardHeader>
          <CardTitle className="text-lg text-bone-white flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-400" />
            Your Green Room
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray">
      <CardHeader>
        <CardTitle className="text-lg text-bone-white flex items-center gap-2">
          <User className="h-5 w-5 text-emerald-400" />
          Your Green Room
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Project Section (for filmmakers) */}
        {isFilmmaker && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-gray uppercase tracking-wider">
              Your Project
            </h4>
            {currentCycleProject ? (
              <div className="bg-charcoal-black/60 rounded-lg p-4 border border-emerald-600/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-bone-white truncate">
                      {currentCycleProject.title}
                    </h5>
                    <Badge
                      className={
                        currentCycleProject.status === 'approved'
                          ? 'bg-emerald-600 text-white'
                          : currentCycleProject.status === 'pending'
                          ? 'bg-amber-600 text-white'
                          : 'bg-red-600 text-white'
                      }
                    >
                      {currentCycleProject.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-accent-yellow">
                      {currentCycleProject.vote_count}
                    </p>
                    <p className="text-xs text-muted-gray">votes</p>
                  </div>
                </div>

                {/* Vote Progress (example threshold) */}
                {currentCycleProject.status === 'approved' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-gray mb-1">
                      <span>Progress to slate</span>
                      <span>{Math.min(100, Math.round((currentCycleProject.vote_count / 100) * 100))}%</span>
                    </div>
                    <Progress
                      value={Math.min(100, (currentCycleProject.vote_count / 100) * 100)}
                      className="h-2"
                    />
                  </div>
                )}

                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full border-emerald-600 text-emerald-400"
                >
                  <Link to={`/greenroom/cycles/${currentCycleProject.cycle_id}`}>
                    View Project
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="bg-charcoal-black/60 rounded-lg p-4 border border-dashed border-muted-gray text-center">
                <Film className="h-8 w-8 text-muted-gray mx-auto mb-2" />
                <p className="text-sm text-bone-white/70 mb-3">
                  You haven't submitted to this cycle yet.
                </p>
                {currentCycle?.status !== 'closed' && (
                  <Button
                    asChild
                    size="sm"
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    <Link to="/greenroom/submit">
                      <Send className="h-4 w-4 mr-2" />
                      Submit a Project
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tickets Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-gray uppercase tracking-wider">
            Your Tickets
          </h4>
          <div className="bg-charcoal-black/60 rounded-lg p-4 border border-muted-gray/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent-yellow/20 rounded-lg">
                  <Ticket className="h-5 w-5 text-accent-yellow" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-bone-white">
                    {myTickets?.tickets_available || 0}
                  </p>
                  <p className="text-xs text-muted-gray">available to vote</p>
                </div>
              </div>
              <div className="text-right text-sm text-muted-gray">
                <p>{myTickets?.tickets_used || 0} used</p>
                <p>{myTickets?.tickets_purchased || 0} total</p>
              </div>
            </div>
            {currentCycle && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="mt-3 w-full border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black"
              >
                <Link to={`/greenroom/cycles/${currentCycle.id}`}>
                  Buy More Tickets
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Recent Votes Section */}
        {myVotes.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-gray uppercase tracking-wider">
              Your Recent Votes
            </h4>
            <div className="space-y-2">
              {myVotes.slice(0, 3).map((vote) => (
                <div
                  key={vote.id}
                  className="flex items-center justify-between p-2 bg-charcoal-black/60 rounded-lg border border-muted-gray/20"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Vote className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-bone-white truncate">
                      {vote.project_title || `Project #${vote.project_id}`}
                    </span>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0 text-accent-yellow border-accent-yellow">
                    {vote.tickets_allocated} tickets
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Summary */}
        {userStats && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-gray uppercase tracking-wider">
              All-Time Stats
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-charcoal-black/60 rounded-lg p-3 text-center border border-muted-gray/20">
                <TrendingUp className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-bone-white">{userStats.total_votes_cast}</p>
                <p className="text-xs text-muted-gray">Total Votes</p>
              </div>
              <div className="bg-charcoal-black/60 rounded-lg p-3 text-center border border-muted-gray/20">
                <Star className="h-5 w-5 text-accent-yellow mx-auto mb-1" />
                <p className="text-xl font-bold text-bone-white">{userStats.total_tickets_purchased}</p>
                <p className="text-xs text-muted-gray">Tickets Bought</p>
              </div>
              {isFilmmaker && (
                <>
                  <div className="bg-charcoal-black/60 rounded-lg p-3 text-center border border-muted-gray/20">
                    <Film className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-bone-white">{userStats.projects_submitted}</p>
                    <p className="text-xs text-muted-gray">Submitted</p>
                  </div>
                  <div className="bg-charcoal-black/60 rounded-lg p-3 text-center border border-muted-gray/20">
                    <Send className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-bone-white">{userStats.projects_approved}</p>
                    <p className="text-xs text-muted-gray">Approved</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default YourGreenRoomPanel;
