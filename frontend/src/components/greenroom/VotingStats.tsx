/**
 * Voting Stats Component
 * Displays user's voting statistics and ticket info
 */
'use client';

import { useEffect, useState } from 'react';
import { greenroomAPI, UserStats, VotingTicket, Vote } from '@/lib/api/greenroom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Ticket, ThumbsUp, Film, CheckCircle, TrendingUp } from 'lucide-react';

interface VotingStatsProps {
  cycleId?: number;
  showVotes?: boolean;
  showTickets?: boolean;
  compact?: boolean;
}

export function VotingStats({
  cycleId,
  showVotes = true,
  showTickets = true,
  compact = false,
}: VotingStatsProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tickets, setTickets] = useState<VotingTicket[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  useEffect(() => {
    loadData();
  }, [cycleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, ticketsData, votesData] = await Promise.all([
        greenroomAPI.getMyStats(),
        showTickets ? greenroomAPI.getMyTickets() : Promise.resolve([]),
        showVotes ? greenroomAPI.getMyVotes(cycleId) : Promise.resolve([]),
      ]);
      setStats(statsData);
      setTickets(ticketsData);
      setVotes(votesData);
    } catch (error) {
      console.error('Failed to load voting stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  // Calculate available tickets for current/selected cycle
  const cycleTickets = cycleId
    ? tickets.filter(t => t.cycle_id === cycleId && t.payment_status === 'completed')
    : tickets.filter(t => t.payment_status === 'completed');

  const totalAvailable = cycleTickets.reduce((sum, t) => sum + t.tickets_available, 0);
  const totalUsed = cycleTickets.reduce((sum, t) => sum + t.tickets_used, 0);

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Ticket className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{totalAvailable}</span>
          <span className="text-muted-foreground">tickets</span>
        </div>
        <div className="flex items-center gap-1">
          <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{totalUsed}</span>
          <span className="text-muted-foreground">used</span>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Your Stats
        </CardTitle>
        <CardDescription>
          Your voting activity and ticket information
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Ticket Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Ticket className="h-3 w-3" />
              Available
            </p>
            <p className="text-2xl font-bold text-primary">{totalAvailable}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              Used
            </p>
            <p className="text-2xl font-bold">{totalUsed}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Film className="h-3 w-3" />
              Projects
            </p>
            <p className="text-2xl font-bold">{stats.projects_submitted}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Approved
            </p>
            <p className="text-2xl font-bold text-green-500">{stats.projects_approved}</p>
          </div>
        </div>

        {/* Recent Votes */}
        {showVotes && votes.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">
              {cycleId ? 'Your Votes This Cycle' : 'Recent Votes'}
            </h4>
            <div className="space-y-2">
              {votes.slice(0, 5).map((vote) => (
                <div
                  key={vote.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <span className="font-medium truncate">{vote.project_title || `Project #${vote.project_id}`}</span>
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    <ThumbsUp className="h-3 w-3" />
                    {vote.tickets_allocated}
                  </Badge>
                </div>
              ))}
              {votes.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{votes.length - 5} more votes
                </p>
              )}
            </div>
          </div>
        )}

        {/* Ticket History */}
        {showTickets && cycleTickets.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Ticket Purchases</h4>
            <div className="space-y-2">
              {cycleTickets.slice(0, 3).map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div>
                    <span className="font-medium">{ticket.tickets_purchased} tickets</span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={ticket.payment_status === 'completed' ? 'default' : 'secondary'}
                  >
                    {ticket.payment_status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
